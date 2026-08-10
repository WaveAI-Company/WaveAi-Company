"""Anotações de contexto de sessão (ADR-0037).

O titular escreve/edita/apaga a nota da própria sessão; o profissional só **lê**,
e apenas com CareLink `active` (ADR-0024), com o acesso auditado. O texto é
autorrelato do paciente — o profissional nunca o edita.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db.session import get_session
from ..models.user import User, UserRole
from ..services.annotation import AnnotationService, SessionNotFoundError
from .deps import (
    get_annotation_service,
    get_current_user,
    require_active_care_link,
    require_role,
)
from .schemas import AnnotationRequest

router = APIRouter(tags=["annotations"])


def _nao_encontrada() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sessao nao encontrada")


# -- o titular escreve/lê/apaga a nota da própria sessão ----------------


@router.put("/sessions/{session_id}/annotation")
def definir_anotacao(
    session_id: uuid.UUID,
    payload: AnnotationRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    service: AnnotationService = Depends(get_annotation_service),
) -> dict:
    """Cria ou atualiza a nota de contexto de uma sessão do titular."""
    try:
        nota = service.definir(titular=user, session_id=session_id, texto=payload.note)
    except SessionNotFoundError:
        raise _nao_encontrada() from None
    session.commit()
    return nota


@router.get("/sessions/{session_id}/annotation")
def obter_minha_anotacao(
    session_id: uuid.UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    service: AnnotationService = Depends(get_annotation_service),
) -> dict:
    """Titular lê a nota da própria sessão (`annotation` = `null` se não houver)."""
    try:
        nota = service.obter(titular=user, ator=user, session_id=session_id)
    except SessionNotFoundError:
        raise _nao_encontrada() from None
    session.commit()
    return {"annotation": nota}


@router.delete("/sessions/{session_id}/annotation")
def apagar_anotacao(
    session_id: uuid.UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    service: AnnotationService = Depends(get_annotation_service),
) -> dict:
    """Titular apaga a nota da própria sessão."""
    try:
        apagada = service.apagar(titular=user, session_id=session_id)
    except SessionNotFoundError:
        raise _nao_encontrada() from None
    session.commit()
    return {"deleted": apagada}


# -- o profissional lê a nota de um paciente (CareLink + auditoria) ------


@router.get("/patients/{patient_id}/sessions/{session_id}/annotation")
def anotacao_do_paciente(
    patient_id: uuid.UUID,
    session_id: uuid.UUID,
    paciente: User = Depends(require_active_care_link),
    ator: User = Depends(require_role(UserRole.DOCTOR)),
    session: Session = Depends(get_session),
    service: AnnotationService = Depends(get_annotation_service),
) -> dict:
    """Profissional lê a nota de contexto de uma sessão do paciente.

    Exige CareLink `active` (403 sem) e o acesso fica auditado em nome do
    titular. Read-only: o profissional nunca edita o autorrelato do paciente.
    """
    try:
        nota = service.obter(titular=paciente, ator=ator, session_id=session_id)
    except SessionNotFoundError:
        raise _nao_encontrada() from None
    session.commit()
    return {"patient_id": str(paciente.id), "annotation": nota}
