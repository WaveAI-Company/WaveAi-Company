"""Tokens de uso único e envio de e-mail (ADR-0044).

O que estes testes protegem: **um token vale uma vez, para um propósito, por um
prazo** — e o valor em claro nunca chega ao banco. São a base das fatias 5
(verificação de e-mail) e 6 (recuperação de senha); os endpoints não existem
ainda, por isso tudo aqui é exercitado pelo serviço.

Contas e tokens são 100% sintéticos (CLAUDE.md).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from app.config import get_settings
from app.models import SingleUseToken, SingleUseTokenPurpose, User, UserRole
from app.repositories.user import UserRepository
from app.security.password import Argon2PasswordHasher
from app.security.tokens import hash_opaque_token
from app.services.email import (
    ConsoleEmailSender,
    EmailSendError,
    NullEmailSender,
    build_email_sender,
)
from app.services.single_use_token import SingleUseTokenService
from sqlalchemy import select
from sqlalchemy.orm import Session

SENHA = "senha-de-teste-bem-longa"

VERIFICACAO = SingleUseTokenPurpose.EMAIL_VERIFICATION
RESET = SingleUseTokenPurpose.PASSWORD_RESET


def _usuario(db_session: Session) -> User:
    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    user = UserRepository(db_session, hasher).create(
        email=f"user-{uuid.uuid4().hex[:12]}@example.com",
        password=SENHA,
        role=UserRole.PATIENT,
        display_name="Sintetico",
    )
    db_session.flush()
    return user


def _service(db_session: Session) -> SingleUseTokenService:
    return SingleUseTokenService(session=db_session, settings=get_settings())


# -- emissão -------------------------------------------------------------


def test_emitir_guarda_so_o_hash(db_session: Session):
    """O valor em claro existe no e-mail e na memória — nunca no banco."""
    service = _service(db_session)
    user = _usuario(db_session)

    emitido = service.emitir(user=user, purpose=VERIFICACAO)

    guardado = db_session.scalars(
        select(SingleUseToken).where(SingleUseToken.user_id == user.id)
    ).one()
    assert guardado.token_hash == hash_opaque_token(emitido.valor)
    # E o valor em claro não está em NENHUMA linha da tabela — não basta que a
    # coluna certa tenha o hash; o que importa é o dump inteiro não entregar
    # token utilizável (ADR-0021/0044).
    todos = db_session.scalars(select(SingleUseToken.token_hash)).all()
    assert emitido.valor not in todos


def test_prazo_curto_e_igual_nos_dois_propositos(db_session: Session):
    """Emenda à ADR-0044: a assimetria 24 h/30 min caiu.

    O design verifica **com a pessoa na tela** (`criar-conta.html`, passo 2 de
    3), então prazo longo não tinha função — e o curto já era o certo.
    """
    ttl = timedelta(minutes=get_settings().single_use_token_ttl_minutes)
    service = _service(db_session)
    user = _usuario(db_session)
    antes = datetime.now(UTC)

    verificacao = service.emitir(user=user, purpose=VERIFICACAO)
    reset = service.emitir(user=user, purpose=RESET)

    for emitido in (verificacao, reset):
        assert emitido.expires_at - antes <= ttl + timedelta(seconds=5)
        assert emitido.expires_at - antes >= ttl - timedelta(seconds=5)


def test_emissao_traz_as_duas_formas_do_segredo(db_session: Session):
    """Código digitável e valor opaco na MESMA linha (emenda à ADR-0044)."""
    service = _service(db_session)
    user = _usuario(db_session)

    emitido = service.emitir(user=user, purpose=VERIFICACAO)

    assert len(emitido.codigo) == 6 and emitido.codigo.isdigit()
    assert len(emitido.valor) > 40  # opaco, para o link da recuperação
    guardado = db_session.scalars(
        select(SingleUseToken).where(SingleUseToken.user_id == user.id)
    ).one()
    assert guardado.code_hash == hash_opaque_token(emitido.codigo)


def test_consumir_por_uma_forma_queima_a_outra(db_session: Session):
    """São duas formas do mesmo segredo — não dois segredos."""
    service = _service(db_session)
    user = _usuario(db_session)
    emitido = service.emitir(user=user, purpose=RESET)

    assert service.consumir(valor=emitido.valor, purpose=RESET) is not None

    assert service.consumir_codigo(user=user, purpose=RESET, codigo=emitido.codigo) is None


# -- consumo -------------------------------------------------------------


def test_consumir_queima_o_token(db_session: Session):
    service = _service(db_session)
    user = _usuario(db_session)
    emitido = service.emitir(user=user, purpose=VERIFICACAO)

    token = service.consumir(valor=emitido.valor, purpose=VERIFICACAO)

    assert token is not None
    assert token.user_id == user.id
    assert token.used_at is not None


def test_token_usado_nao_vale_de_novo(db_session: Session):
    """Uso único é a invariante inteira desta tabela."""
    service = _service(db_session)
    user = _usuario(db_session)
    emitido = service.emitir(user=user, purpose=VERIFICACAO)
    assert service.consumir(valor=emitido.valor, purpose=VERIFICACAO) is not None

    assert service.consumir(valor=emitido.valor, purpose=VERIFICACAO) is None


def test_token_de_um_proposito_nao_serve_ao_outro(db_session: Session):
    """A propriedade que justifica UMA tabela com `purpose`: verificar endereço
    não pode virar troca de senha."""
    service = _service(db_session)
    user = _usuario(db_session)
    emitido = service.emitir(user=user, purpose=VERIFICACAO)

    assert service.consumir(valor=emitido.valor, purpose=RESET) is None
    # E o token continua válido para o propósito certo — a tentativa errada
    # não o queima (senão viraria um jeito de invalidar token dos outros).
    assert service.consumir(valor=emitido.valor, purpose=VERIFICACAO) is not None


def test_token_expirado_nao_vale(db_session: Session):
    service = _service(db_session)
    user = _usuario(db_session)
    emitido = service.emitir(user=user, purpose=RESET)

    guardado = db_session.scalars(
        select(SingleUseToken).where(SingleUseToken.user_id == user.id)
    ).one()
    guardado.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.flush()

    assert service.consumir(valor=emitido.valor, purpose=RESET) is None


def test_valor_desconhecido_nao_vale(db_session: Session):
    service = _service(db_session)
    _usuario(db_session)

    assert service.consumir(valor="nao-existe", purpose=VERIFICACAO) is None


# -- reemissão -----------------------------------------------------------


def test_reemitir_invalida_o_anterior(db_session: Session):
    """"Reenviar" não pode deixar N tokens vivos por conta (ADR-0044, item 8)."""
    service = _service(db_session)
    user = _usuario(db_session)
    primeiro = service.emitir(user=user, purpose=VERIFICACAO)

    segundo = service.emitir(user=user, purpose=VERIFICACAO)

    assert service.consumir(valor=primeiro.valor, purpose=VERIFICACAO) is None
    assert service.consumir(valor=segundo.valor, purpose=VERIFICACAO) is not None


def test_reemitir_nao_afeta_o_outro_proposito(db_session: Session):
    """Superseder é por par (usuário, propósito) — pedir reset não derruba a
    verificação que a pessoa ainda não abriu."""
    service = _service(db_session)
    user = _usuario(db_session)
    verificacao = service.emitir(user=user, purpose=VERIFICACAO)

    service.emitir(user=user, purpose=RESET)

    assert service.consumir(valor=verificacao.valor, purpose=VERIFICACAO) is not None


def test_reemitir_nao_afeta_outra_pessoa(db_session: Session):
    service = _service(db_session)
    uma, outra = _usuario(db_session), _usuario(db_session)
    dela = service.emitir(user=uma, purpose=VERIFICACAO)

    service.emitir(user=outra, purpose=VERIFICACAO)

    assert service.consumir(valor=dela.valor, purpose=VERIFICACAO) is not None


def test_emissao_limpa_os_expirados_da_pessoa(db_session: Session):
    """Limpeza oportunista: sem isso a tabela acumula lixo sem um job."""
    service = _service(db_session)
    user = _usuario(db_session)
    service.emitir(user=user, purpose=VERIFICACAO)
    velho = db_session.scalars(
        select(SingleUseToken).where(SingleUseToken.user_id == user.id)
    ).one()
    velho.expires_at = datetime.now(UTC) - timedelta(days=1)
    db_session.flush()

    service.emitir(user=user, purpose=VERIFICACAO)

    restantes = db_session.scalars(
        select(SingleUseToken).where(SingleUseToken.user_id == user.id)
    ).all()
    assert len(restantes) == 1  # só o recém-emitido


# -- envio de e-mail -----------------------------------------------------


def test_console_sender_so_em_desenvolvimento():
    """Fail-closed (ADR-0044, item 3): fora de dev sem provedor, não sobe."""
    settings = get_settings()

    em_dev = settings.model_copy(update={"app_env": "development"})
    assert isinstance(build_email_sender(em_dev), ConsoleEmailSender)

    for ambiente in ("production", "staging"):
        with pytest.raises(RuntimeError):
            build_email_sender(settings.model_copy(update={"app_env": ambiente}))


def test_null_sender_falha_alto():
    """"Não configurado" falha alto — nunca engole a mensagem em silêncio."""
    with pytest.raises(EmailSendError):
        NullEmailSender().send(to="alguem@example.com", subject="oi", body="corpo")


def test_console_sender_imprime_o_corpo(capsys):
    """Em dev o corpo (com o link) tem que aparecer — é o que torna o fluxo
    testável sem provedor."""
    ConsoleEmailSender().send(
        to="sintetico@example.com", subject="Confirme seu e-mail", body="link-ficticio"
    )

    saida = capsys.readouterr().out
    assert "sintetico@example.com" in saida
    assert "link-ficticio" in saida
