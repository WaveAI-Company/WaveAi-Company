"""Implementação v0 do `AnalysisEngine` sobre o pacote `wave_eeg`.

Toda a matemática (PSD de Welch, potências de banda, pré-processamento e o
teste do alfa do Exp. B) vive em `packages/wave-eeg` — aqui só a adaptação ao
contrato. Nada de DSP novo neste arquivo.
"""

from __future__ import annotations

from typing import Sequence

import numpy as np
import wave_eeg
from wave_eeg.analysis import (
    band_powers,
    compare_eyes_closed_open,
    mains_power,
    preprocess,
    relative_band_powers,
    total_power,
)

from .base import (
    AlphaComparison,
    AnalysisEngine,
    QualityMetrics,
    SessionReport,
    WindowResult,
)

#: Versão desta adaptação. Combinada com a versão do pacote de análise para dar
#: rastreabilidade completa do resultado (o wrapper evolui independentemente).
IMPL_VERSION = "0.1.0"

#: Rótulos aceitos por condição (Exp. B), espelhando o CLI do `wave_eeg`.
EYES_CLOSED_LABELS = frozenset({"OC", "OF", "EYES_CLOSED", "FECHADO", "FECHADOS"})
EYES_OPEN_LABELS = frozenset({"OA", "EYES_OPEN", "ABERTO", "ABERTOS"})


class WaveEegEngine(AnalysisEngine):
    """Engine v0: embrulha `wave_eeg` atrás do contrato `AnalysisEngine`."""

    @property
    def engine_version(self) -> str:
        return f"WaveEegEngine/{IMPL_VERSION}+wave_eeg/{wave_eeg.__version__}"

    # -- helpers ---------------------------------------------------------

    def _quality(self, x: np.ndarray, fs: float) -> QualityMetrics:
        """Qualidade medida no sinal **bruto** (o notch removeria a rede).

        O denominador é a potência do **espectro inteiro**, não a soma das
        bandas: elas param em 45 Hz, e os 60 Hz da rede ficariam fora do total
        — a "fração" passava de 1. Uma captação real deu 153% antes disto.
        """
        mains = float(mains_power(x, fs))
        total = float(total_power(x, fs))
        return QualityMetrics(
            signal_std=float(np.std(x)),
            mains_power=mains,
            mains_power_ratio=float(mains / total) if total else 0.0,
        )

    def _features(self, samples: Sequence[float], fs: float):
        """Pré-processa e extrai potências de banda (absolutas e relativas)."""
        raw = np.asarray(samples, dtype=float)
        filtered = preprocess(raw, fs)
        powers = {k: float(v) for k, v in band_powers(filtered, fs).items()}
        rel = {k: float(v) for k, v in relative_band_powers(filtered, fs).items()}
        # Qualidade é medida no sinal BRUTO: o notch do pré-processamento
        # removeria justamente o 60 Hz que queremos quantificar.
        quality = self._quality(raw, fs)
        return raw, powers, rel, quality

    def _split_by_condition(self, samples: Sequence[float], labels: Sequence[str]):
        raw = np.asarray(samples, dtype=float)
        tags = np.asarray([str(v).strip().upper() for v in labels])
        closed = raw[np.isin(tags, list(EYES_CLOSED_LABELS))]
        opened = raw[np.isin(tags, list(EYES_OPEN_LABELS))]
        return closed, opened

    # -- contrato --------------------------------------------------------

    def process_window(self, samples: Sequence[float], fs: float) -> WindowResult:
        raw, powers, rel, quality = self._features(samples, fs)
        return WindowResult(
            engine_version=self.engine_version,
            fs=float(fs),
            n_samples=int(raw.size),
            band_powers=powers,
            relative_band_powers=rel,
            rel_alpha=rel["alpha"],
            quality=quality,
        )

    def process_session(
        self,
        samples: Sequence[float],
        fs: float,
        labels: Sequence[str] | None = None,
    ) -> SessionReport:
        raw, powers, rel, quality = self._features(samples, fs)

        comparison = None
        if labels is not None:
            if len(labels) != len(raw):
                raise ValueError("labels deve ter o mesmo tamanho de samples")
            closed, opened = self._split_by_condition(samples, labels)
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
            comparison=comparison,
        )

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
