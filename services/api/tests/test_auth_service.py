"""Fluxos de autenticação: rotação, reuso e revogação (ADR-0021)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import RefreshToken, UserRole
from app.repositories.refresh_token import RefreshTokenRepository
from app.security.password import PasswordHasher
from app.services.auth import (
    AuthError,
    AuthService,
    EmailAlreadyRegisteredError,
    RefreshReuseError,
)

SENHA = "senha-de-teste-bem-longa"


@pytest.fixture
def settings() -> Settings:
    return Settings(jwt_secret="z" * 48, _env_file=None)


@pytest.fixture
def service(db_session: Session, settings: Settings, hasher: PasswordHasher) -> AuthService:
    return AuthService(session=db_session, settings=settings, hasher=hasher)


def _email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _registrar(service: AuthService, email: str | None = None):
    return service.register(
        email=email or _email(), password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
    )


# -- registro / login ----------------------------------------------------


def test_registro_e_login(service: AuthService):
    user = _registrar(service)
    tokens = service.login(email=user.email, password=SENHA)

    assert tokens.access_token
    assert tokens.refresh_token
    assert tokens.expires_in == 15 * 60


def test_registro_duplicado_e_rejeitado(service: AuthService):
    email = _email()
    _registrar(service, email)
    with pytest.raises(EmailAlreadyRegisteredError):
        _registrar(service, email.upper())


def test_login_com_senha_errada_falha(service: AuthService):
    user = _registrar(service)
    with pytest.raises(AuthError):
        service.login(email=user.email, password="senha-errada")


def test_login_de_email_inexistente_falha_igual(service: AuthService):
    # Mesmo tipo de erro do caso "senha errada": nada de enumerar contas.
    with pytest.raises(AuthError):
        service.login(email="ninguem@example.com", password=SENHA)


def test_login_de_email_malformado_nao_vaza_erro_de_validacao(service: AuthService):
    with pytest.raises(AuthError):
        service.login(email="nao-e-email", password=SENHA)


def test_conta_inativa_nao_loga(service: AuthService, db_session: Session):
    user = _registrar(service)
    user.is_active = False
    db_session.flush()

    with pytest.raises(AuthError):
        service.login(email=user.email, password=SENHA)


# -- rotação -------------------------------------------------------------


def test_refresh_rotaciona_e_mantem_a_familia(service: AuthService, db_session: Session):
    user = _registrar(service)
    primeiro = service.login(email=user.email, password=SENHA)

    segundo = service.refresh(primeiro.refresh_token)

    assert segundo.refresh_token != primeiro.refresh_token
    tokens = db_session.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user.id)
    ).all()
    assert len(tokens) == 2
    assert len({t.family_id for t in tokens}) == 1  # mesma família
    usados = [t for t in tokens if t.used_at is not None]
    assert len(usados) == 1  # só o antigo foi marcado como usado


def test_refresh_desconhecido_falha(service: AuthService):
    with pytest.raises(AuthError):
        service.refresh("token-que-nunca-existiu")


def test_refresh_expirado_falha(service: AuthService, db_session: Session):
    user = _registrar(service)
    tokens = service.login(email=user.email, password=SENHA)

    registro = RefreshTokenRepository(db_session).get_by_raw(tokens.refresh_token)
    registro.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.flush()

    with pytest.raises(AuthError):
        service.refresh(tokens.refresh_token)


# -- detecção de reuso (o ponto central do ADR-0021) ---------------------


def test_reuso_de_refresh_revoga_a_familia_inteira(service: AuthService, db_session: Session):
    user = _registrar(service)
    t1 = service.login(email=user.email, password=SENHA)
    t2 = service.refresh(t1.refresh_token)   # t1 vira "usado"
    t3 = service.refresh(t2.refresh_token)   # cadeia continua

    # O atacante reapresenta um token já rotacionado.
    with pytest.raises(RefreshReuseError):
        service.refresh(t1.refresh_token)

    # Toda a família cai — inclusive o token válido que a vítima tinha.
    tokens = db_session.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user.id)
    ).all()
    assert all(t.revoked_at is not None for t in tokens)

    with pytest.raises(AuthError):
        service.refresh(t3.refresh_token)


def test_reuso_nao_afeta_outros_logins_do_mesmo_usuario(
    service: AuthService, db_session: Session
):
    user = _registrar(service)
    dispositivo_a = service.login(email=user.email, password=SENHA)
    dispositivo_b = service.login(email=user.email, password=SENHA)

    rotacionado_a = service.refresh(dispositivo_a.refresh_token)
    with pytest.raises(RefreshReuseError):
        service.refresh(dispositivo_a.refresh_token)

    # A família do outro dispositivo continua válida.
    assert service.refresh(dispositivo_b.refresh_token) is not None
    with pytest.raises(AuthError):
        service.refresh(rotacionado_a.refresh_token)


# -- logout --------------------------------------------------------------


def test_logout_revoga_a_familia_do_dispositivo(service: AuthService):
    user = _registrar(service)
    tokens = service.login(email=user.email, password=SENHA)

    service.logout(tokens.refresh_token)

    with pytest.raises(AuthError):
        service.refresh(tokens.refresh_token)


def test_logout_global_invalida_todos_os_dispositivos(service: AuthService):
    user = _registrar(service)
    a = service.login(email=user.email, password=SENHA)
    b = service.login(email=user.email, password=SENHA)

    service.logout_all(user)

    for tokens in (a, b):
        with pytest.raises(AuthError):
            service.refresh(tokens.refresh_token)
    assert user.token_version == 1
