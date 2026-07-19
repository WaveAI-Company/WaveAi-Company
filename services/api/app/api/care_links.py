"""Rotas de vínculo médico-paciente (ADR-0024)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db.session import get_session
from ..models.care_link import CareLink
from ..models.user import User, UserRole
from ..services.care import CareLinkError, CareService, NotAllowedError
from .deps import get_care_service, get_current_user, require_active_care_link
from .schemas import CareLinkRequest, CareLinkResponse, PatientSummary

router = APIRouter(tags=["care-links"])

#: Resposta única do convite: exista ou não a conta, o solicitante vê isto.
#: Sem essa uniformidade, a rota viraria um oráculo de "quem tem WaveAI".
SOLICITACAO_REGISTRADA = {"detail": "solicitacao registrada"}


def _para_resposta(link: CareLink, eu: User) -> CareLinkResponse:
    """Mostra a contraparte — cada lado vê o outro, nunca dados de terceiros."""
    contraparte = link.patient if eu.role is UserRole.DOCTOR else link.doctor
    perfil = contraparte.patient_profile or contraparte.doctor_profile
    return CareLinkResponse(
        id=link.id,
        status=link.status,
        initiated_by=link.initiated_by,
        counterpart_user_id=contraparte.id,
        counterpart_display_name=perfil.display_name if perfil else None,
        counterpart_role=contraparte.role,
        created_at=link.created_at,
        consented_at=link.consented_at,
    )


@router.post("/care-links", status_code=status.HTTP_202_ACCEPTED)
def solicitar_vinculo(
    payload: CareLinkRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    care: CareService = Depends(get_care_service),
) -> dict[str, str]:
    """Solicita vínculo com a contraparte pelo e-mail.

    Médico → cria `pending` (não concede acesso). Paciente → já nasce `active`,
    pois o próprio ato dele é o consentimento.

    A resposta é **sempre a mesma**, mesmo se o e-mail não existir.
    """
    care.solicitar(solicitante=user, email_contraparte=payload.email)
    session.commit()
    return SOLICITACAO_REGISTRADA


@router.get("/care-links", response_model=list[CareLinkResponse])
def listar_vinculos(
    user: User = Depends(get_current_user),
    care: CareService = Depends(get_care_service),
) -> list[CareLinkResponse]:
    """Vínculos vivos do usuário (médico vê pacientes; paciente vê médicos)."""
    return [_para_resposta(link, user) for link in care.listar(user)]


@router.post("/care-links/{care_link_id}/accept", response_model=CareLinkResponse)
def aceitar_vinculo(
    care_link_id: uuid.UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    care: CareService = Depends(get_care_service),
) -> CareLinkResponse:
    """Consentimento do paciente — o único caminho para `active` via convite."""
    try:
        link = care.aceitar(care_link_id=care_link_id, ator=user)
    except NotAllowedError:
        # Mesmo erro para "não existe" e "não é seu": nada de vazar existência.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="vinculo nao encontrado"
        ) from None
    except CareLinkError:
        # Só erros de regra viram 409; qualquer outra exceção deve subir como
        # 500 em vez de ser mascarada aqui.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="vinculo nao esta pendente"
        ) from None
    session.commit()
    return _para_resposta(link, user)


@router.post("/care-links/{care_link_id}/revoke", response_model=CareLinkResponse)
def revogar_vinculo(
    care_link_id: uuid.UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    care: CareService = Depends(get_care_service),
) -> CareLinkResponse:
    """Revogação por qualquer uma das partes, com efeito imediato."""
    try:
        link = care.revogar(care_link_id=care_link_id, ator=user)
    except NotAllowedError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vinculo nao encontrado") from None
    session.commit()
    return _para_resposta(link, user)


@router.get("/patients/{patient_id}", response_model=PatientSummary)
def ver_paciente(
    patient: User = Depends(require_active_care_link),
) -> PatientSummary:
    """Dados do paciente — só com vínculo **ativo** (403 caso contrário).

    A autorização inteira mora na dependência: a rota não tem como servir
    dados sem passar por ela.
    """
    perfil = patient.patient_profile
    return PatientSummary(
        id=patient.id,
        display_name=perfil.display_name if perfil else None,
    )
