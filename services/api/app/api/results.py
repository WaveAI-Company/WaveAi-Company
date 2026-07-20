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

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..consent import CONSENT_TERM_VERSION
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
from .schemas import ConsentRequest

router = APIRouter(tags=["results"])


# -- consentimento (ADR-0026) -------------------------------------------


@router.post("/me/consent", status_code=status.HTTP_204_NO_CONTENT)
def dar_consentimento(
    payload: ConsentRequest | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Response:
    """Registra o consentimento informado para persistir dados derivados.

    O app envia a versão do termo que exibiu; se ela não bater com a vigente, a
    API recusa (409) — consentir a um texto desatualizado não é informado.
    Registramos a versão aceita (Medical/72 §2). Sem isto, o gate impede a
    gravação de qualquer Result.
    """
    versao_cliente = payload.version if payload else None
    if versao_cliente is not None and versao_cliente != CONSENT_TERM_VERSION:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="termo desatualizado; recarregue o consentimento",
        )
    # Re-aceitar um termo mais novo renova a data e a versão.
    if user.consent_given_at is None or user.consent_version != CONSENT_TERM_VERSION:
        user.consent_given_at = datetime.now(UTC)
        user.consent_version = CONSENT_TERM_VERSION
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
        user.consent_version = None
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/consent")
def status_consentimento(user: User = Depends(get_current_user)) -> dict:
    return {
        "consent_given": user.consent_given_at is not None,
        "consent_given_at": (
            user.consent_given_at.isoformat() if user.consent_given_at else None
        ),
        #: Versão que o titular aceitou (ou `None`) e a vigente. O app compara
        #: as duas para detectar um termo que mudou e pedir novo aceite.
        "consent_version": user.consent_version,
        "current_version": CONSENT_TERM_VERSION,
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
