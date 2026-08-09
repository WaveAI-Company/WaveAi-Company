"""Envio de e-mail: interface e adapters (ADR-0044).

O produto não manda e-mail — ele **pede** a um `EmailSender`. O provedor real
(SMTP/API transacional) é item do **P5** e entra como mais um adapter, sem
tocar em texto nenhum: a cópia dos e-mails vive do lado da API, junto do fluxo
que a envia (fatias 5 e 6).

**Fail-closed fora de `development`:** sem provedor configurado, a app não sobe
— mesmo padrão do segredo JWT (ADR-0023) e da chave Fernet (ADR-0026). Cair no
adapter de console em produção seria a falha mais cara possível: o token iria
**em claro para o log** e, como conta não verificada não entra, ninguém
conseguiria acessar — silenciosamente.
"""

from __future__ import annotations

import logging
from typing import Protocol

from ..config import Settings

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """O envio falhou. Quem chama decide se isso derruba o fluxo."""


class EmailSender(Protocol):
    """Contrato mínimo de envio — permite substituir por um duplo nos testes."""

    def send(self, *, to: str, subject: str, body: str) -> None:
        ...


class ConsoleEmailSender:
    """Adapter de desenvolvimento: imprime o e-mail em vez de enviá-lo.

    Imprime destinatário, assunto e corpo — **incluindo o link com o token** —
    porque é exatamente isso que torna o fluxo testável sem provedor. Por isso
    mesmo ele é recusado fora de `development` (ver `build_email_sender`).
    """

    def send(self, *, to: str, subject: str, body: str) -> None:
        print(
            "\n".join(
                [
                    "",
                    "=" * 72,
                    "[e-mail de desenvolvimento — NÃO enviado de verdade]",
                    f"Para:     {to}",
                    f"Assunto:  {subject}",
                    "-" * 72,
                    body,
                    "=" * 72,
                    "",
                ]
            ),
            flush=True,
        )


class NullEmailSender:
    """Adapter que recusa qualquer envio.

    Existe para o **teste**, que não deve depender de stdout nem de rede; e para
    deixar explícito que "não configurado" é um estado que falha alto, não um
    estado que engole a mensagem em silêncio.
    """

    def send(self, *, to: str, subject: str, body: str) -> None:
        raise EmailSendError("nenhum provedor de e-mail configurado")


def build_email_sender(settings: Settings) -> EmailSender:
    """Escolhe o adapter pelo ambiente. Fail-closed fora de `development`.

    Hoje só existe o console; quando o provedor real do P5 chegar, ele entra
    como mais um ramo aqui — e este é o único ponto do código que precisa saber
    qual adapter está de pé.
    """
    if settings.app_env == "development":
        return ConsoleEmailSender()
    raise RuntimeError(
        "nenhum provedor de e-mail configurado para app_env="
        f"{settings.app_env!r}: os fluxos de verificação e recuperação de senha "
        "ficariam sem saída (ADR-0044). Configure um provedor antes de subir."
    )


def registrar_envio(*, user_id: object, purpose: str) -> None:
    """Log de envio **sem PII**: id do usuário e propósito, nunca o endereço.

    O endereço é o dado que não pode acabar em agregador de log; o id já basta
    para investigar "esta pessoa recebeu?" cruzando com a tabela de tokens.
    """
    logger.info("email enviado user_id=%s purpose=%s", user_id, purpose)
