"""Contrato de análise do WaveAI (`AnalysisEngine`).

Este é o **contrato que protege o futuro** (ver `Architecture/22`, §5): a API e a
UI dependem apenas desta interface, nunca de uma implementação concreta. Evoluir
a ciência = nova implementação/versão do engine, sem tocar em app/API.

Regra rígida: **todo resultado carrega `engine_version`** (rastreabilidade).
Nenhum resultado aqui tem interpretação clínica — as métricas são exploratórias.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Sequence


@dataclass(frozen=True)
class QualityMetrics:
    """Métricas objetivas de qualidade do sinal.

    Deliberadamente **sem limiar e sem veredito**: o que conta como sinal
    "bom o suficiente" ainda não está definido (ver Q-TEC-06 em
    `04_Open_Questions.md`). Aqui só medimos; a interpretação vem depois.
    """

    signal_std: float
    """Desvio-padrão do sinal bruto (proxy de amplitude/contato)."""

    mains_power: float
    """Potência absoluta ao redor da rede elétrica (60 Hz)."""

    mains_power_ratio: float
    """Fração da potência do **espectro inteiro** concentrada na rede (0..1).

    O denominador é o espectro completo (0..Nyquist), e não a soma das `BANDS`
    — que param em 45 Hz e deixariam os 60 Hz da rede de fora, permitindo
    razões acima de 1.
    """


@dataclass(frozen=True)
class WindowResult:
    """Resultado de uma janela (modo streaming)."""

    engine_version: str
    fs: float
    n_samples: int
    band_powers: dict[str, float]
    relative_band_powers: dict[str, float]
    rel_alpha: float
    quality: QualityMetrics

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class AlphaComparison:
    """Comparação de alfa relativa entre condições (Exp. B: olhos fechados vs. abertos)."""

    eyes_closed_rel_alpha: float
    eyes_open_rel_alpha: float
    ratio: float
    t_stat: float
    p_value: float
    n_epochs_closed: int
    n_epochs_open: int
    passed: bool
    verdict: str


@dataclass(frozen=True)
class SessionReport:
    """Relatório de uma sessão inteira (modo batch)."""

    engine_version: str
    fs: float
    n_samples: int
    band_powers: dict[str, float]
    relative_band_powers: dict[str, float]
    rel_alpha: float
    quality: QualityMetrics
    comparison: AlphaComparison | None = field(default=None)

    def to_dict(self) -> dict:
        return asdict(self)


class AnalysisEngine(ABC):
    """Interface plugável de análise. Implementação atual: `WaveEegEngine`."""

    @property
    @abstractmethod
    def engine_version(self) -> str:
        """Versão rastreável do engine, gravada em todo resultado."""

    @abstractmethod
    def process_window(self, samples: Sequence[float], fs: float) -> WindowResult:
        """Processa uma janela de amostras (ao vivo)."""

    @abstractmethod
    def process_session(
        self,
        samples: Sequence[float],
        fs: float,
        labels: Sequence[str] | None = None,
    ) -> SessionReport:
        """Processa uma sessão completa (batch).

        `labels`, quando fornecido, é paralelo a `samples` e rotula a condição
        de cada amostra (ex.: olhos fechados/abertos), habilitando a comparação
        do Exp. B.
        """
