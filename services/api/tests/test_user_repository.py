"""Testes de persistência de usuários (contra PostgreSQL real)."""

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import DoctorProfile, PatientProfile, User, UserRole
from app.repositories import UserRepository
from app.security.password import Argon2PasswordHasher, PasswordHasher

SENHA = "senha-de-teste-bem-longa"


@pytest.fixture
def repo(db_session: Session, hasher: PasswordHasher) -> UserRepository:
    return UserRepository(db_session, hasher)


def _email() -> str:
    """E-mail único por teste (a tabela tem índice único)."""
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def test_cria_paciente_com_perfil(repo: UserRepository, db_session: Session):
    user = repo.create(
        email=_email(), password=SENHA, role=UserRole.PATIENT, display_name="Paciente Fictício"
    )

    assert user.id is not None
    assert user.role is UserRole.PATIENT
    assert user.is_active is True
    assert user.token_version == 0
    assert db_session.get(PatientProfile, user.id) is not None
    assert db_session.get(DoctorProfile, user.id) is None


def test_cria_medico_com_perfil(repo: UserRepository, db_session: Session):
    user = repo.create(
        email=_email(), password=SENHA, role=UserRole.DOCTOR, display_name="Médico Fictício"
    )

    assert user.role is UserRole.DOCTOR
    assert db_session.get(DoctorProfile, user.id) is not None
    assert db_session.get(PatientProfile, user.id) is None


def test_senha_nunca_e_persistida_em_claro(repo: UserRepository, db_session: Session):
    user = repo.create(
        email=_email(), password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
    )
    db_session.flush()

    # Confere direto no banco, não só no objeto em memória.
    armazenado = db_session.execute(
        User.__table__.select().where(User.id == user.id)
    ).mappings().one()
    assert SENHA not in armazenado["password_hash"]
    assert armazenado["password_hash"].startswith("$argon2id$")


def test_email_e_normalizado_na_escrita_e_na_busca(repo: UserRepository):
    bruto = _email().upper()
    repo.create(
        email=f"  {bruto}  ", password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
    )

    encontrado = repo.get_by_email(bruto.lower())
    assert encontrado is not None
    assert encontrado.email == bruto.lower()
    # Também encontra buscando com caixa/espaços diferentes.
    assert repo.get_by_email(f"  {bruto}  ") is not None


@pytest.mark.parametrize(
    "invalido",
    ["", "   ", "sem-arroba", "@sem-local.com", "dois@@arrobas.com", "espaco no@meio.com"],
)
def test_email_invalido_e_rejeitado(repo: UserRepository, invalido: str):
    with pytest.raises(ValueError):
        repo.create(
            email=invalido, password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
        )


def test_email_duplicado_e_rejeitado(repo: UserRepository, db_session: Session):
    email = _email()
    repo.create(email=email, password=SENHA, role=UserRole.PATIENT, display_name="Primeiro")

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            repo.create(
                email=email.upper(), password=SENHA, role=UserRole.DOCTOR, display_name="Segundo"
            )


def test_get_by_id_e_by_email_inexistentes(repo: UserRepository):
    assert repo.get_by_id(uuid.uuid4()) is None
    assert repo.get_by_email("ninguem@example.com") is None


def test_verify_password(repo: UserRepository):
    user = repo.create(
        email=_email(), password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
    )

    assert repo.verify_password(user, SENHA) is True
    assert repo.verify_password(user, "senha-errada") is False


def test_verify_password_regrava_hash_quando_parametros_endurecem(db_session: Session):
    # Cria com parâmetros fracos...
    fraco = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    user = UserRepository(db_session, fraco).create(
        email=_email(), password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
    )
    hash_antigo = user.password_hash

    # ...e verifica com parâmetros mais fortes: o hash deve ser atualizado.
    forte = Argon2PasswordHasher(memory_cost=64, time_cost=3, parallelism=1)
    assert UserRepository(db_session, forte).verify_password(user, SENHA) is True

    assert user.password_hash != hash_antigo
    assert forte.needs_rehash(user.password_hash) is False


def test_set_password_troca_o_hash(repo: UserRepository):
    user = repo.create(
        email=_email(), password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
    )
    anterior = user.password_hash

    repo.set_password(user, "outra-senha-bem-longa")

    assert user.password_hash != anterior
    assert repo.verify_password(user, "outra-senha-bem-longa") is True
    assert repo.verify_password(user, SENHA) is False


def test_revoke_tokens_incrementa_a_versao(repo: UserRepository):
    user = repo.create(
        email=_email(), password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
    )

    repo.revoke_tokens(user)

    assert user.token_version == 1


def test_delete_remove_o_perfil_em_cascata(repo: UserRepository, db_session: Session):
    user = repo.create(
        email=_email(), password=SENHA, role=UserRole.PATIENT, display_name="Fulano"
    )
    user_id = user.id

    repo.delete(user)

    assert db_session.get(User, user_id) is None
    assert db_session.get(PatientProfile, user_id) is None
