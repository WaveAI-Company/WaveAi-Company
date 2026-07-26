"""Veredito de qualidade de sinal — score contínuo 0..1 + rejeição grossa (ADR-0031).

**[FATO — o que o estudo sustenta]** Duas coisas ancoram os limiares aqui:
- **Rede elétrica (60 Hz) NÃO reprova sozinha:** o Relatório de Fidelidade
  (DataScience/33, RQ1) mostrou o Exp. B **passando com 88% de 60 Hz** no raw —
  o notch + alfa relativa recupera o efeito. Logo, a rede **abaixa o score**
  (suavemente, e só perto do total) mas **não** é motivo de rejeição a não ser
  quando é praticamente tudo (sinal afogado).
- **Amplitude pega os artefatos grandes:** o Exp. D (§4d) achou artefatos
  (piscada/sobrancelha/cabeça/mandíbula) com **3,6–24,5× o RMS do CLEAN**,
  **100% detectáveis** por amplitude. Aqui a versão **sem baseline pessoal** (o
  baseline é N3-c/ADR-0032) é **auto-referenciada na própria janela**: uma época
  é transiente de artefato se seu RMS passa de **um fator × a mediana** da janela.
  O fator (3×) vem do Exp. D (o **menor** artefato detectado foi 3,6×) — assim a
  variação fisiológica legítima (ex.: alfa de olhos fechados, ~1,5–2×) **não** é
  falsamente marcada. Contaminação **uniforme** (ex.: EMG contínuo = gama) escapa
  da amplitude — é o resíduo honesto do Exp. D, endereçado por assinatura
  espectral, não aqui.

**[RÍGIDO — ADR-0031]** Os limiares são **provisórios**, derivados do piloto +
Exp. D, **versionados** (via `engine_version`) e **iterados** pela distribuição
formal de qualidade (Exp. A). O score **preserva** o dado (não é um booleano que
joga fora informação) — honestidade visual (ADR-0027). A rejeição é **conservadora**:
só descarta a janela **claramente inutilizável**, nunca "limpa" artefato residual.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import signal as sp_signal

#: Rótulo dos parâmetros de qualidade — provisórios (ADR-0031), iterados pela
#: Exp. A. Muda junto com a versão do pacote (rastreável em `engine_version`).
QUALITY_PARAMS_VERSION = "q0.1-provisional"

#: Abaixo deste desvio-padrão, o sinal é chapado (eletrodo sem contato/desligado).
MIN_SIGNAL_STD = 1e-6

#: Faixa em que a rede elétrica passa a **abaixar** o score. Abaixo de LO não
#: penaliza (o relatório mostrou 0,88 ainda utilizável); de LO a HI, rampa até 0.
MAINS_SOFT_LO = 0.90
MAINS_SOFT_HI = 1.00

#: Rejeição por rede só quando é praticamente **todo** o espectro (sinal afogado).
#: Conservador de propósito: 0,88 foi utilizável (DataScience/33).
REJECT_MAINS_RATIO = 0.98

#: Época é "artefato de amplitude" se RMS > FATOR × mediana da janela. O fator
#: vem do Exp. D (menor artefato detectado = 3,6× o CLEAN); 3× deixa a variação
#: fisiológica (~1,5–2×) de fora e pega os transientes grandes.
ARTIFACT_RMS_FACTOR = 3.0
#: Mediana estável exige um mínimo de épocas; abaixo disso não se avalia transiente.
ARTIFACT_MIN_EPOCHS = 4
#: Janela inutilizável por amplitude quando **a maior parte** é transiente.
REJECT_ARTIFACT_FRACTION = 0.5


@dataclass(frozen=True)
class QualityAssessment:
    """Veredito de qualidade de uma janela/sessão (ADR-0031)."""

    score: float          # 0..1 (1 = melhor); provisório
    rejected: bool        # rejeição grossa (janela claramente inutilizável)
    reason: str           # motivos da rejeição (vazio se não rejeitada)
    artifact_ratio: float # fração de épocas com amplitude de artefato (Exp. D)


def _ramp(v: float, lo: float, hi: float) -> float:
    """0 até `lo`, sobe linear até 1 em `hi`."""
    if v <= lo:
        return 0.0
    if v >= hi:
        return 1.0
    return (v - lo) / (hi - lo)


def _epoch_rms(x: np.ndarray) -> float:
    xd = sp_signal.detrend(np.asarray(x, dtype=float))
    return float(np.sqrt(np.mean(xd * xd)))


def amplitude_artifact_ratio(
    x, fs, epoch_s: float = 1.0, factor: float = ARTIFACT_RMS_FACTOR,
    min_epochs: int = ARTIFACT_MIN_EPOCHS,
) -> float:
    """Fração de épocas cujo RMS é um **transiente** de artefato (Exp. D).

    Auto-referenciado na janela (RMS > `factor` × mediana) — não precisa de
    baseline pessoal (esse é N3-c). Janela curta demais (poucas épocas) → 0,0
    (não se inventa veredito de transiente sem amostra suficiente)."""
    x = np.asarray(x, dtype=float)
    n = int(epoch_s * fs)
    if n <= 0 or x.size < n * min_epochs:
        return 0.0
    rms = np.array([_epoch_rms(x[s:s + n]) for s in range(0, x.size - n + 1, n)])
    if rms.size < min_epochs:
        return 0.0
    med = float(np.median(rms))
    if med <= 0:
        return 0.0
    return float(np.mean(rms > factor * med))


def assess_quality(
    x, fs, *, mains_power_ratio: float, signal_std: float, epoch_s: float = 1.0
) -> QualityAssessment:
    """Score 0..1 + rejeição grossa a partir das métricas objetivas.

    `mains_power_ratio` e `signal_std` são medidos no sinal **bruto** (o notch
    removeria justamente o 60 Hz que se quer quantificar) — calculados pelo
    chamador; aqui só se combina + decide, com limiares provisórios (ADR-0031).
    """
    flat = signal_std < MIN_SIGNAL_STD
    artifact_ratio = amplitude_artifact_ratio(x, fs, epoch_s=epoch_s)

    mains_penalty = _ramp(float(mains_power_ratio), MAINS_SOFT_LO, MAINS_SOFT_HI)
    score = (1.0 - mains_penalty) * (1.0 - min(artifact_ratio, 1.0))
    if flat:
        score = 0.0
    score = float(min(1.0, max(0.0, score)))

    reasons = []
    if flat:
        reasons.append("sinal chapado (sem contato)")
    if float(mains_power_ratio) >= REJECT_MAINS_RATIO:
        reasons.append("rede elétrica dominante")
    if artifact_ratio >= REJECT_ARTIFACT_FRACTION:
        reasons.append("amplitude de artefato na maior parte da janela")

    return QualityAssessment(
        score=score,
        rejected=bool(reasons),
        reason="; ".join(reasons),
        artifact_ratio=float(artifact_ratio),
    )
