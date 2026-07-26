"""Narrativa-LLM **aterrada** do relatório longitudinal (N6-b, ADR-0035).

Camada de **linguagem**, não de análise: transforma o relatório **determinístico**
(N5) em prosa PT-BR curta, sempre **derivada dos números fornecidos**. É um
"tradutor", nunca um "analista" — não interpreta clinicamente, não inventa dado,
não é base de claim (Medical/71).

**[RÍGIDO — ADR-0035]**
- O sumário determinístico (N5-c) é a **base confiável**; esta camada é upgrade de
  fluência **por cima** dele. Se o LLM falhar, recusar ou estiver desligado, o
  gateway cai no sumário determinístico — **nunca quebra o relatório**.
- Segredo só via ambiente (`ANTHROPIC_API_KEY`, lido pelo SDK); nunca commitado.
- RAG/contextualização contra literatura fica **fora de escopo** (ADR-0035).
"""
from __future__ import annotations

import json
from typing import Any, Protocol

#: Teto de saída — a narrativa é curta (2–4 frases). Sobra folga.
_MAX_TOKENS = 400

#: System prompt: os guarda-corpos vivem aqui (canal de operador, não conteúdo
#: do usuário). Enquadramento não-clínico obrigatório (Medical/71).
_SYSTEM = (
    "Você resume, em português do Brasil, um relatório EXPLORATÓRIO de bem-estar "
    "de EEG de consumo. Regras absolutas:\n"
    "1. Use SOMENTE os números do relatório fornecido. NUNCA invente valores, "
    "tendências, sessões ou features que não estejam nos dados.\n"
    "2. NÃO é interpretação clínica. É proibido diagnosticar, sugerir doença, "
    "transtorno, tratamento, ou usar termos clínicos. Descreva tendências "
    "numéricas ('subiu', 'desceu', 'estável'), não significados de saúde.\n"
    "3. Seja conciso: 2 a 4 frases. Sem listas, sem markdown, sem preâmbulo.\n"
    "4. Termine deixando claro que é exploratório e não-diagnóstico.\n"
    "Você é um tradutor dos números, não um analista."
)


class Narrator(Protocol):
    """Contrato: recebe o relatório determinístico + sumário e devolve prosa
    aterrada, ou `None` quando não há narrativa (desligado/falha)."""

    def narrate(self, report: dict[str, Any], summary: list[str]) -> str | None:
        ...


class NullNarrator:
    """Sem narrativa. É o default: o app cai no sumário determinístico (N5-c)."""

    def narrate(self, report: dict[str, Any], summary: list[str]) -> str | None:
        return None


def _payload(report: dict[str, Any], summary: list[str]) -> str:
    """Monta a entrada do modelo: os números como DADO, mais o sumário-base."""
    return (
        "Relatório determinístico (fonte única de verdade — não extrapole além disto):\n"
        f"{json.dumps(report, ensure_ascii=False)}\n\n"
        "Sumário determinístico já gerado (reescreva com mais fluência, sem mudar "
        "os fatos):\n" + "\n".join(f"- {linha}" for linha in summary)
    )


class ClaudeNarrator:
    """Sumarizador aterrado via API da Anthropic (Claude).

    Falha graciosamente: qualquer erro de rede/SDK ou recusa do modelo devolve
    `None` — o gateway então usa o sumário determinístico. Nunca propaga exceção
    para a rota do relatório.
    """

    def __init__(self, *, model: str, api_key: str) -> None:
        self._model = model
        self._api_key = api_key

    def narrate(self, report: dict[str, Any], summary: list[str]) -> str | None:
        if not summary:
            return None
        try:
            import anthropic  # import lazy: só necessário quando a narrativa está ligada

            client = anthropic.Anthropic(api_key=self._api_key)
            message = client.messages.create(
                model=self._model,
                max_tokens=_MAX_TOKENS,
                system=_SYSTEM,
                messages=[{"role": "user", "content": _payload(report, summary)}],
            )
            # O modelo pode recusar (stop_reason "refusal"): tratamos como sem
            # narrativa e caímos no determinístico.
            if getattr(message, "stop_reason", None) == "refusal":
                return None
            texto = "".join(
                bloco.text for bloco in message.content if getattr(bloco, "type", None) == "text"
            ).strip()
            return texto or None
        except Exception:
            # Perder a narrativa é aceitável; perder o relatório do titular não.
            return None


def build_narrator(*, enabled: bool, model: str, api_key: str | None) -> Narrator:
    """Escolhe o narrador: real só quando ligado E com chave; senão, nulo."""
    if enabled and api_key:
        return ClaudeNarrator(model=model, api_key=api_key)
    return NullNarrator()
