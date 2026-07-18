"""Testes do DeviceReader — o SimulatedReader passa pelo parser real."""
from wave_eeg.reader import SimulatedReader


def test_simulated_reader_roundtrip():
    samples = [0, 10, -10, 500, -500, 32767, -32768, 3, 4, 5]
    reader = SimulatedReader(samples, fs=512, chunk=7)  # chunk pequeno força remontagem
    got = list(reader.raw_samples())
    assert got == samples


def test_simulated_reader_grande_volume():
    samples = list(range(-1000, 1000))
    reader = SimulatedReader(samples, fs=512, chunk=64)
    got = list(reader.raw_samples())
    assert got == samples
