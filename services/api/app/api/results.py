"""Consentimento e direitos do titular sobre seus Result (ADR-0026 / Medical/72).

Direitos implementados desde já (requisito do gate de produção):
- **Acesso:** `GET /me/results`
- **Exportação (portabilidade):** `GET /me/results/export`
- **Exclusão (erasure):** `DELETE /me/results`
- **Consentimento:** `POST/DELETE /me/consent`

O médico lê os Result de um paciente só com CareLink `active` (ADR-0024), e o
acesso é auditado.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from ..db.session import get_session
from ..models.result import ResultAccessAction
from ..models.user import User, UserRole
from ..services.results import ResultService
from .deps import (
    get_current_user,
    get_result_service,
    require_active_care_link,
    require_role,
)

router = APIRouter(tags=["results"])


# -- consentimento (ADR-0026) -------------------------------------------


@router.post("/me/consent", status_code=status.HTTP_204_NO_CONTENT)
def dar_consentimento(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Response:
    """Registra o consentimento para persistir dados biométricos derivados.

    Registro mínimo que sustenta a base legal; o termo informado completo é a
    #29. Sem isto, o gate impede a gravação de qualquer Result.
    """
    if user.consent_given_at is None:
        user.consent_given_at = datetime.now(UTC)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/consent", status_code=status.HTTP_204_NO_CONTENT)
def revogar_consentimento(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Response:
    """Revoga o consentimento: nenhuma nova coleta é persistida.

    Não apaga o que já existe — a exclusão é um direito **explícito**
    (`DELETE /me/results`), para revogar não destruir dados por engano. A
    política de retenção pós-revogação fica em aberto (Medical/72, §5).
    """
    if user.consent_given_at is not None:
        user.consent_given_at = None
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/consent")
def status_consentimento(user: User = Depends(get_current_user)) -> dict:
    return {
        "consent_given": user.consent_given_at is not None,
        "consent_given_at": (
            user.consent_given_at.isoformat() if user.consent_given_at else None
        ),
    }


# -- direitos do titular sobre os próprios Result -----------------------


@router.get("/me/results")
def meus_results(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    service: ResultService = Depends(get_result_service),
) -> dict:
    """Direito de **acesso**: o titular vê seus próprios Result."""
    results = service.listar(titular=user, ator=user)
    session.commit()
    return {"results": results}


@router.get("/me/results/export")
def exportar_meus_dados(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    service: ResultService = Depends(get_result_service),
) -> dict:
    """Direito de **portabilidade**: exporta tudo do titular em JSON aberto."""
    export = service.exportar(titular=user)
    session.commit()
    return export


@router.delete("/me/results")
def apagar_meus_dados(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    service: ResultService = Depends(get_result_service),
) -> dict:
    """Direito de **exclusão**: apaga TODOS os Result do titular."""
    apagados = service.apagar_tudo(titular=user)
    session.commit()
    return {"deleted": apagados}


# -- leitura pelo médico (RBAC + CareLink ativo + auditoria) -------------


@router.get("/patients/{patient_id}/results")
def results_do_paciente(
    patient_id: uuid.UUID,
    paciente: User = Depends(require_active_care_link),
    ator: User = Depends(require_role(UserRole.DOCTOR)),
    session: Session = Depends(get_session),
    service: ResultService = Depends(get_result_service),
) -> dict:
    """Médico lê os Result de um paciente. Exige CareLink `active` (403 sem) e
    o acesso fica auditado em nome do titular."""
    results = service.listar(titular=paciente, ator=ator)
    session.commit()
    return {"patient_id": str(paciente.id), "results": results}
