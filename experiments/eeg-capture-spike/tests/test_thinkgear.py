"""Testes do parser ThinkGear — rodam sem hardware (usam o simulador)."""
from wave_eeg.simulator import encode_poor_signal_packet, encode_raw_packet
from wave_eeg.thinkgear import ThinkGearParser


def test_raw_roundtrip_positivo_e_negativo():
    parser = ThinkGearParser()
    samples = [0, 1, -1, 100, -100, 32767, -32768]
    data = b"".join(encode_raw_packet(s) for s in samples)
    got = []
    for pkt in parser.feed(data):
        got.extend(pkt.raw_samples)
    assert got == samples
    assert parser.bad_checksums == 0


def test_checksum_detecta_corrupcao():
    parser = ThinkGearParser()
    corrupt = bytearray(encode_raw_packet(123))
    corrupt[-1] ^= 0xFF  # inverte o checksum
    out = list(parser.feed(bytes(corrupt)))
    assert all(not p.raw_samples for p in out)
    assert parser.bad_checksums >= 1


def test_poor_signal_parseado():
    parser = ThinkGearParser()
    pkts = list(parser.feed(encode_poor_signal_packet(0) + encode_raw_packet(5)))
    assert any(p.poor_signal == 0 for p in pkts)


def test_pacotes_divididos_entre_chunks():
    """O parser deve remontar pacotes fragmentados entre chamadas de feed()."""
    parser = ThinkGearParser()
    data = b"".join(encode_raw_packet(s) for s in range(50))
    got = []
    for i in range(0, len(data), 3):  # feed em blocos minúsculos de 3 bytes
        for pkt in parser.feed(data[i:i + 3]):
            got.extend(pkt.raw_samples)
    assert got == list(range(50))


def test_lixo_antes_do_sync_e_ignorado():
    parser = ThinkGearParser()
    data = b"\x00\x11\x22" + encode_raw_packet(77)  # ruído antes do SYNC
    got = [s for pkt in parser.feed(data) for s in pkt.raw_samples]
    assert got == [77]
