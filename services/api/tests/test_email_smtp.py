"""Provedor real de e-mail: SMTP com senha de app (emenda à ADR-0044).

**Nenhum teste aqui toca a rede.** Um duplo substitui `smtplib.SMTP` e registra
o que teria acontecido. Testar envio de verdade exigiria credencial real num
teste automatizado — o oposto do que as regras do projeto permitem.

O que estes testes protegem:

1. **O fail-closed da ADR-0044 continua de pé.** Fora de `development` e sem
   credencial, `build_email_sender` tem de levantar. Era assim antes desta
   emenda e precisa continuar sendo.
2. **A escolha do adapter é por configuração, não por adivinhação.** Um
   `app_env` mal preenchido não pode fazer produção cair no console, que
   imprime o token em claro.
3. **Falha de envio vira `EmailSendError`**, e não erro de socket vazando para
   a rota — que responderia 500 e quebraria a uniformidade da ADR-0024.
4. **O token não vai para o log** quando o envio falha.
"""

from __future__ import annotations

import smtplib

import pytest
from app.config import JWT_SECRET_MIN_BYTES, Settings
from app.services.email import (
    ConsoleEmailSender,
    EmailSendError,
    SmtpEmailSender,
    build_email_sender,
)
from cryptography.fernet import Fernet

SEGREDO = "x" * JWT_SECRET_MIN_BYTES


def _settings(**extra) -> Settings:
    base = {
        "jwt_secret": SEGREDO,
        "result_encryption_key": Fernet.generate_key().decode(),
        "_env_file": None,
    }
    return Settings(**{**base, **extra})


def _com_credenciais(**extra) -> Settings:
    credenciais = {
        "smtp_host": "smtp.example.com",
        "smtp_user": "conta@example.com",
        "smtp_password": "senha-de-app-ficticia",
    }
    # `extra` por último: é o que permite um teste esvaziar um dos três campos
    # para exercitar a credencial incompleta.
    return _settings(**{**credenciais, **extra})


class _SmtpFalso:
    """Duplo de `smtplib.SMTP` que registra a conversa em vez de abrir socket."""

    ultima: _SmtpFalso | None = None

    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.starttls_chamado = False
        self.login_com: tuple[str, str] | None = None
        self.enviadas: list = []
        self.fechado = False
        _SmtpFalso.ultima = self

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.fechado = True
        return False

    def starttls(self):
        self.starttls_chamado = True

    def login(self, user, password):
        self.login_com = (user, password)

    def send_message(self, mensagem):
        self.enviadas.append(mensagem)


@pytest.fixture
def smtp_falso(monkeypatch: pytest.MonkeyPatch) -> type[_SmtpFalso]:
    _SmtpFalso.ultima = None
    monkeypatch.setattr(smtplib, "SMTP", _SmtpFalso)
    return _SmtpFalso


# -- escolha do adapter ------------------------------------------------------


def test_sem_credencial_fora_de_development_continua_levantando():
    """O fail-closed da ADR-0044, que esta emenda não pode ter afrouxado.

    Cair no console em produção mandaria o token de uso único **em claro para o
    log** — e, como conta não verificada não entra, ninguém acessaria.
    """
    with pytest.raises(RuntimeError, match="nenhum provedor de e-mail"):
        build_email_sender(_settings(app_env="production"))


def test_sem_credencial_em_development_usa_console():
    assert isinstance(build_email_sender(_settings(app_env="development")), ConsoleEmailSender)


@pytest.mark.parametrize("ambiente", ["development", "production", "staging"])
def test_com_credencial_usa_smtp_em_qualquer_ambiente(ambiente: str):
    """A escolha é por configuração, não por ambiente.

    Vale também em `development`: é o que permite exercitar o envio real antes
    de confiar nele em produção.
    """
    assert isinstance(build_email_sender(_com_credenciais(app_env=ambiente)), SmtpEmailSender)


@pytest.mark.parametrize(
    "faltante", ["smtp_host", "smtp_user", "smtp_password"]
)
def test_credencial_incompleta_nao_vira_smtp(faltante: str):
    """Meia credencial é pior que nenhuma: falharia no primeiro envio real.

    Com um dos três em branco, o serviço volta a ser fail-closed fora de
    desenvolvimento em vez de subir um adapter que não consegue autenticar.
    """
    settings = _com_credenciais(app_env="production", **{faltante: ""})
    with pytest.raises(RuntimeError, match="nenhum provedor de e-mail"):
        build_email_sender(settings)


# -- envio -------------------------------------------------------------------


def _sender(**extra) -> SmtpEmailSender:
    return build_email_sender(_com_credenciais(app_env="production", **extra))


def test_envio_usa_starttls_autentica_e_entrega(smtp_falso):
    _sender().send(to="alguem@example.com", subject="Assunto", body="corpo")

    conversa = smtp_falso.ultima
    assert conversa is not None, "nenhuma conexão foi aberta"
    assert (conversa.host, conversa.port) == ("smtp.example.com", 587)
    assert conversa.starttls_chamado is True, "sem STARTTLS a senha viajaria em claro"
    assert conversa.login_com == ("conta@example.com", "senha-de-app-ficticia")
    assert len(conversa.enviadas) == 1
    assert conversa.fechado is True, "a conexão precisa fechar mesmo no caminho feliz"


