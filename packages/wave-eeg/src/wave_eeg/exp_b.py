"""Exp. B — desenho **intercalado** pré-registrado (DataScience/31 §12).

Corrige o confundidor de §8.1 (OF e OA gravados em sessões separadas → contato
diferente entre condições): aqui os blocos OF/OA são gravados em **uma única
colocação** do headset, alternados, e:

- **`fs` é calculado por bloco pelo tempo real** — nunca juntando os timestamps
  de condições diferentes (foi o erro que deu 1022 Hz em §8.1);
- descarta-se **~5 s de transição** no início de cada bloco;
- pipeline **TRAVADO**: detrend → passa-banda 1–45 → notch 60 → épocas 4 s →
  Welch → **alfa RELATIVA** (nunca absoluta).

**Anti-p-hacking:** nada aqui é ajustado para "passar" num dataset. O veredito
sai do pipeline travado; um sinal sem diferença real **não** passa.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import stats

from .analysis import BANDS, epoch_relative_alpha, preprocess

#: Rótulos canônicos de condição (alinhar com o índice do corpus).
EYES_CLOSED = "eyes_closed"
EYES_OPEN = "eyes_open"


def fs_from_duration(n_samples: int, duration_s: float) -> float:
    """`fs` de um bloco pelo **tempo real** dele. Nunca juntar condições (§8.1)."""
    if duration_s <= 0:
        raise ValueError("duration_s deve ser > 0")
    return n_samples / duration_s


@dataclass
class Block:
    """Um bloco de uma condição, com o `fs` **daquele** bloco."""

    condition: str
    samples: np.ndarray
    fs: float


@dataclass
class ExpBResult:
    """Resultado do Exp. B intercalado (alfa relativa OF vs OA)."""

    eyes_closed_rel_alpha: float
    eyes_open_rel_alpha: float
    ratio: float
    t_stat: float
    p_value: float
    cohens_d: float
    n_epochs_closed: int
    n_epochs_open: int
    n_blocks_closed: int
    n_blocks_open: int
    passed: bool

    @property
    def verdict(self) -> str:
        if not (self.eyes_closed_rel_alpha > self.eyes_open_rel_alpha):
            return "NAO passou (direcao invertida ou igual)"
        if not np.isnan(self.p_value) and self.p_value < 0.05:
            return "PASSOU (OF > OA, significativo)"
        return "INCONCLUSIVO (direcao OF>OA correta, ainda sem significancia)"


def _cohens_d(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return float("nan")
    sa, sb = np.var(a, ddof=1), np.var(b, ddof=1)
    pooled = np.sqrt(((na - 1) * sa + (nb - 1) * sb) / (na + nb - 2))
    return float((np.mean(a) - np.mean(b)) / pooled) if pooled else float("nan")


def _epochs_for_block(block, discard_s, epoch_s, bands, notch_freq) -> np.ndarray:
    n_discard = int(discard_s * block.fs)
    x = np.asarray(block.samples, dtype=float)[n_discard:]
    if x.size == 0:
        return np.array([])
    x = preprocess(x, block.fs, notch_freq=notch_freq)
    return epoch_relative_alpha(x, block.fs, epoch_s, bands)


def analyze_interleaved(
    blocks,
    *,
    discard_s: float = 5.0,
    epoch_s: float = 4.0,
    bands=BANDS,
    notch_freq: float = 60.0,
    alpha_level: float = 0.05,
) -> ExpBResult:
    """Analisa um registro intercalado OF/OA conforme o pré-registro (§12)."""
    oc_epochs, oa_epochs = [], []
    n_oc_blocks = n_oa_blocks = 0
    for block in blocks:
        eps = _epochs_for_block(block, discard_s, epoch_s, bands, notch_freq)
        if block.condition == EYES_CLOSED:
            oc_epochs.append(eps)
            n_oc_blocks += 1
        elif block.condition == EYES_OPEN:
            oa_epochs.append(eps)
            n_oa_blocks += 1
        else:
            raise ValueError(
                f"condição desconhecida: {block.condition!r} "
                f"(use {EYES_CLOSED!r} ou {EYES_OPEN!r})"
            )

    oc = np.concatenate(oc_epochs) if oc_epochs else np.array([])
    oa = np.concatenate(oa_epochs) if oa_epochs else np.array([])
    oc_m = float(np.mean(oc)) if oc.size else float("nan")
    oa_m = float(np.mean(oa)) if oa.size else float("nan")
    ratio = oc_m / oa_m if oa_m else float("inf")

    if oc.size > 1 and oa.size > 1:
        t, p = stats.ttest_ind(oc, oa, equal_var=False)
        t, p = float(t), float(p)
        d = _cohens_d(oc, oa)
    else:
        t = p = d = float("nan")

    passed = bool(oc_m > oa_m and not np.isnan(p) and p < alpha_level)
    return ExpBResult(
        eyes_closed_rel_alpha=oc_m,
        eyes_open_rel_alpha=oa_m,
        ratio=ratio,
        t_stat=t,
        p_value=p,
        cohens_d=d,
        n_epochs_closed=int(oc.size),
        n_epochs_open=int(oa.size),
        n_blocks_closed=n_oc_blocks,
        n_blocks_open=n_oa_blocks,
        passed=passed,
    )


def synth_interleaved(
    *,
    fs: float = 512.0,
    block_s: float = 60.0,
    n_pairs: int = 3,
    alpha_closed: float = 25.0,
    alpha_open: float = 8.0,
    mains: float = 200.0,
    drift: float = 40.0,
    noise: float = 8.0,
    seed: int = 0,
):
    """Gera um registro intercalado OF/OA **sintético** (testes e reprodutibilidade).

    Reproduz as armadilhas reais (60 Hz forte + drift + ruído) para provar que o
    pipeline travado ainda recupera OF>OA. É dado sintético — **não** substitui a
    recoleta real (passo do operador, ADR-0028).
    """
    rng = np.random.default_rng(seed)
    n = int(block_s * fs)
    t = np.arange(n) / fs
    blocks = []
    for _ in range(n_pairs):
        for condition, amp in ((EYES_CLOSED, alpha_closed), (EYES_OPEN, alpha_open)):
            sig = (
                amp * np.sin(2 * np.pi * 10 * t)
                + mains * np.sin(2 * np.pi * 60 * t)
                + drift * np.sin(2 * np.pi * 0.3 * t)
                + rng.normal(0, noise, n)
            )
            blocks.append(Block(condition=condition, samples=sig, fs=fs))
    return blocks
