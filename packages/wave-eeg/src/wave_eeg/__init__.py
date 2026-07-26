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
    total_power,
)
from .baseline import (
    DEVIATION_SIGMA,
    MIN_OBSERVATIONS,
    Deviation,
    FeatureStats,
    build_baseline,
    deviation,
    deviations,
    feature_stats,
)
from .devices import (
    KNOWN_DEVICES,
    UNKNOWN_CHANNEL,
    DeviceProfile,
    SignalFrame,
    montage_for,
    profile_for,
)
from .esense import ESENSE_CATALOG, ESENSE_NAMES, ESENSE_RELIABILITY
from .features import FEATURE_CATALOG, FeatureSpec, compute_features
from .quality import (
    QUALITY_PARAMS_VERSION,
    QualityAssessment,
    amplitude_artifact_ratio,
    assess_quality,
)
from .reader import DeviceReader, SerialReader, SimulatedReader
from .thinkgear import TGPacket, ThinkGearParser, checksum, parse_payload

__version__ = "0.5.0"
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
    "total_power",
    "compare_eyes_closed_open",
    "BANDS",
    "compute_features",
    "FEATURE_CATALOG",
    "FeatureSpec",
    "ESENSE_CATALOG",
    "ESENSE_NAMES",
    "ESENSE_RELIABILITY",
    "assess_quality",
    "amplitude_artifact_ratio",
    "QualityAssessment",
    "QUALITY_PARAMS_VERSION",
    "build_baseline",
    "feature_stats",
    "deviation",
    "deviations",
    "FeatureStats",
    "Deviation",
    "MIN_OBSERVATIONS",
    "DEVIATION_SIGMA",
    "SignalFrame",
    "DeviceProfile",
    "KNOWN_DEVICES",
    "UNKNOWN_CHANNEL",
    "montage_for",
    "profile_for",
]
