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
from typing import Mapping, Sequence


@dataclass(frozen=True)
class QualityMetrics:
    """Métricas objetivas de qualidade do sinal + veredito (ADR-0031).

    As métricas objetivas (`signal_std`, `mains_power`, `mains_power_ratio`)
    continuam **cruas e sem limiar** — honestidade visual (ADR-0027). Sobre elas,
    o ADR-0031 adiciona um **score contínuo 0..1** e uma **rejeição grossa**
    (limiares **provisórios**, versionados por `engine_version`, iterados pela
    Exp. A). Os campos de veredito têm default (retrocompatível).
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

    score: float = 1.0
    """Qualidade contínua 0..1 (1 = melhor), provisória (ADR-0031). Preserva o
    dado: não é um booleano que joga fora informação."""

    rejected: bool = False
    """Rejeição **grossa**: janela claramente inutilizável (chapada, rede quase
    total, ou amplitude de artefato na maior parte). Conservadora — não 'limpa'
    artefato residual."""

    reason: str = ""
    """Motivos da rejeição (vazio se não rejeitada)."""

    artifact_ratio: float = 0.0
    """Fração de épocas com amplitude de artefato (transientes, gate do Exp. D)."""


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
    #: Features do Catálogo N2 (DataScience/32). Aditivo e retrocompatível: os
    #: campos legados acima (`relative_band_powers`, `rel_alpha`) são derivados
    #: desta mesma fonte. Vazio em engines que não expõem o catálogo.
    features: dict[str, float] = field(default_factory=dict)
    #: Proveniência (ADR-0033): aparelho e montagem que produziram o sinal.
    #: `device` livre (ex.: "mindwave-mobile-2"); `montage` são as posições dos
    #: canais (ex.: ("FP1",) — N=1 hoje). Rastreabilidade/comparabilidade entre
    #: aparelhos, ao lado de `engine_version`.
    device: str = "unknown"
    montage: tuple[str, ...] = ()

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
    #: Features do Catálogo N2 (DataScience/32); ver `WindowResult.features`.
    features: dict[str, float] = field(default_factory=dict)
    #: Proveniência (ADR-0033); ver `WindowResult.device`/`montage`.
    device: str = "unknown"
    montage: tuple[str, ...] = ()
    #: Desvios do baseline PESSOAL (ADR-0032): feature → {n_sigma, is_peak,
    #: confidence, source}. O "pico → contexto". Vazio quando não há histórico do
    #: titular (a proveniência do baseline — pessoal/populacional/insuficiente —
    #: viaja em cada entrada, para transparência).
    deviations: dict[str, dict] = field(default_factory=dict)
    comparison: AlphaComparison | None = field(default=None)

    def to_dict(self) -> dict:
        return asdict(self)


class AnalysisEngine(ABC):
    """Interface plugável de análise. Implementação atual: `WaveEegEngine`."""

    @property
    @abstractmethod
    def engine_version(self) -> str:
        """Versão rastreável do engine, gravada em todo resultado."""

    @property
    def feature_catalog(self) -> tuple[dict[str, str], ...]:
        """Especificações **estáticas** das features expostas (nome, unidade,
        faixa, interpretação, confiabilidade, montagem — DataScience/32).

        Metadados de catálogo, não valores por sessão: por isso ficam aqui e não
        dentro de cada `WindowResult`/`SessionReport`. Default vazio; engines que
        expõem o Catálogo N2 sobrescrevem. A `reliability` ("defensável"/"cautela")
        é o que sustenta a honestidade científica na UI/relatórios (N5/N6)."""
        return ()

    @property
    def esense_catalog(self) -> tuple[dict[str, str], ...]:
        """Métricas **eSense** (proprietárias/não-validadas — ADR-0034), mantidas
        **à parte** do Catálogo N2. Sempre rotuladas; a camada primária são as
        features transparentes de `feature_catalog`. Default vazio; engines que
        incorporam o eSense sobrescrevem."""
        return ()

    def longitudinal_report(
        self,
        sessions: Sequence[Mapping[str, float]],
        quality_scores: Sequence[float] | None = None,
    ) -> dict:
        """Relatório **longitudinal** (N5) sobre as features das sessões passadas
        do titular, em ordem **cronológica**. Estatística descritiva (níveis,
        extremos, tendências), **sem interpretação clínica**. Default vazio;
        engines que o suportam sobrescrevem."""
        return {}

    def summarize_report(self, report: dict) -> list[str]:
        """Sumário em **linguagem** do relatório longitudinal — template
        **determinístico**, sem LLM (ADR-0035, N5-c). Descritivo, não-clínico.
        Default vazio; engines que o suportam sobrescrevem."""
        return []

    @abstractmethod
    def process_window(
        self,
        samples: Sequence[float],
        fs: float,
        device: str | None = None,
    ) -> WindowResult:
        """Processa uma janela de amostras (ao vivo).

        `device`, quando fornecido, carimba a proveniência (ADR-0033): o aparelho
        e a montagem derivada dele viajam no resultado.
        """

    @abstractmethod
    def process_session(
        self,
        samples: Sequence[float],
        fs: float,
        labels: Sequence[str] | None = None,
        device: str | None = None,
        history: Sequence[Mapping[str, float]] | None = None,
        population_prior: Mapping[str, Sequence[float]] | None = None,
    ) -> SessionReport:
        """Processa uma sessão completa (batch).

        `labels`, quando fornecido, é paralelo a `samples` e rotula a condição
        de cada amostra (ex.: olhos fechados/abertos), habilitando a comparação
        do Exp. B. `device` carimba a proveniência (ADR-0033).

        `history` (ADR-0032) são as features das **sessões passadas do próprio
        titular**; com ela, o relatório traz os **desvios do baseline pessoal**
        (`deviations`). `population_prior` (feature → [média, desvio]) alimenta o
        cold-start quando o histórico ainda é insuficiente.
        """
