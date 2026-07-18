"""
Simulador do stream ThinkGear: amostras (int) -> bytes do protocolo.

Permite testar parser + pipeline de análise **sem hardware** (inclusive em CI)
e reproduzir cenários controlados (ex.: sinal com alfa conhecido).
"""
from __future__ import annotations

from typing import Iterable, Iterator

from .thinkgear import CODE_POOR_SIGNAL, CODE_RAW, SYNC, checksum


def _packet(payload: bytes) -> bytes:
    return bytes([SYNC, SYNC, len(payload)]) + payload + bytes([checksum(payload)])


def encode_raw_packet(sample: int) -> bytes:
    """Codifica uma amostra raw (int16 com sinal) como pacote ThinkGear (code 0x80)."""
    val = int(sample) & 0xFFFF
    payload = bytes([CODE_RAW, 0x02, (val >> 8) & 0xFF, val & 0xFF])
    return _packet(payload)


def encode_poor_signal_packet(value: int) -> bytes:
    """Codifica um pacote de qualidade de sinal (code 0x02)."""
    payload = bytes([CODE_POOR_SIGNAL, int(value) & 0xFF])
    return _packet(payload)


def simulate_stream(
    samples: Iterable[int],
    fs: int = 512,
    poor_signal_every_s: float = 1.0,
) -> Iterator[bytes]:
    """
    Gera o fluxo de bytes de um dispositivo: um pacote raw por amostra,
    com um pacote de poor_signal inserido periodicamente (como o hardware real).
    Amostras são saturadas para o intervalo int16.
    """
    interval = max(1, int(fs * poor_signal_every_s))
    for n, s in enumerate(samples):
        if n % interval == 0:
            yield encode_poor_signal_packet(0)
        s = int(max(-32768, min(32767, int(s))))
        yield encode_raw_packet(s)
