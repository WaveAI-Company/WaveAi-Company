"""Mede, no stack local, quanto tempo cada falha leva para ser percebida.

Sinal 100% SINTÉTICO (seno + ruído), device rotulado "medicao-sintetica".
Cenário B: app congelado com rede boa (o socket responde ping, amostras param).
Cenário A: rede some (ninguém responde ping — loop do cliente bloqueado).
Um espectador SSE (/me/live) registra o que o painel recebe e quando.

Uso (com `docker compose up -d` e o seed de dev rodando em infra/):
    services/api/.venv/Scripts/python.exe medir_deteccao.py [silencio_s] [bloqueio_s]
"""

from __future__ import annotations

import asyncio
import json
import math
import random
import sys
import threading
import time

import httpx
from websockets.asyncio.client import connect as aconnect
from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect as sconnect

BASE = "http://localhost:8000"
WS = "ws://localhost:8000/stream"
T0 = time.monotonic()
eventos: list[tuple[float, str]] = []


def agora() -> float:
    return round(time.monotonic() - T0, 2)


def log(msg: str) -> None:
    print(f"[{agora():7.2f}s] {msg}", flush=True)


def bloco(n: int, fase: float) -> list[int]:
    return [
        int(80 * math.sin(2 * math.pi * 10 * (fase + i) / 512) + random.gauss(0, 20))
        for i in range(n)
    ]


def espectador(token: str, parar: threading.Event) -> None:
    cabecalho = {"Authorization": f"Bearer {token}"}
    with httpx.stream("GET", f"{BASE}/me/live", headers=cabecalho, timeout=None) as r:
        tipo = ""
        for linha in r.iter_lines():
            if parar.is_set():
                return
            if linha.startswith(":"):
                eventos.append((agora(), "keepalive"))
            elif linha.startswith("event:"):
                tipo = linha[6:].strip()
            elif linha.startswith("data:"):
                dado = json.loads(linha[5:])
                eventos.append((agora(), dado.get("type", tipo)))
                if dado.get("type", tipo) in ("ended", "closed", "status"):
                    log(f"ESPECTADOR recebeu {dado.get('type', tipo)}: {dado}")


def eventos_entre(a: float, b: float) -> dict[str, int]:
    c: dict[str, int] = {}
    for t, e in eventos:
        if a <= t <= b:
            c[e] = c.get(e, 0) + 1
    return c


def cenario_b(token: str, silencio: float) -> None:
    log("== CENÁRIO B: app congelado, rede boa (pong automático, amostras param)")
    with sconnect(WS, ping_interval=None) as ws:
        ws.send(json.dumps({"type": "auth", "token": token}))
        log(f"auth -> {json.loads(ws.recv())['type']}")
        inicio = {"type": "start", "device": "medicao-sintetica", "sample_rate": 512}
        ws.send(json.dumps(inicio))
        log(f"start -> {json.loads(ws.recv())}")
        fase = 0
        for seq in range(1, 25):  # 24 blocos x 256 = 6144 amostras = 12 s
            ws.send(json.dumps({"type": "samples", "seq": seq, "data": bloco(256, fase)}))
            fase += 256
            ws.recv()
            time.sleep(0.5)
        ultimo = agora()
        log(f"último frame enviado; silêncio de {silencio:.0f} s com o socket aberto")
        try:
            msg = ws.recv(timeout=silencio)
            log(f"servidor mandou algo durante o silêncio: {msg[:120]}")
        except TimeoutError:
            log("servidor NÃO fechou nem mandou nada durante o silêncio")
        except ConnectionClosed as exc:
            log(f"servidor FECHOU após {agora() - ultimo:.1f} s: {exc}")
            return
        log(f"espectador no silêncio: {eventos_entre(ultimo + 0.3, agora())}")
        ws.send(json.dumps({"type": "stop"}))
        fim = json.loads(ws.recv())
        log(f"stop -> {fim['type']} sample_count={fim.get('sample_count')} "
            f"result={fim.get('result')}")


async def cenario_a(token: str, bloqueio: float) -> None:
    log("== CENÁRIO A: rede some (sem pong: loop do cliente bloqueado)")
    async with aconnect(WS, ping_interval=None) as ws:
        await ws.send(json.dumps({"type": "auth", "token": token}))
        await ws.recv()
        inicio = {"type": "start", "device": "medicao-sintetica", "sample_rate": 512}
        await ws.send(json.dumps(inicio))
        log(f"start -> {json.loads(await ws.recv())}")
        fase = 0
        for seq in range(1, 25):
            await ws.send(json.dumps({"type": "samples", "seq": seq, "data": bloco(256, fase)}))
            fase += 256
            await ws.recv()
            await asyncio.sleep(0.5)
        ultimo = agora()
        log(f"último frame; bloqueando o loop {bloqueio:.0f} s (nenhum pong sai)")
        time.sleep(bloqueio)  # bloqueia de propósito: simula rádio sem rede
        fins = [t for t, e in eventos if e == "ended" and t > ultimo]
        if fins:
            log(f"ESPECTADOR soube da queda {fins[0] - ultimo:.1f} s após o último frame")
        else:
            log("espectador NÃO recebeu ended dentro do bloqueio")
        log(f"espectador no intervalo: {eventos_entre(ultimo + 0.3, agora())}")
        try:
            await asyncio.wait_for(ws.recv(), timeout=3)
        except ConnectionClosed as exc:
            log(f"cliente vê o socket fechado: {exc}")
        except TimeoutError:
            log("cliente: socket ainda parece aberto")


def main() -> None:
    silencio = float(sys.argv[1]) if len(sys.argv) > 1 else 150
    bloqueio = float(sys.argv[2]) if len(sys.argv) > 2 else 90
    r = httpx.post(
        f"{BASE}/auth/login",
        json={"email": "paciente.um@example.com", "password": "senha-de-teste-bem-longa-7"},
    )
    r.raise_for_status()
    token = r.json()["access_token"]
    parar = threading.Event()
    threading.Thread(target=espectador, args=(token, parar), daemon=True).start()
    time.sleep(1.5)
    cenario_b(token, silencio)
    time.sleep(3)
    asyncio.run(cenario_a(token, bloqueio))
    parar.set()


if __name__ == "__main__":
    main()
