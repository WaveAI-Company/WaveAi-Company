"""
Camada de abstração de dispositivo (DeviceReader) — implementa a interface
recomendada em Architecture/21 (anti-corrupção, mitiga o risco R-07).

- SimulatedReader: sem hardware, para testes/CI e cenários controlados.
- SerialReader: leitura real via porta serial (Bluetooth SPP), pyserial em import lazy.

Ambos passam pelo MESMO parser (ThinkGearParser), então os testes exercitam o
código de produção real.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable, Iterator

from .simulator import simulate_stream
from .thinkgear import TGPacket, ThinkGearParser


def _chunked(byte_iter: Iterable[bytes], size: int) -> Iterator[bytes]:
    """Reagrupa um iterável de bytes em blocos de tamanho fixo (simula fragmentação de I/O)."""
    buf = bytearray()
    for b in byte_iter:
        buf.extend(b)
        while len(buf) >= size:
            yield bytes(buf[:size])
            del buf[:size]
    if buf:
        yield bytes(buf)


class DeviceReader(ABC):
    """Interface estável, independente de transporte/biblioteca."""

    @abstractmethod
    def packets(self) -> Iterator[TGPacket]:
        """Itera pacotes ThinkGear decodificados."""

    def raw_samples(self) -> Iterator[int]:
        """Conveniência: itera apenas as amostras raw (512 Hz)."""
        for pkt in self.packets():
            yield from pkt.raw_samples


class SimulatedReader(DeviceReader):
    """Lê de um stream simulado (bytes gerados a partir de `samples`).

    `attention`/`meditation` são opt-in (ADR-0034): quando informados, o stream
    simulado passa a injetar pacotes eSense — útil para exercitar a captação
    dessas métricas sem hardware. Default `None` = só raw + poor_signal.
    """

    def __init__(
        self,
        samples: Iterable[int],
        fs: int = 512,
        chunk: int = 64,
        attention: int | None = None,
        meditation: int | None = None,
    ) -> None:
        self._samples = samples
        self.fs = fs
        self.chunk = chunk
        self._attention = attention
        self._meditation = meditation

    def packets(self) -> Iterator[TGPacket]:
        parser = ThinkGearParser()
        stream = simulate_stream(
            self._samples, self.fs,
            attention=self._attention, meditation=self._meditation,
        )
        for block in _chunked(stream, self.chunk):
            yield from parser.feed(block)


class SerialReader(DeviceReader):
    """
    Leitor real via porta serial (SPP). Requer pyserial e o dispositivo pareado.
    Baud padrão do MindWave Mobile em modo raw: 57600.
    """

    def __init__(
        self,
        port: str,
        baudrate: int = 57600,
        timeout: float = 1.0,
        read_size: int = 512,
    ) -> None:
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.read_size = read_size

    def packets(self) -> Iterator[TGPacket]:
        try:
            import serial  # import lazy: só necessário para hardware real
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "pyserial não instalado. Rode: pip install pyserial"
            ) from exc
        parser = ThinkGearParser()
        with serial.Serial(self.port, self.baudrate, timeout=self.timeout) as ser:
            while True:
                data = ser.read(self.read_size)
                if data:
                    yield from parser.feed(data)