def test_starttls_pode_ser_desligado_para_servidor_local(smtp_falso):
    """Existe para um servidor de teste que não fala TLS — nunca para produção."""
    _sender(smtp_use_tls=False).send(to="a@example.com", subject="s", body="b")
    assert smtp_falso.ultima.starttls_chamado is False


def test_cabecalhos_e_remetente(smtp_falso):
    _sender(email_from="WaveAI <nao-responda@example.com>").send(
        to="destino@example.com", subject="Seu código", body="123456"
    )

    mensagem = smtp_falso.ultima.enviadas[0]
    assert mensagem["From"] == "WaveAI <nao-responda@example.com>"
    assert mensagem["To"] == "destino@example.com"
    assert mensagem["Subject"] == "Seu código"
    assert "123456" in mensagem.get_content()


def test_html_vira_multipart_com_as_duas_partes_e_o_codigo_nas_duas(smtp_falso):
    """Emenda à ADR-0044: com `html`, a mensagem é multipart/alternative e o
    código aparece nas DUAS partes — quem não renderiza HTML não pode perdê-lo."""
    _sender().send(
        to="a@example.com",
        subject="Seu código",
        body="Seu código é: 246810",
        html="<table><tr><td>246810</td></tr></table>",
    )

    mensagem = smtp_falso.ultima.enviadas[0]
    assert mensagem.get_content_type() == "multipart/alternative"

    texto = mensagem.get_body(preferencelist=("plain",))
    html = mensagem.get_body(preferencelist=("html",))
    assert texto is not None and html is not None, "faltou uma das duas partes"
    assert texto.get_content_type() == "text/plain"
    assert html.get_content_type() == "text/html"
    # O código sobrevive nas duas — é a asserção que discrimina o pareamento.
    assert "246810" in texto.get_content()
    assert "246810" in html.get_content()


def test_sem_html_continua_so_texto(smtp_falso):
    """Retrocompatível: sem `html`, nada de multipart — só text/plain."""
    _sender().send(to="a@example.com", subject="s", body="123456")

    mensagem = smtp_falso.ultima.enviadas[0]
    assert mensagem.get_content_type() == "text/plain"
    assert "123456" in mensagem.get_content()


def test_assunto_com_acento_sobrevive_a_codificacao(smtp_falso):
    """Assunto acentuado tem de chegar legível, não como 'Ã­'."""
    _sender().send(to="a@example.com", subject="Verificação da conta", body="olá")
    assert smtp_falso.ultima.enviadas[0]["Subject"] == "Verificação da conta"


def test_timeout_e_repassado(smtp_falso):
    """Sem limite, uma rota de cadastro ficaria pendurada até o cliente desistir."""
    _sender(smtp_timeout_seconds=3.5).send(to="a@example.com", subject="s", body="b")
    assert smtp_falso.ultima.timeout == 3.5


# -- falha -------------------------------------------------------------------


def test_falha_do_servidor_vira_EmailSendError(monkeypatch: pytest.MonkeyPatch):
    """Erro de socket ou de protocolo não pode vazar para a rota.

    Quem chama já trata `EmailSendError`; deixar subir um `SMTPException` faria
    a resposta virar 500 e revelar detalhe de infraestrutura numa rota que a
    ADR-0024 exige uniforme.
    """

    class _Explode(_SmtpFalso):
        def send_message(self, mensagem):
            raise smtplib.SMTPException("servidor recusou")

    monkeypatch.setattr(smtplib, "SMTP", _Explode)
    with pytest.raises(EmailSendError):
        _sender().send(to="a@example.com", subject="s", body="b")


def test_falha_de_conexao_tambem_vira_EmailSendError(monkeypatch: pytest.MonkeyPatch):
    def _recusa(*args, **kwargs):
        raise OSError("conexão recusada")

    monkeypatch.setattr(smtplib, "SMTP", _recusa)
    with pytest.raises(EmailSendError):
        _sender().send(to="a@example.com", subject="s", body="b")


def test_log_de_falha_nao_carrega_o_token(monkeypatch: pytest.MonkeyPatch, caplog):
    """O corpo leva o token de uso único; log não é lugar para ele.

    O adapter de console só pode imprimi-lo porque é recusado fora de
    desenvolvimento — este aqui roda em produção.
    """

    class _Explode(_SmtpFalso):
        def send_message(self, mensagem):
            raise smtplib.SMTPException("servidor recusou")

    monkeypatch.setattr(smtplib, "SMTP", _Explode)
    with caplog.at_level("WARNING"), pytest.raises(EmailSendError):
        _sender().send(
            to="vitima@example.com", subject="Seu código", body="token-secreto-123456"
        )

    registrado = caplog.text
    assert "token-secreto-123456" not in registrado, "o token vazou para o log"
    assert "vitima@example.com" not in registrado, "o destinatário vazou para o log"
