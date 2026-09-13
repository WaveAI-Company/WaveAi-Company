"""Falhas parciais no stack local. Sinal 100% SINTÉTICO ("medicao-sintetica").

C  latência local: frame -> ack e frame que fecha janela -> evento no espectador
D  Analysis pausada: o gateway chama a Analysis de forma síncrona — a API inteira trava?
F1 Postgres pausado (sem resposta) no meio da captação
F2 Postgres parado (conexão recusada) no meio da captação
E  espectadores SSE seguram conexão do pool? (16 assinaturas + 1 REST)

Uso (com `docker compose up -d` e o seed de dev rodando em infra/):
    services/api/.venv/Scripts/python.exe medir_parciais.py
"""

from __future__ import annotations

import json
import math
import random
import statistics
import subprocess
import threading
import time
from pathlib import Path

import httpx
from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect

BASE = "http://localhost:8000"
WS = "ws://localhost:8000/stream"
RAIZ_REPO = Path(__file__).resolve().parents[4]
COMPOSE = ["docker", "compose", "-f", str(RAIZ_REPO / "infra" / "docker-compose.yml")]
T0 = time.monotonic()


def agora() -> float:
    return time.monotonic() - T0


def log(msg: str) -> None:
    print(f"[{agora():7.2f}s] {msg}", flush=True)


def compose(*args: str) -> None:
    subprocess.run([*COMPOSE, *args], check=True, capture_output=True)


def bloco(fase: int) -> list[int]:
    return [
        int(80 * math.sin(2 * math.pi * 10 * (fase + i) / 512) + random.gauss(0, 20))
        for i in range(256)
    ]


def p(vals: list[float], q: float) -> float:
    s = sorted(vals)
    return s[min(len(s) - 1, round(q * (len(s) - 1)))]


class Sonda(threading.Thread):
    """Mede /health a cada 0,5 s (rota que NÃO toca o banco)."""

    def __init__(self) -> None:
        super().__init__(daemon=True)
        self.parar = threading.Event()
        self.amostras: list[tuple[float, float, str]] = []

    def run(self) -> None:
        with httpx.Client(timeout=60) as c:
            while not self.parar.is_set():
                t = agora()
                try:
                    r = c.get(f"{BASE}/health")
                    self.amostras.append((t, agora() - t, str(r.status_code)))
                except Exception as exc:
                    self.amostras.append((t, agora() - t, type(exc).__name__))
                time.sleep(0.5)


class Espectador(threading.Thread):
    def __init__(self, token: str) -> None:
        super().__init__(daemon=True)
        self.token = token
        self.eventos: list[tuple[float, str, int]] = []

    def run(self) -> None:
        cabecalho = {"Authorization": f"Bearer {self.token}"}
        try:
            with httpx.stream(
                "GET", f"{BASE}/me/live", headers=cabecalho, timeout=None
            ) as r:
                for linha in r.iter_lines():
                    if linha.startswith("data:"):
                        d = json.loads(linha[5:])
                        tamanho = len(linha.encode()) + 1
                        self.eventos.append((agora(), d.get("type", "status"), tamanho))
        except Exception:
            return


def abrir(token: str):
    ws = connect(WS, ping_interval=None, open_timeout=60)
    ws.send(json.dumps({"type": "auth", "token": token}))
    ws.recv()
    ws.send(json.dumps({"type": "start", "device": "medicao-sintetica", "sample_rate": 512}))
    return ws, json.loads(ws.recv())["session_id"]


def enviar(ws, seq: int, fase: int, timeout: float = 90) -> tuple[float, dict]:
    t = agora()
    ws.send(json.dumps({"type": "samples", "seq": seq, "data": bloco(fase)}))
    resp = json.loads(ws.recv(timeout=timeout))
    return agora() - t, resp


def enviar_normal(ws, seq: int, n: int) -> int:
    """Envia `n` frames no ritmo de 0,5 s e devolve o próximo `seq`."""
    for _ in range(n):
        enviar(ws, seq, (seq - 1) * 256)
        seq += 1
        time.sleep(0.5)
    return seq


def cenario_c(token: str) -> None:
    log("== C: latência local (60 s de captação)")
    esp = Espectador(token)
    esp.start()
    time.sleep(1.5)
    ws, _ = abrir(token)
    acks, janelas_envio = [], []
    for seq in range(1, 121):
        t_envio = agora()
        dt, resp = enviar(ws, seq, (seq - 1) * 256)
        acks.append(dt)
        if resp.get("features") is not None:
            janelas_envio.append(t_envio)
        time.sleep(max(0.0, 0.5 - dt))
    ws.send(json.dumps({"type": "stop"}))
    ws.recv(timeout=60)
    ws.close()
    time.sleep(1)
    feats = [t for t, e, _ in esp.eventos if e == "features"]
    atrasos = [f - s for s, f in zip(janelas_envio, feats, strict=False)]
    tamanhos = [b for _, e, b in esp.eventos if e == "features"]
    log(f"acks: n={len(acks)} mediana={statistics.median(acks) * 1000:.0f} ms "
        f"p95={p(acks, 0.95) * 1000:.0f} ms max={max(acks) * 1000:.0f} ms")
    log(f"janelas com features: {len(janelas_envio)}; eventos no espectador: {len(feats)}")
    if atrasos:
        log(f"frame que fecha a janela -> espectador: "
            f"mediana={statistics.median(atrasos) * 1000:.0f} ms "
            f"p95={p(atrasos, 0.95) * 1000:.0f} ms")
    if tamanhos:
        log(f"tamanho do evento SSE 'features': {min(tamanhos)}–{max(tamanhos)} B")


