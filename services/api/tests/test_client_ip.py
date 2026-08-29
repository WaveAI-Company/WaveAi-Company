"""IP do cliente atrás do proxy confiável (emenda à ADR-0023, 2026-08-29).

Testes puros de `client_ip`: sem banco, sem rede. Constroem um `Request` do
Starlette com um escopo mínimo — cabeçalhos e `client` controlados — e conferem
de qual elemento do `X-Forwarded-For` a chave do rate limit sai.

Cada asserção **discrimina** o comportamento novo do antigo: antes do fix,
`client_ip` devolvia sempre o IP do socket (`scope["client"]`) e ignorava o
cabeçalho, então todos os casos com XFF abaixo davam o socket. As asserções que
esperam um elemento do cabeçalho falham no código antigo.
"""

from __future__ import annotations

from types import SimpleNamespace

from app.api.deps import client_ip
from starlette.requests import Request

SOCKET = "10.0.0.1"


def _req(xff: str | None = None, socket: str = SOCKET) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if xff is not None:
        headers.append((b"x-forwarded-for", xff.encode()))
    scope = {"type": "http", "headers": headers, "client": (socket, 0)}
    return Request(scope)


def _hops(n: int) -> SimpleNamespace:
    """Stand-in de Settings: `client_ip` só lê `trusted_proxy_hops`, e construir
    o `Settings` real exigiria os segredos obrigatórios (jwt/Fernet)."""
    return SimpleNamespace(trusted_proxy_hops=n)


def test_um_salto_pega_o_ultimo_elemento():
    # O ingress anexa o IP real à direita; "evil" veio do cliente e é descartado.
    ip = client_ip(_req("evil, 203.0.113.9"), settings=_hops(1))
    assert ip == "203.0.113.9"
    assert ip != "evil"  # o valor forjado não vence
    assert ip != SOCKET  # e não é o socket (era o que o código antigo devolvia)


def test_forjar_varios_elementos_nao_ajuda():
    # Empilhar entradas à esquerda não muda nada: o real é sempre o último.
    ip = client_ip(_req("evil, evil2, evil3, 198.51.100.4"), settings=_hops(1))
    assert ip == "198.51.100.4"


def test_sem_cabecalho_cai_no_socket():
    # Dev/local sem proxy: sem XFF, usa o peer do socket.
    assert client_ip(_req(None, socket="192.0.2.7"), settings=_hops(1)) == "192.0.2.7"


def test_cabecalho_vazio_cai_no_socket():
    assert client_ip(_req("   ", socket="192.0.2.7"), settings=_hops(1)) == "192.0.2.7"


def test_dois_saltos_conta_da_direita():
    # Com dois proxies confiáveis, o real é o penúltimo: XFF = "cliente, pA".
    ip = client_ip(_req("forjado, 203.0.113.9, 10.1.1.1"), settings=_hops(2))
    assert ip == "203.0.113.9"


def test_cadeia_mais_curta_que_o_esperado_cai_no_socket():
    # Menos elementos que saltos esperados = a requisição não passou por todos
    # os proxies confiáveis. Não confiar no cabeçalho; usar o socket.
    ip = client_ip(_req("so-um", socket="192.0.2.7"), settings=_hops(2))
    assert ip == "192.0.2.7"
