"""Implementação v0 do `AnalysisEngine` sobre o pacote `wave_eeg`.

Toda a matemática (PSD de Welch, potências de banda, pré-processamento e o
teste do alfa do Exp. B) vive em `packages/wave-eeg` — aqui só a adaptação ao
contrato. Nada de DSP novo neste arquivo.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Mapping, Sequence

import numpy as np
import wave_eeg
from wave_eeg.analysis import (
    BANDS,
    band_powers,
    compare_eyes_closed_open,
    mains_power,
    preprocess,
    total_power,
)
from wave_eeg.baseline import build_baseline, deviations
from wave_eeg.devices import SignalFrame
from wave_eeg.longitudinal import longitudinal_report as _longitudinal_report
from wave_eeg.esense import ESENSE_CATALOG
from wave_eeg.features import FEATURE_CATALOG, compute_features
from wave_eeg.quality import assess_quality

from .base import (
    AlphaComparison,
    AnalysisEngine,
    QualityMetrics,
    SessionReport,
    WindowResult,
)

#: Versão desta adaptação. Combinada com a versão do pacote de análise para dar
#: rastreabilidade completa do resultado (o wrapper evolui independentemente).
#: v0.2.0 (N3-a.1): expõe o Catálogo de Features N2 (DataScience/32).
#: v0.3.0 (N3-b): o `quality` ganha score 0..1 + rejeição grossa (ADR-0031).
#: v0.4.0 (N3-c.2): SessionReport ganha `deviations` do baseline pessoal (ADR-0032).
IMPL_VERSION = "0.4.0"

#: Especificações do catálogo em forma serializável (metadados estáticos).
_FEATURE_CATALOG = tuple(asdict(spec) for spec in FEATURE_CATALOG)
#: eSense (proprietário/não-validado — ADR-0034), à parte do Catálogo N2.
_ESENSE_CATALOG = tuple(asdict(spec) for spec in ESENSE_CATALOG)

#: Rótulos aceitos por condição (Exp. B), espelhando o CLI do `wave_eeg`.
EYES_CLOSED_LABELS = frozenset({"OC", "OF", "EYES_CLOSED", "FECHADO", "FECHADOS"})
EYES_OPEN_LABELS = frozenset({"OA", "EYES_OPEN", "ABERTO", "ABERTOS"})


class WaveEegEngine(AnalysisEngine):
    """Engine v0: embrulha `wave_eeg` atrás do contrato `AnalysisEngine`."""

    @property
    def engine_version(self) -> str:
        return f"WaveEegEngine/{IMPL_VERSION}+wave_eeg/{wave_eeg.__version__}"

    @property
    def feature_catalog(self) -> tuple[dict[str, str], ...]:
        """Catálogo N2 (DataScience/32) em forma serializável — inclui a
        `reliability` de cada feature (defensável/cautela)."""
        return _FEATURE_CATALOG

    @property
    def esense_catalog(self) -> tuple[dict[str, str], ...]:
        """eSense (Attention/Meditation) rotulado proprietário/não-validado
        (ADR-0034), à parte do Catálogo N2."""
        return _ESENSE_CATALOG

    def longitudinal_report(
        self,
        sessions: Sequence[Mapping[str, float]],
        quality_scores: Sequence[float] | None = None,
    ) -> dict:
        """Relatório longitudinal (N5) — delega a `wave_eeg.longitudinal`."""
        return _longitudinal_report(list(sessions), quality_scores=quality_scores)

    # -- helpers ---------------------------------------------------------

    def _quality(self, x: np.ndarray, fs: float) -> QualityMetrics:
        """Qualidade medida no sinal **bruto** (o notch removeria a rede).

        O denominador é a potência do **espectro inteiro**, não a soma das
        bandas: elas param em 45 Hz, e os 60 Hz da rede ficariam fora do total
        — a "fração" passava de 1. Uma captação real deu 153% antes disto.
        """
        mains = float(mains_power(x, fs))
        total = float(total_power(x, fs))
        std = float(np.std(x))
        ratio = float(mains / total) if total else 0.0
        # Veredito (ADR-0031): score 0..1 + rejeição grossa. Decisão versionada
        # vive no pacote (`wave_eeg.quality`); aqui só se anexa ao contrato.
        verdict = assess_quality(x, fs, mains_power_ratio=ratio, signal_std=std)
        return QualityMetrics(
            signal_std=std,
            mains_power=mains,
            mains_power_ratio=ratio,
            score=verdict.score,
            rejected=verdict.rejected,
            reason=verdict.reason,
            artifact_ratio=verdict.artifact_ratio,
        )

    def _features(self, samples: Sequence[float], fs: float):
        """Extrai o Catálogo N2 e deriva os campos legados da MESMA fonte.

        Pré-processa **uma vez** (detrend + passa-banda + notch) e reaproveita o
        sinal filtrado tanto para o catálogo (`compute_features`, sem re-filtrar)
        quanto para as potências absolutas — garantindo que `relative_band_powers`
        e `rel_alpha` (legados) sejam exatamente as `rel_*` do catálogo.
        """
        raw = np.asarray(samples, dtype=float)
        filtered = preprocess(raw, fs)
        feats = {k: float(v) for k, v in
                 compute_features(filtered, fs, preprocess_signal=False).items()}
        powers = {k: float(v) for k, v in band_powers(filtered, fs).items()}
        rel = {name: feats[f"rel_{name}"] for name in BANDS}
        # Qualidade é medida no sinal BRUTO: o notch do pré-processamento
        # removeria justamente o 60 Hz que queremos quantificar.
        quality = self._quality(raw, fs)
        return raw, powers, rel, feats, quality

    def _frame(self, samples: Sequence[float], fs: float, device: str | None) -> SignalFrame:
        """Embrulha o sinal num quadro N=1 com proveniência (ADR-0033).

        A montagem é resolvida pelo `device` (registro do `wave_eeg`); device
        ausente/desconhecido cai em "unknown" + canal genérico. É aqui que o
        modelo já fica pronto para N canais sem reescrever o DSP.
        """
        dev = device.strip() if isinstance(device, str) and device.strip() else "unknown"
        return SignalFrame.single_channel(samples, fs, dev)

    def _split_by_condition(self, samples: Sequence[float], labels: Sequence[str]):
        raw = np.asarray(samples, dtype=float)
        tags = np.asarray([str(v).strip().upper() for v in labels])
        closed = raw[np.isin(tags, list(EYES_CLOSED_LABELS))]
        opened = raw[np.isin(tags, list(EYES_OPEN_LABELS))]
        return closed, opened

    # -- contrato --------------------------------------------------------

    def process_window(
        self, samples: Sequence[float], fs: float, device: str | None = None
    ) -> WindowResult:
        frame = self._frame(samples, fs, device)
        raw, powers, rel, feats, quality = self._features(frame.mono(), fs)
        return WindowResult(
            engine_version=self.engine_version,
            fs=float(fs),
            n_samples=int(raw.size),
            band_powers=powers,
            relative_band_powers=rel,
            rel_alpha=rel["alpha"],
            quality=quality,
            features=feats,
            device=frame.device,
            montage=frame.montage,
        )

    def process_session(
        self,
        samples: Sequence[float],
        fs: float,
        labels: Sequence[str] | None = None,
        device: str | None = None,
        history: Sequence[Mapping[str, float]] | None = None,
        population_prior: Mapping[str, Sequence[float]] | None = None,
    ) -> SessionReport:
        frame = self._frame(samples, fs, device)
        mono = frame.mono()
        raw, powers, rel, feats, quality = self._features(mono, fs)

        comparison = None
        if labels is not None:
            if len(labels) != len(raw):
                raise ValueError("labels deve ter o mesmo tamanho de samples")
            closed, opened = self._split_by_condition(mono, labels)
            if closed.size and opened.size:
                comparison = self._compare(closed, opened, fs)

        return SessionReport(
            engine_version=self.engine_version,
            fs=float(fs),
            n_samples=int(raw.size),
            band_powers=powers,
            relative_band_powers=rel,
            rel_alpha=rel["alpha"],
            quality=quality,
            features=feats,
            device=frame.device,
            montage=frame.montage,
            deviations=self._deviations(feats, history, population_prior),
            comparison=comparison,
        )

    def _deviations(
        self,
        features: dict[str, float],
        history: Sequence[Mapping[str, float]] | None,
        population_prior: Mapping[str, Sequence[float]] | None,
    ) -> dict[str, dict]:
        """Desvios do baseline pessoal (ADR-0032) — o "pico → contexto".

        Sem histórico do titular, devolve `{}`: não se inventa desvio. A ciência
        (baseline, N σ, cold-start, confiança, fonte) vive em `wave_eeg.baseline`.
        """
        if not history:
            return {}
        baseline = build_baseline(history)
        prior = {k: (float(v[0]), float(v[1])) for k, v in (population_prior or {}).items()}
        devs = deviations(features, baseline, prior=prior or None)
        return {name: asdict(dev) for name, dev in devs.items()}

    def _compare(self, closed: np.ndarray, opened: np.ndarray, fs: float) -> AlphaComparison:
        res = compare_eyes_closed_open(closed, opened, fs)
        return AlphaComparison(
            eyes_closed_rel_alpha=float(res.oc_alpha),
            eyes_open_rel_alpha=float(res.oa_alpha),
            ratio=float(res.ratio),
            t_stat=float(res.t_stat),
            p_value=float(res.p_value),
            n_epochs_closed=int(res.n_oc),
            n_epochs_open=int(res.n_oa),
            passed=bool(res.passed),
            verdict=res.verdict,
        )