def cenario_d(token: str) -> None:
    log("== D: Analysis pausada no meio da captação (12 s)")
    sonda = Sonda()
    sonda.start()
    ws, _ = abrir(token)
    seq = enviar_normal(ws, 1, 8)
    t_pause = agora()
    compose("pause", "analysis")
    log("analysis PAUSADA")
    lat_pausa = []
    while agora() - t_pause < 12:
        dt, resp = enviar(ws, seq, (seq - 1) * 256)
        seq += 1
        lat_pausa.append((dt, resp.get("features")))
    compose("unpause", "analysis")
    log("analysis DESPAUSADA")
    enviar_normal(ws, seq, 8)
    ws.send(json.dumps({"type": "stop"}))
    fim = json.loads(ws.recv(timeout=90))
    ws.close()
    sonda.parar.set()
    lentos = [(round(d, 2), f) for d, f in lat_pausa if d > 1]
    log(f"acks durante a pausa: {len(lat_pausa)}; lentos (>1 s): {lentos}")
    h = [
        (round(t - t_pause, 1), round(d, 2), s)
        for t, d, s in sonda.amostras
        if -1 < t - t_pause < 14 and d > 1
    ]
    log(f"/health lento (>1 s) durante a pausa: {h}")
    log(f"stop depois de despausar -> result={fim.get('result')}")


def estado_da_sessao(sid: str) -> str:
    consulta = (
        "select s.status, s.sample_count, "
        "(select count(*) from results r where r.session_id=s.id) "
        f"from capture_sessions s where s.id='{sid}'"
    )
    out = subprocess.run(
        [*COMPOSE, "exec", "-T", "postgres", "psql", "-U", "waveai", "-d", "waveai", "-tAc",
         consulta],
        capture_output=True,
        text=True,
    )
    return out.stdout.strip() or out.stderr.strip()[:200]


def cenario_f(token: str, modo: str) -> None:
    log(f"== F-{modo}: Postgres {modo} no meio da captação")
    sonda = Sonda()
    sonda.start()
    ws, sid = abrir(token)
    seq = enviar_normal(ws, 1, 8)
    t0 = agora()
    compose(modo, "postgres")
    log(f"postgres: {modo}")
    desfecho = ""
    try:
        while agora() - t0 < 15:
            dt, resp = enviar(ws, seq, (seq - 1) * 256, timeout=40)
            seq += 1
            if dt > 1 or resp.get("type") != "ack":
                log(f"  frame {seq - 1}: {dt:.2f} s -> {str(resp)[:100]}")
            time.sleep(0.5)
        desfecho = "WS seguiu aberto"
    except ConnectionClosed as exc:
        desfecho = f"WS FECHADO {agora() - t0:.1f} s após o {modo}: {exc}"
    except TimeoutError:
        desfecho = f"frame sem resposta por 40 s ({agora() - t0:.1f} s após o {modo})"
    log(desfecho)
    volta = "unpause" if modo == "pause" else "start"
    compose(volta, "postgres")
    log(f"postgres: {volta}")
    time.sleep(8)
    if "FECHADO" not in desfecho:
        try:
            ws.send(json.dumps({"type": "stop"}))
            log(f"stop -> {json.loads(ws.recv(timeout=60)).get('result')!s}")
        except Exception as exc:
            log(f"stop falhou: {type(exc).__name__}: {exc}")
    ws.close()
    sonda.parar.set()
    h = [
        (round(t - t0, 1), round(d, 2), s)
        for t, d, s in sonda.amostras
        if -1 < t - t0 < 16 and (d > 1 or s != "200")
    ]
    log(f"/health afetado: {h[:12]}")
    log(f"sessão no banco (status|amostras|results): {estado_da_sessao(sid)}")


def cenario_e(token: str) -> None:
    log("== E: 16 espectadores SSE e depois uma rota REST que usa o banco")
    for _ in range(16):
        Espectador(token).start()
        time.sleep(0.2)
    time.sleep(3)
    t = agora()
    cabecalho = {"Authorization": f"Bearer {token}"}
    try:
        r = httpx.get(f"{BASE}/auth/me", headers=cabecalho, timeout=90)
        log(f"GET /auth/me com 16 SSE abertos: {r.status_code} em {agora() - t:.1f} s")
    except Exception as exc:
        log(f"GET /auth/me falhou em {agora() - t:.1f} s: {type(exc).__name__}")
    t = agora()
    r = httpx.get(f"{BASE}/health", timeout=90)
    log(f"GET /health com 16 SSE abertos: {r.status_code} em {agora() - t:.2f} s")


def login() -> str:
    r = httpx.post(
        f"{BASE}/auth/login",
        json={"email": "paciente.dois@example.com", "password": "senha-de-teste-bem-longa-7"},
    )
    r.raise_for_status()
    return r.json()["access_token"]


def main() -> None:
    token = login()
    cenarios = (
        ("C", lambda: cenario_c(token)),
        ("D", lambda: cenario_d(token)),
        ("F-pause", lambda: cenario_f(token, "pause")),
        ("F-stop", lambda: cenario_f(token, "stop")),
    )
    for nome, fn in cenarios:
        try:
            fn()
        except Exception as exc:
            log(f"cenário {nome} abortou: {type(exc).__name__}: {exc}")
        time.sleep(4)
    time.sleep(10)  # deixa o banco e a API se recomporem antes do E
    try:
        cenario_e(token)
    except Exception as exc:
        log(f"cenário E abortou: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
