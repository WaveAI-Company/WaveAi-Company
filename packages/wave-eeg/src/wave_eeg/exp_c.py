"""Exp. C — reatividade repouso vs carga cognitiva (DataScience/31 §13, TRAVADO).

Mesmo arcabouço intercalado do Exp. B, mas as condições são **REPOUSO** vs
**CARGA** (aritmética mental silenciosa), **ambas de olhos abertos** — para
**não** reintroduzir o efeito de Berger (OF/OA) do Exp. B.

**Hipótese primária TRAVADA (§13):** `rel_alpha(REPOUSO) > rel_alpha(CARGA)` —
o alfa **dessincroniza com o engajamento** cognitivo. Features secundárias
(teta etc.) são **exploratórias**, reportadas mas **não** confirmatórias.

**Anti-p-hacking:** o pré-registro (§13) foi travado antes deste código; o
veredito sai do pipeline travado. Sinal sem diferença **não** passa.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from typing import Dict

import numpy as np
from scipy import stats

from .analysis import epoch_relative_alpha, preprocess
from .exp_b import Block, fs_from_duration
from .features import compute_features

#: Rótulos canônicos de condição.
REST = "rest"
LOAD = "load"

_REST_LABELS = {"REST", "REPOUSO", "RELAX", "RELAXADO", "R"}
_LOAD_LABELS = {"LOAD", "CARGA", "MATH", "ARITMETICA", "TASK", "L"}

#: Features secundárias reportadas (exploratórias, do Catálogo N2).
_SECONDARY = ("rel_theta", "ratio_theta_beta", "ratio_alpha_beta")


def condition_from_label(label: str) -> str:
    u = str(label).strip().upper()
    if u in _REST_LABELS:
        return REST
    if u in _LOAD_LABELS:
        return LOAD
    raise ValueError(f"condição desconhecida no CSV: {label!r} (use REST/LOAD)")


@dataclass
class ExpCResult:
    """Resultado do Exp. C (alfa relativa REPOUSO vs CARGA)."""

    rest_rel_alpha: float
    load_rel_alpha: float
    ratio: float  # repouso / carga (esperado > 1 se o alfa cai na carga)
    t_stat: float
    p_value: float
    cohens_d: float
    n_epochs_rest: int
    n_epochs_load: int
    n_blocks_rest: int
    n_blocks_load: int
    passed: bool
    secondary: Dict[str, Dict[str, float]] = field(default_factory=dict)

    @property
    def verdict(self) -> str:
        if not (self.rest_rel_alpha > self.load_rel_alpha):
            return "NAO passou (direcao invertida ou igual)"
        if not np.isnan(self.p_value) and self.p_value < 0.05:
            return "PASSOU (alfa REPOUSO > CARGA, significativo)"
        return "INCONCLUSIVO (direcao correta, ainda sem significancia)"


def _cohens_d(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return float("nan")
    sa, sb = np.var(a, ddof=1), np.var(b, ddof=1)
    pooled = np.sqrt(((na - 1) * sa + (nb - 1) * sb) / (na + nb - 2))
    return float((np.mean(a) - np.mean(b)) / pooled) if pooled else float("nan")


def _mean_secondary(dicts) -> Dict[str, float]:
    return {k: float(np.mean([d[k] for d in dicts])) for k in _SECONDARY} if dicts else {}


def analyze_interleaved(
    blocks,
    *,
    discard_s: float = 5.0,
    epoch_s: float = 4.0,
    notch_freq: float = 60.0,
    alpha_level: float = 0.05,
) -> ExpCResult:
    """Analisa um registro intercalado REPOUSO/CARGA conforme o §13."""
    rest_eps, load_eps = [], []
    rest_feats, load_feats = [], []
    n_rest_blocks = n_load_blocks = 0
    for block in blocks:
        n_discard = int(discard_s * block.fs)
        x = np.asarray(block.samples, dtype=float)[n_discard:]
        if x.size == 0:
            continue
        xf = preprocess(x, block.fs, notch_freq=notch_freq)
        eps = epoch_relative_alpha(xf, block.fs, epoch_s)
        feats = compute_features(xf, block.fs, preprocess_signal=False)
        if block.condition == REST:
            rest_eps.append(eps)
            rest_feats.append(feats)
            n_rest_blocks += 1
        elif block.condition == LOAD:
            load_eps.append(eps)
            load_feats.append(feats)
            n_load_blocks += 1
        else:
            raise ValueError(
                f"condição desconhecida: {block.condition!r} (use {REST!r}/{LOAD!r})"
            )

    rest = np.concatenate(rest_eps) if rest_eps else np.array([])
    load = np.concatenate(load_eps) if load_eps else np.array([])
    rest_m = float(np.mean(rest)) if rest.size else float("nan")
    load_m = float(np.mean(load)) if load.size else float("nan")
    ratio = rest_m / load_m if load_m else float("inf")

    if rest.size > 1 and load.size > 1:
        t, p = stats.ttest_ind(rest, load, equal_var=False)
        t, p = float(t), float(p)
        d = _cohens_d(rest, load)
    else:
        t = p = d = float("nan")

    passed = bool(rest_m > load_m and not np.isnan(p) and p < alpha_level)
    secondary = {
        k: {"rest": _mean_secondary(rest_feats).get(k, float("nan")),
            "load": _mean_secondary(load_feats).get(k, float("nan"))}
        for k in _SECONDARY
    }
    return ExpCResult(
        rest_rel_alpha=rest_m,
        load_rel_alpha=load_m,
        ratio=ratio,
        t_stat=t,
        p_value=p,
        cohens_d=d,
        n_epochs_rest=int(rest.size),
        n_epochs_load=int(load.size),
        n_blocks_rest=n_rest_blocks,
        n_blocks_load=n_load_blocks,
        passed=passed,
        secondary=secondary,
    )


def read_capture_csv(path: str):
    """Lê um CSV de captura (`t, raw, poor_signal, condition`) com rótulos REST/LOAD."""
    ts, raw, labels = [], [], []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            try:
                raw.append(float(row["raw"]))
            except (KeyError, ValueError):
                continue
            ts.append(float(row.get("t") or "nan"))
            label = (row.get("condition") or "").strip()
            if label:
                labels.append(label)
    if not raw:
        raise ValueError(f"{path}: sem coluna 'raw' utilizável")
    if not labels:
        raise ValueError(f"{path}: sem coluna 'condition'")
    return np.asarray(raw, float), np.asarray(ts, float), condition_from_label(labels[0])


def load_blocks(paths):
    """Carrega CSVs de captura REPOUSO/CARGA como `Block`s, com `fs` por bloco."""
    blocks = []
    for path in paths:
        raw, t, condition = read_capture_csv(path)
        finite_t = t[np.isfinite(t)]
        if finite_t.size < 2 or (finite_t.max() - finite_t.min()) <= 0:
            raise ValueError(f"{path}: timestamps insuficientes para estimar fs")
        fs = fs_from_duration(raw.size, float(finite_t.max() - finite_t.min()))
        blocks.append(Block(condition=condition, samples=raw, fs=fs))
    return blocks


def synth_interleaved(
    *,
    fs: float = 512.0,
    block_s: float = 60.0,
    n_pairs: int = 3,
    alpha_rest: float = 25.0,
    alpha_load: float = 8.0,
    mains: float = 200.0,
    drift: float = 40.0,
    noise: float = 8.0,
    seed: int = 0,
):
    """Registro intercalado REPOUSO/CARGA **sintético** (testes/reprodutibilidade).

    REPOUSO com alfa forte, CARGA com alfa fraco (dessincronização). Não
    substitui a captura real (passo do operador, ADR-0028).
    """
    rng = np.random.default_rng(seed)
    n = int(block_s * fs)
    t = np.arange(n) / fs
    blocks = []
    for _ in range(n_pairs):
        for condition, amp in ((REST, alpha_rest), (LOAD, alpha_load)):
            sig = (
                amp * np.sin(2 * np.pi * 10 * t)
                + mains * np.sin(2 * np.pi * 60 * t)
                + drift * np.sin(2 * np.pi * 0.3 * t)
                + rng.normal(0, noise, n)
            )
            blocks.append(Block(condition=condition, samples=sig, fs=fs))
    return blocks
