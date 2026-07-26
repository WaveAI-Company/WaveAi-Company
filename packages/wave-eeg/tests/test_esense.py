"""eSense rotulado (proprietário/não-validado) — ADR-0034."""
from wave_eeg import (
    ESENSE_CATALOG,
    ESENSE_NAMES,
    ESENSE_RELIABILITY,
    FEATURE_CATALOG,
)
from wave_eeg.simulator import encode_esense_packet
from wave_eeg.thinkgear import ThinkGearParser


def test_esense_catalog_tem_attention_e_meditation():
    assert ESENSE_NAMES == ("attention", "meditation")
    assert {spec.name for spec in ESENSE_CATALOG} == {"attention", "meditation"}


def test_esense_e_separado_do_catalogo_transparente():
    # Guarda-corpo ADR-0034: eSense NUNCA se mistura às features transparentes.
    n2_names = {spec.name for spec in FEATURE_CATALOG}
    assert n2_names.isdisjoint(set(ESENSE_NAMES))


def test_esense_sempre_rotulado_proprietario():
    # O rótulo de confiabilidade carrega proprietária + não-validada.
    assert "propriet" in ESENSE_RELIABILITY.lower()
    assert "validad" in ESENSE_RELIABILITY.lower()
    for spec in ESENSE_CATALOG:
        assert spec.reliability == ESENSE_RELIABILITY
        # A ressalva proprietária/ADR aparece explícita na própria interpretação.
        assert "PROPRIET" in spec.interpretation.upper()
        assert "ADR-0034" in spec.interpretation


def test_esense_roundtrip_encode_decode():
    """O pacote eSense codificado é decodificado de volta pelo parser real."""
    parser = ThinkGearParser()
    pacotes = list(parser.feed(encode_esense_packet(attention=70, meditation=30)))
    assert len(pacotes) == 1
    assert pacotes[0].attention == 70
    assert pacotes[0].meditation == 30
