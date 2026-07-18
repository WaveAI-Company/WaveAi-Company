"""
wave_eeg — spike de captação e análise de EEG (NeuroSky ThinkGear) do WaveAI.

Objetivo (Q-TEC-05 / ADR-0013): validar as ferramentas de conexão, extração e
análise antes de comprometer o stack do produto. Testável sem hardware via
simulador; leitura real via SerialReader (Bluetooth SPP).
"""
from .analysis import (
    BANDS,
    band_powers,
    compare_eyes_closed_open,
    relative_band_powers,
)
from .reader import DeviceReader, SerialReader, SimulatedReader
from .thinkgear import TGPacket, ThinkGearParser, checksum, parse_payload

__version__ = "0.1.0"
__all__ = [
    "ThinkGearParser",
    "TGPacket",
    "parse_payload",
    "checksum",
    "DeviceReader",
    "SimulatedReader",
    "SerialReader",
    "band_powers",
    "relative_band_powers",
    "compare_eyes_closed_open",
    "BANDS",
]
