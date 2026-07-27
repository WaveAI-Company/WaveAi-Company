"""Regras das anotações de contexto (ADR-0037).

Espelha o `ResultService`: dado do titular, **cifrado**, com leitura auditada e
governada por CareLink na camada de rota. O que muda é a **origem** (autorrelato
do paciente, não derivado do sinal) e a **cardinalidade** (uma nota por sessão,
editável).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from ..models.annotation import AnnotationAccessAction, SessionAnnotation
from ..models.user import User
from ..repositories.annotation import AnnotationRepository
from ..repositories.session import CaptureSessionRepository
from ..security.crypto import MetricsCipher


class SessionNotFoundError(Exception):
    """A sessão não existe ou não pertence ao titular indicado.

    Mensagem única (404) de propósito: não distingue "não existe" de "não é sua",
    para não virar oráculo de sessões de terceiros.
    """


class AnnotationService:
    def __init__(self, *, session: Session, cipher: MetricsCipher) -> None:
        self._session = session
        self._cipher = cipher
        self._repo = AnnotationRepository(session)
        self._sessions = CaptureSessionRepository(session)

    # -- escrita (só o titular, na própria sessão) ----------------------

    def definir(self, *, titular: User, session_id: uuid.UUID, texto: str) -> dict[str, Any]:
        """Cria ou atualiza a nota de contexto da sessão do titular (upsert)."""
        self._exigir_sessao_do_titular(session_id, titular)
        nota, criada = self._repo.upsert(
            session_id=session_id,
            patient_user_id=titular.id,
            note_encrypted=self._cipher.encrypt({"note": texto}),
        )
        self._repo.auditar(
            patient_user_id=titular.id,
            actor_user_id=titular.id,
            action=(
                AnnotationAccessAction.CREATED if criada else AnnotationAccessAction.UPDATED
            ),
        )
        return self._para_dict(nota)

    # -- leitura (titular ou profissional com CareLink) -----------------

    def obter(
        self, *, titular: User, ator: User, session_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """Lê a nota da sessão do titular. Devolve `None` se não houver nota.

        Audita como **leitura** (o titular vê a própria, ou o profissional com
        CareLink — a autorização vive na rota). Só audita quando há o que ler.
        """
        self._exigir_sessao_do_titular(session_id, titular)
        nota = self._repo.get_por_sessao(session_id)
        if nota is None:
            return None
        self._repo.auditar(
            patient_user_id=titular.id,
            actor_user_id=ator.id,
            action=AnnotationAccessAction.READ,
        )
        return self._para_dict(nota)

    # -- exclusão da nota (só o titular) --------------------------------

    def apagar(self, *, titular: User, session_id: uuid.UUID) -> bool:
        self._exigir_sessao_do_titular(session_id, titular)
        apagada = self._repo.apagar_por_sessao(session_id)
        if apagada:
            self._repo.auditar(
                patient_user_id=titular.id,
                actor_user_id=titular.id,
                action=AnnotationAccessAction.DELETED,
            )
        return apagada

    # -- direitos do titular (portabilidade / erasure em massa) ---------

    def exportar(self, *, titular: User) -> list[dict[str, Any]]:
        """Todas as notas do titular, decifradas, para o export de portabilidade."""
        notas = self._repo.listar_do_paciente(titular.id)
        if notas:
            self._repo.auditar(
                patient_user_id=titular.id,
                actor_user_id=titular.id,
                action=AnnotationAccessAction.EXPORTED,
                count=len(notas),
            )
        return [self._para_dict(n) for n in notas]

    def apagar_tudo(self, *, titular: User) -> int:
        """Apaga TODAS as notas do titular (erasure). Auditado."""
        quantidade = self._repo.apagar_do_paciente(titular.id)
        if quantidade:
            self._repo.auditar(
                patient_user_id=titular.id,
                actor_user_id=titular.id,
                action=AnnotationAccessAction.DELETED,
                count=quantidade,
            )
        return quantidade

    # -- interno --------------------------------------------------------

    def _exigir_sessao_do_titular(self, session_id: uuid.UUID, titular: User) -> None:
        sessao = self._sessions.get(session_id)
        if sessao is None or sessao.patient_user_id != titular.id:
            raise SessionNotFoundError
        return None

    def _para_dict(self, nota: SessionAnnotation) -> dict[str, Any]:
        conteudo = self._cipher.decrypt(nota.note_encrypted)
        return {
            "session_id": str(nota.session_id),
            "note": conteudo.get("note", ""),
            "created_at": nota.created_at.isoformat(),
            "updated_at": nota.updated_at.isoformat(),
        }
