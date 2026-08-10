"""Modelo de sinal **device-agnóstico** e registro de montagem (ADR-0033).

Forward-proofing sem drivers novos: hoje o NeuroSky é **canal único (FP1)**, mas
a ciência/DSP embute essa suposição. Aqui generalizamos o **tipo interno de
amostra** para um **quadro multicanal** (`SignalFrame`: canais × amostras + fs +
montagem + device), com o NeuroSky preenchendo **N=1**. Subir para multicanal
(ex.: Muse 2) passa a ser um refactor contido, não um rewrite.

**[FATO — limite explícito da ADR-0033]** a **montagem** (FP1 vs TP9/AF7/AF8/TP10)
muda o que é mensurável e a estratégia de artefato; isso **re-deriva-se por
aparelho** e nenhuma abstração de código remove. Este módulo só carrega a
montagem como **metadado de proveniência** — não faz ciência espacial (que só
existe com >1 canal).
"""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

#: Rótulo genérico de um canal cuja posição no escalpo não foi declarada. Mais
#: honesto que assumir "FP1" para um device desconhecido — a posição é o que a
#: ciência depende, então não a inventamos.
UNKNOWN_CHANNEL = "CH1"


@dataclass(frozen=True)
class DeviceProfile:
    """Perfil de um aparelho conhecido: sua montagem e taxa nativa.

    A montagem é a lista **ordenada** de posições (sistema 10-20) que cada canal
    ocupa. Para o NeuroSky é canal único em FP1.
    """

    device_id: str
    montage: tuple[str, ...]
    fs_native: int

    @property
    def n_channels(self) -> int:
        return len(self.montage)


#: Montagem do NeuroSky MindWave (família): eletrodo seco único em FP1.
_MINDWAVE_MONTAGE = ("FP1",)

#: Aparelhos conhecidos → perfil. Estende-se sem tocar no resto (ex.: Muse 2
#: entraria aqui com ("TP9","AF7","AF8","TP10") quando/se for adotado). As
#: chaves são normalizadas (minúsculas, sem espaços nas bordas) por `_norm`.
KNOWN_DEVICES: dict[str, DeviceProfile] = {
    "mindwave-mobile-2": DeviceProfile("mindwave-mobile-2", _MINDWAVE_MONTAGE, 512),
    "mindwave-mobile": DeviceProfile("mindwave-mobile", _MINDWAVE_MONTAGE, 512),
    "mindwave": DeviceProfile("mindwave", _MINDWAVE_MONTAGE, 512),
    # O simulador emula o NeuroSky (mesma montagem N=1); usado em CI/dev.
    "simulador": DeviceProfile("simulador", _MINDWAVE_MONTAGE, 512),
    "simulator": DeviceProfile("simulator", _MINDWAVE_MONTAGE, 512),
}


def _norm(device: str | None) -> str:
    return (device or "").strip().lower()


def profile_for(device: str | None) -> DeviceProfile | None:
    """Perfil do aparelho, se conhecido; senão `None`."""
    return KNOWN_DEVICES.get(_norm(device))


def montage_for(device: str | None) -> tuple[str, ...]:
    """Montagem (posições dos canais) de um aparelho.

    Aparelho conhecido → sua montagem real. Desconhecido (ou ausente) → tupla
    **vazia**: não sabemos as posições e não as inventamos. Quem monta um
    `SignalFrame` a partir disso cai no rótulo genérico `UNKNOWN_CHANNEL`.
    """
    profile = profile_for(device)
    return profile.montage if profile is not None else ()


@dataclass(frozen=True)
class SignalFrame:
    """Quadro de sinal **canais × amostras** + proveniência (ADR-0033).

    Hoje sempre N=1 (NeuroSky), mas o tipo já é multicanal para que features
    espaciais e ICA (indisponíveis com 1 canal — DataScience/30 §2) sejam
    **aditivos** quando houver aparelho com >1 canal.
    """

    samples: np.ndarray  # shape (n_channels, n_samples)
    fs: float
    device: str
    montage: tuple[str, ...]

    def __post_init__(self) -> None:
        if self.samples.ndim != 2:
            raise ValueError("samples deve ser 2D (canais × amostras)")
        if len(self.montage) != self.samples.shape[0]:
            raise ValueError("montage deve ter um rótulo por canal")

    @classmethod
    def single_channel(
        cls,
        samples: Sequence[float],
        fs: float,
        device: str,
        montage: Sequence[str] | None = None,
    ) -> SignalFrame:
        """Constrói um quadro **N=1** a partir de amostras 1D (caso NeuroSky).

        A montagem, se não informada, é resolvida pelo registro do device; se o
        device for desconhecido, usa-se `UNKNOWN_CHANNEL` (um canal, posição não
        declarada) — o invariante "um rótulo por canal" é preservado.
        """
        arr = np.asarray(samples, dtype=float).reshape(1, -1)
        if montage is None:
            resolved = montage_for(device) or (UNKNOWN_CHANNEL,)
        else:
            resolved = tuple(montage)
        return cls(samples=arr, fs=float(fs), device=device, montage=resolved)

    @property
    def n_channels(self) -> int:
        return int(self.samples.shape[0])

    @property
    def n_samples(self) -> int:
        return int(self.samples.shape[1])

    def channel(self, index: int = 0) -> np.ndarray:
        """Amostras de um canal (1D)."""
        return self.samples[index]

    def mono(self) -> np.ndarray:
        """Atalho para o único canal. Erra se o quadro for multicanal — é o
        ponto onde o DSP single-channel de hoje precisa ser generalizado."""
        if self.n_channels != 1:
            raise ValueError("mono() só se aplica a quadros de canal único (N=1)")
        return self.samples[0]
