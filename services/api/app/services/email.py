"""Envio de e-mail: interface e adapters (ADR-0044).

O produto não manda e-mail — ele **pede** a um `EmailSender`. O provedor real
entrou em 2026-08-23 como mais um adapter (`SmtpEmailSender`, emenda à
ADR-0044), sem tocar em texto, rota ou fluxo nenhum — que era exatamente o que
esta interface existia para permitir. A cópia dos e-mails continua do lado da
API, junto do fluxo que a envia.

**Fail-closed fora de `development`:** sem provedor configurado, a app não sobe
— mesmo padrão do segredo JWT (ADR-0023) e da chave Fernet (ADR-0026). Cair no
adapter de console em produção seria a falha mais cara possível: o token iria
**em claro para o log** e, como conta não verificada não entra, ninguém
conseguiria acessar — silenciosamente.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

from ..config import Settings

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """O envio falhou. Quem chama decide se isso derruba o fluxo."""


class EmailSender(Protocol):
    """Contrato mínimo de envio — permite substituir por um duplo nos testes.

    `html` é a alternativa estilizada (emenda à ADR-0044): opcional e sempre ao
    lado do `body` em texto, que é o que viaja quando o cliente não renderiza.
    """

    def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        ...


class ConsoleEmailSender:
    """Adapter de desenvolvimento: imprime o e-mail em vez de enviá-lo.

    Imprime destinatário, assunto e corpo — **incluindo o link com o token** —
    porque é exatamente isso que torna o fluxo testável sem provedor. Por isso
    mesmo ele é recusado fora de `development` (ver `build_email_sender`).
    """

    def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        # Imprime o TEXTO — é onde o dev (e a regex dos testes de fluxo) leem o
        # código. A alternativa HTML só é anotada; despejar o HTML aqui poluiria
        # o stdout sem ajudar quem depura o fluxo.
        nota_html = "  [+ alternativa HTML]" if html else ""
        print(
            "\n".join(
                [
                    "",
                    "=" * 72,
                    f"[e-mail de desenvolvimento — NÃO enviado de verdade]{nota_html}",
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

    def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        raise EmailSendError("nenhum provedor de e-mail configurado")


class SmtpEmailSender:
    """Adapter real: SMTP do Gmail com senha de app (emenda à ADR-0044).

    Escolhido em vez da Gmail API porque a conta é Gmail **pessoal**: por OAuth,
    a tela de consentimento só pode ser *External* e, em modo *Testing*, o
    refresh token expira em poucos dias. Um token que morre sozinho quebraria o
    envio **em silêncio**, deixando a pessoa do lado de fora sem conseguir
    verificar a conta — o dano que o fail-closed existe para evitar, entrando
    por outra porta. Aqui não há token: `smtplib` é da biblioteca padrão, e
    nenhuma dependência nova entra no projeto.

    **Toda falha vira `EmailSendError`.** Quem chama já sabe tratar isso; deixar
    escapar erro de socket ou de protocolo faria a rota devolver 500 e, pior,
    revelaria detalhe de infraestrutura numa resposta que a ADR-0024 exige
    **uniforme**.
    """

    def __init__(
        self,
        *,
        host: str,
        port: int,
        user: str,
        password: str,
        use_tls: bool,
        timeout: float,
        sender: str,
    ) -> None:
        self._host = host
        self._port = port
        self._user = user
        self._password = password
        self._use_tls = use_tls
        self._timeout = timeout
        self._sender = sender

    def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        # EmailMessage cuida do cabeçalho e da codificação: assunto com acento
        # vira MIME encoded-word sozinho, e é isso que evita "AssÃ­" na caixa de
        # entrada de quem recebe.
        mensagem = EmailMessage()
        mensagem["From"] = self._sender
        mensagem["To"] = to
        mensagem["Subject"] = subject
        # Texto primeiro: `set_content` é a parte que SEMPRE viaja. `add_alternative`
        # empacota como multipart/alternative (emenda à ADR-0044) — o cliente
        # escolhe, e quem não renderiza HTML fica com o texto e o código.
        mensagem.set_content(body)
        if html:
            mensagem.add_alternative(html, subtype="html")

        try:
            with smtplib.SMTP(self._host, self._port, timeout=self._timeout) as smtp:
                if self._use_tls:
                    smtp.starttls()
                if self._user:
                    smtp.login(self._user, self._password)
                smtp.send_message(mensagem)
        except Exception as exc:
            # Sem o destinatário e sem o corpo no log: o corpo carrega o token
            # de uso único, e o adapter de console só pode imprimi-lo porque é
            # recusado fora de desenvolvimento.
            logger.warning("falha ao enviar e-mail por SMTP: %s", exc)
            raise EmailSendError("falha ao enviar e-mail") from exc


def build_email_sender(settings: Settings) -> EmailSender:
    """Escolhe o adapter por **configuração**, com fail-closed fora de `development`.

    A ordem é deliberada. Havendo credenciais SMTP, elas valem em **qualquer**
    ambiente — inclusive `development`, para que dê para exercitar o envio real
    antes de confiar nele em produção. Sem credenciais, vale a regra antiga:
    console em desenvolvimento, e levanta fora dele.

    Adivinhar pelo ambiente seria pior: um `app_env` mal preenchido escolheria
    o adapter errado sem ninguém notar. Aqui o que decide é a presença do que o
    envio de fato precisa.
    """
    if settings.smtp_host and settings.smtp_user and settings.smtp_password:
        return SmtpEmailSender(
            host=settings.smtp_host,
            port=settings.smtp_port,
            user=settings.smtp_user,
            password=settings.smtp_password,
            use_tls=settings.smtp_use_tls,
            timeout=settings.smtp_timeout_seconds,
            sender=settings.email_from,
        )
    if settings.app_env == "development":
        return ConsoleEmailSender()
    raise RuntimeError(
        "nenhum provedor de e-mail configurado para app_env="
        f"{settings.app_env!r}: os fluxos de verificação e recuperação de senha "
        "ficariam sem saída (ADR-0044). Configure WAVEAI_API_SMTP_HOST, "
        "WAVEAI_API_SMTP_USER e WAVEAI_API_SMTP_PASSWORD antes de subir."
    )


def registrar_envio(*, user_id: object, purpose: str) -> None:
    """Log de envio **sem PII**: id do usuário e propósito, nunca o endereço.

    O endereço é o dado que não pode acabar em agregador de log; o id já basta
    para investigar "esta pessoa recebeu?" cruzando com a tabela de tokens.
    """
    logger.info("email enviado user_id=%s purpose=%s", user_id, purpose)
