"""
Parser do protocolo ThinkGear (NeuroSky) — stream de bytes -> eventos estruturados.

Referências (verificadas):
- ThinkGear Communications Protocol (developer.neurosky.com).
- Pacote: 0xAA 0xAA [PLENGTH] [PAYLOAD...] [CHECKSUM].
- checksum = (~(sum(payload) & 0xFF)) & 0xFF.
- Raw EEG (code 0x80): 2 bytes big-endian, complemento de dois (16 bits), até 512 Hz.

Este módulo é puro (sem dependências de hardware) e, portanto, 100% testável em CI.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterator, List, Optional

SYNC = 0xAA

# Códigos de dado (DataRow codes)
CODE_POOR_SIGNAL = 0x02      # 1 byte  (0=ótimo, 200=sem contato)
CODE_ATTENTION = 0x04        # 1 byte  eSense (0-100) — proprietário, usar com cautela
CODE_MEDITATION = 0x05       # 1 byte  eSense (0-100) — proprietário, usar com cautela
CODE_BLINK = 0x16            # 1 byte  força da piscada
CODE_RAW = 0x80              # 2 bytes raw EEG (big-endian, com sinal)
CODE_ASIC_EEG_POWER = 0x83   # 24 bytes: 8 bandas x 3 bytes (big-endian, sem sinal)

BAND_NAMES = (
    "delta", "theta", "low_alpha", "high_alpha",
    "low_beta", "high_beta", "low_gamma", "mid_gamma",
)

_MAX_PLENGTH = 169  # PLENGTH válido é 0..169 (170 = 0xAA reservado ao SYNC)


@dataclass
class TGPacket:
    """Conteúdo decodificado de um pacote ThinkGear."""
    raw_samples: List[int] = field(default_factory=list)
    poor_signal: Optional[int] = None
    attention: Optional[int] = None
    meditation: Optional[int] = None
    blink: Optional[int] = None
    eeg_power: Optional[dict] = None


def checksum(payload: bytes) -> int:
    """Checksum ThinkGear = complemento de 1 da soma (mascarada em 8 bits) do payload."""
    return (~(sum(payload) & 0xFF)) & 0xFF


def _decode_raw(hi: int, lo: int) -> int:
    val = (hi << 8) | lo
    if val >= 0x8000:  # complemento de dois em 16 bits
        val -= 0x10000
    return val


def parse_payload(payload: bytes) -> TGPacket:
    """Decodifica o payload (sequência de DataRows) em um TGPacket."""
    pkt = TGPacket()
    i, n = 0, len(payload)
    while i < n:
        # EXCODE (0x55) — apenas incrementa o nível de código estendido; ignorado aqui
        while i < n and payload[i] == 0x55:
            i += 1
        if i >= n:
            break
        code = payload[i]
        i += 1
        if code >= 0x80:
            if i >= n:
                break
            vlen = payload[i]
            i += 1
            value = payload[i:i + vlen]
            i += vlen
            if code == CODE_RAW and len(value) == 2:
                pkt.raw_samples.append(_decode_raw(value[0], value[1]))
            elif code == CODE_ASIC_EEG_POWER and len(value) == 24:
                pkt.eeg_power = {
                    name: (value[3 * k] << 16) | (value[3 * k + 1] << 8) | value[3 * k + 2]
                    for k, name in enumerate(BAND_NAMES)
                }
        else:
            if i >= n:
                break
            value = payload[i]
            i += 1
            if code == CODE_POOR_SIGNAL:
                pkt.poor_signal = value
            elif code == CODE_ATTENTION:
                pkt.attention = value
            elif code == CODE_MEDITATION:
                pkt.meditation = value
            elif code == CODE_BLINK:
                pkt.blink = value
    return pkt


class ThinkGearParser:
    """
    Máquina de estados incremental e tolerante a fragmentação.

    Uso:
        parser = ThinkGearParser()
        for pkt in parser.feed(chunk_de_bytes):
            ...
    Pacotes divididos entre chamadas de feed() são remontados automaticamente.
    Pacotes com checksum inválido são descartados (contados em .bad_checksums).
    """

    def __init__(self) -> None:
        self._buf = bytearray()
        self.bad_checksums = 0
        self.packets_parsed = 0

    def feed(self, data: bytes) -> Iterator[TGPacket]:
        buf = self._buf
        buf.extend(data)
        while True:
            # localizar o par de SYNC (0xAA 0xAA)
            start = -1
            for i in range(len(buf) - 1):
                if buf[i] == SYNC and buf[i + 1] == SYNC:
                    start = i
                    break
            if start == -1:
                # nenhum SYNC completo: preservar no máximo 1 byte (meio-SYNC)
                if len(buf) > 1:
                    del buf[:len(buf) - 1]
                return
            if start > 0:
                del buf[:start]  # descarta lixo antes do SYNC
            if len(buf) < 3:
                return
            plength = buf[2]
            if plength == SYNC or plength > _MAX_PLENGTH:
                del buf[:1]  # PLENGTH inválido: re-sincroniza
                continue
            total = 3 + plength + 1
            if len(buf) < total:
                return  # aguardar mais bytes
            payload = bytes(buf[3:3 + plength])
            if checksum(payload) != buf[3 + plength]:
                self.bad_checksums += 1
                del buf[:2]  # descarta os SYNC e tenta re-sincronizar
                continue
            self.packets_parsed += 1
            del buf[:total]
            yield parse_payload(payload)
