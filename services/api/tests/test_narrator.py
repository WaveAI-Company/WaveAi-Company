"""Narrativa-LLM aterrada (N6-b, ADR-0035) — sem chamar a API real.

O SDK da Anthropic é substituído em `sys.modules` por um duplo; nenhum teste
faz rede. Exercita os guarda-corpos: nulo por padrão, prosa aterrada quando
ligado, e degradação graciosa (recusa/erro/vazio → None).
"""
from __future__ import annotations

import sys
import types

from app.services.narrator import ClaudeNarrator, NullNarrator, build_narrator

REPORT = {
    "n_sessions": 6,
    "features": {"rel_alpha": {"direction": "subindo", "delta_pct": 12.0}},
    "quality": {"mean": 0.83},
}
SUMMARY = ["Resumo de 6 sessões.", "alfa relativo: subindo (+12% ao longo das sessões)."]


def _fake_anthropic(monkeypatch, *, reply=None, stop_reason="end_turn", exc=None, calls=None):
    """Instala um módulo `anthropic` falso; devolve nada (age via sys.modules)."""

    class _Messages:
        def create(self, **kwargs):
            if calls is not None:
                calls.append(kwargs)
            if exc is not None:
                raise exc
            content = [types.SimpleNamespace(type="text", text=reply)] if reply is not None else []
            return types.SimpleNamespace(content=content, stop_reason=stop_reason)

    class _Anthropic:
        def __init__(self, api_key=None):
            self.api_key = api_key
            self.messages = _Messages()

    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=_Anthropic))


def test_null_narrator_sempre_none():
    assert NullNarrator().narrate(REPORT, SUMMARY) is None


def test_build_narrator_desligado_ou_sem_chave_e_nulo():
    assert isinstance(build_narrator(enabled=False, model="m", api_key="k"), NullNarrator)
    assert isinstance(build_narrator(enabled=True, model="m", api_key=None), NullNarrator)
    assert isinstance(build_narrator(enabled=True, model="m", api_key=""), NullNarrator)


def test_build_narrator_ligado_com_chave_e_claude():
    assert isinstance(build_narrator(enabled=True, model="m", api_key="k"), ClaudeNarrator)


def test_claude_narrator_devolve_prosa_aterrada(monkeypatch):
    calls: list[dict] = []
    _fake_anthropic(monkeypatch, reply="  Nas 6 sessões o alfa subiu levemente.  ", calls=calls)

    texto = ClaudeNarrator(model="claude-haiku-4-5", api_key="k").narrate(REPORT, SUMMARY)

    assert texto == "Nas 6 sessões o alfa subiu levemente."  # aparado
    # O modelo e o teto vão na chamada; a entrada leva os números como dado.
    assert calls[0]["model"] == "claude-haiku-4-5"
    assert calls[0]["max_tokens"] > 0
    conteudo = calls[0]["messages"][0]["content"]
    assert "rel_alpha" in conteudo and "subindo" in conteudo
    # Guarda-corpos ADR-0035/Medical/71 no system prompt.
    sistema = calls[0]["system"].lower()
    assert "não-clínic" in sistema or "não é interpretação clínica" in sistema
    assert "diagnostic" in sistema or "diagnóstic" in sistema


def test_claude_narrator_recusa_cai_para_none(monkeypatch):
    _fake_anthropic(monkeypatch, reply="algo", stop_reason="refusal")
    assert ClaudeNarrator(model="m", api_key="k").narrate(REPORT, SUMMARY) is None


def test_claude_narrator_erro_cai_para_none(monkeypatch):
    _fake_anthropic(monkeypatch, exc=RuntimeError("fora do ar"))
    assert ClaudeNarrator(model="m", api_key="k").narrate(REPORT, SUMMARY) is None


def test_claude_narrator_sem_sumario_nao_chama(monkeypatch):
    calls: list[dict] = []
    _fake_anthropic(monkeypatch, reply="x", calls=calls)
    assert ClaudeNarrator(model="m", api_key="k").narrate(REPORT, []) is None
    assert calls == []  # sem sumário base, nem chama o modelo
