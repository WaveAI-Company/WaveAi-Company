"""Expurgo da trilha de leitura pseudonimizada (emenda à ADR-0047).

O que estes testes protegem, em ordem de gravidade:

1. **Trilha de ator vivo nunca expira.** É a garantia da ADR-0037. O jeito
   realista de quebrá-la é o expurgo passar a olhar a data do **evento** em vez
   da data da pseudonimização — e é isso que o teste correspondente pega.
2. **O prazo é respeitado dos dois lados.** Não basta apagar o velho: apagar o
   que ainda não venceu tira do titular evidência que a Política prometeu
   manter. Por isso o limite é medido com um registro de cada lado da fronteira.
3. **A data existe.** Sem `pseudonymized_at`, o prazo é inexequível.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from app.config import get_settings
from app.models.annotation import AnnotationAccessAction, AnnotationAccessEvent
from app.models.live_view import LiveViewAccessEvent
from app.models.result import ResultAccessAction, ResultAccessEvent
from app.models.user import UserRole
from app.security.password import Argon2PasswordHasher
from app.services.audit_retention import expurgar_trilha_pseudonimizada
from sqlalchemy import select
from sqlalchemy.orm import Session

SENHA = "senha-sintetica-1"


def _hasher() -> Argon2PasswordHasher:
    return Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)


def _usuario(db_session: Session, papel: UserRole):
    from app.repositories.user import UserRepository

    usuario = UserRepository(db_session, _hasher()).create(
        email=f"user-{uuid.uuid4().hex[:12]}@example.com",
        password=SENHA,
        role=papel,
        display_name="Sintetico",
    )
    db_session.flush()
    return usuario


def _leitura_pseudonimizada(db_session: Session, *, titular_id, dias_atras: int):
    """Um registro de leitura órfão, pseudonimizado há `dias_atras` dias."""
    evento = ResultAccessEvent(
        patient_user_id=titular_id,
        actor_user_id=None,
        actor_pseudonym=uuid.uuid4(),
        pseudonymized_at=datetime.now(UTC) - timedelta(days=dias_atras),
        action=ResultAccessAction.READ,
        count=1,
    )
    db_session.add(evento)
    db_session.flush()
    return evento


def test_apaga_o_vencido_e_poupa_o_que_ainda_nao_venceu(db_session: Session):
    """O limite, medido dos dois lados.

    Um registro de cada lado da fronteira. Com só o lado velho, um expurgo que
    apagasse tudo passaria no teste — e tiraria do titular evidência que a
    Política prometeu manter por 12 meses.
    """
    titular = _usuario(db_session, UserRole.PATIENT)
    vencido = _leitura_pseudonimizada(db_session, titular_id=titular.id, dias_atras=366)
    recente = _leitura_pseudonimizada(db_session, titular_id=titular.id, dias_atras=364)

    resultado = expurgar_trilha_pseudonimizada(db_session, retencao_dias=365)
    db_session.flush()

    assert resultado.apagados["result_access_events"] == 1
    sobreviventes = db_session.scalars(
        select(ResultAccessEvent).where(ResultAccessEvent.patient_user_id == titular.id)
    ).all()
    ids = {e.id for e in sobreviventes}
    assert recente.id in ids, "registro dentro do prazo não pode ser apagado"
    assert vencido.id not in ids, "registro vencido tinha de sair"


def test_nunca_toca_trilha_de_ator_vivo_por_mais_antiga_que_seja(db_session: Session):
    """A garantia da ADR-0037.

    O prazo existe para o registro **órfão**, que já não identifica ninguém.
    Enquanto a conta do ator existe, a trilha completa é o que dá ao titular a
    evidência de quem leu seus dados — e ela não expira.

    **O que este teste discrimina, medido e não suposto (2026-08-23):** trocar o
    critério do expurgo para `created_at` o derruba. Já remover apenas o
    `is_not(None)` **não** o derruba — `NULL < corte` é desconhecido em SQL, e a
    linha sobrevive pela comparação sozinha. A condição continua no código como
    declaração de intenção, e o comentário lá diz isso com todas as letras.
    """
    titular = _usuario(db_session, UserRole.PATIENT)
    profissional = _usuario(db_session, UserRole.DOCTOR)
    evento = ResultAccessEvent(
        patient_user_id=titular.id,
        actor_user_id=profissional.id,
        actor_pseudonym=None,
        pseudonymized_at=None,
        action=ResultAccessAction.READ,
        count=1,
    )
    db_session.add(evento)
    db_session.flush()

    resultado = expurgar_trilha_pseudonimizada(
        db_session,
        retencao_dias=0,  # tudo que pudesse expirar, expiraria
        agora=datetime.now(UTC) + timedelta(days=3650),
    )
    db_session.flush()

    assert resultado.total == 0
    assert db_session.get(ResultAccessEvent, evento.id) is not None, (
        "trilha de ator vivo não expira — é a garantia da ADR-0037"
    )


def test_alcanca_as_tres_trilhas_de_leitura(db_session: Session):
    """As três, não só a de Result.

    A ADR-0047 pseudonimiza nas três; expurgar só uma deixaria duas prometendo
    prazo que ninguém cumpre.
    """
    titular = _usuario(db_session, UserRole.PATIENT)
    pseudonimo = uuid.uuid4()
    vencido_em = datetime.now(UTC) - timedelta(days=400)

    db_session.add_all(
        [
            ResultAccessEvent(
                patient_user_id=titular.id,
                actor_user_id=None,
                actor_pseudonym=pseudonimo,
                pseudonymized_at=vencido_em,
                action=ResultAccessAction.READ,
                count=1,
            ),
            AnnotationAccessEvent(
                patient_user_id=titular.id,
                actor_user_id=None,
                actor_pseudonym=pseudonimo,
                pseudonymized_at=vencido_em,
                action=AnnotationAccessAction.READ,
                count=1,
            ),
            LiveViewAccessEvent(
                patient_user_id=titular.id,
                actor_user_id=None,
                actor_pseudonym=pseudonimo,
                pseudonymized_at=vencido_em,
                session_id=None,
            ),
        ]
    )
    db_session.flush()

    resultado = expurgar_trilha_pseudonimizada(db_session, retencao_dias=365)
    db_session.flush()

    assert resultado.apagados == {
        "result_access_events": 1,
        "annotation_access_events": 1,
        "live_view_access_events": 1,
    }


def test_simulacao_conta_e_nao_apaga(db_session: Session):
    """Poder conferir antes de confiar.

    Rodar o expurgo pela primeira vez contra dado real sem saber quanto sairia
    é o tipo de operação que não tem desfazer.
    """
    titular = _usuario(db_session, UserRole.PATIENT)
    evento = _leitura_pseudonimizada(db_session, titular_id=titular.id, dias_atras=400)

    resultado = expurgar_trilha_pseudonimizada(
        db_session, retencao_dias=365, simulacao=True
    )
    db_session.flush()

    assert resultado.simulacao is True
    assert resultado.apagados["result_access_events"] == 1
    assert db_session.get(ResultAccessEvent, evento.id) is not None, (
        "simulação não pode apagar nada"
    )


def test_corte_acompanha_o_resultado(db_session: Session):
    """Quem audita precisa saber até quando a rodada apagou.

    O número sozinho não permite conferir se o prazo foi respeitado.
    """
    agora = datetime(2027, 3, 1, 12, 0, tzinfo=UTC)
    resultado = expurgar_trilha_pseudonimizada(
        db_session, retencao_dias=365, agora=agora
    )
    assert resultado.corte == agora - timedelta(days=365)


def test_prazo_negativo_e_recusado(db_session: Session):
    with pytest.raises(ValueError):
        expurgar_trilha_pseudonimizada(db_session, retencao_dias=-1)


def test_excluir_conta_grava_a_data_da_pseudonimizacao(db_session: Session):
    """Sem esta data, o prazo da Política é inexequível.

    A ADR-0047 gravava só o pseudônimo. A emenda de 2026-08-23 acrescentou o
    "quando", porque é dele que correm os 12 meses — e não da data do evento.
    """
    from app.services.auth import AuthService

    titular = _usuario(db_session, UserRole.PATIENT)
    profissional = _usuario(db_session, UserRole.DOCTOR)
    db_session.add(
        ResultAccessEvent(
            patient_user_id=titular.id,
            actor_user_id=profissional.id,
            action=ResultAccessAction.READ,
            count=2,
        )
    )
    db_session.flush()

    antes = datetime.now(UTC)
    AuthService(
        session=db_session, settings=get_settings(), hasher=_hasher()
    ).excluir_conta(user=profissional)
    db_session.flush()

    evento = db_session.scalars(
        select(ResultAccessEvent).where(ResultAccessEvent.patient_user_id == titular.id)
    ).one()
    assert evento.actor_pseudonym is not None
    assert evento.pseudonymized_at is not None, "sem a data, o prazo não tem de onde correr"
    assert evento.pseudonymized_at >= antes - timedelta(seconds=5)


def test_a_data_do_evento_nao_serve_de_criterio(db_session: Session):
    """Por que a emenda existe.

    Um evento de dois anos atrás, pseudonimizado **hoje**, tem de ficar: quem
    encerra a conta não pode levar consigo a evidência de leituras antigas. Se
    alguém trocar o critério para a data do evento, este teste falha.
    """
    titular = _usuario(db_session, UserRole.PATIENT)
    evento = ResultAccessEvent(
        patient_user_id=titular.id,
        actor_user_id=None,
        actor_pseudonym=uuid.uuid4(),
        pseudonymized_at=datetime.now(UTC),
        action=ResultAccessAction.READ,
        count=1,
    )
    db_session.add(evento)
    db_session.flush()
    # Envelhece só o EVENTO, não a pseudonimização.
    evento.created_at = datetime.now(UTC) - timedelta(days=730)
    db_session.flush()

    resultado = expurgar_trilha_pseudonimizada(db_session, retencao_dias=365)
    db_session.flush()

    assert resultado.total == 0
    assert db_session.get(ResultAccessEvent, evento.id) is not None, (
        "o prazo conta da pseudonimização, não da data do evento"
    )
