"""Rotas de vínculo médico-paciente (ADR-0024)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db.session import get_session
from ..emails import (
    ASSUNTO_ACESSO_AUTORIZADO,
    ASSUNTO_CONVITE,
    ASSUNTO_CONVITE_LEMBRETE,
    corpo_acesso_autorizado,
    corpo_convite,
)
from ..models.care_link import CareLink, CareLinkParty, CareLinkStatus
from ..models.user import User, UserRole
from ..services.care import (
    CareLinkError,
    CareService,
    CooldownError,
    NotAllowedError,
)
from ..services.email import EmailSender
from .deps import (
    get_care_service,
    get_current_user,
    get_email_sender,
    require_active_care_link,
)
from .schemas import CareLinkRequest, CareLinkResponse, PatientSummary

router = APIRouter(tags=["care-links"])

#: Resposta única do convite: exista ou não a conta, o solicitante vê isto.
#: Sem essa uniformidade, a rota viraria um oráculo de "quem tem WaveAI".
SOLICITACAO_REGISTRADA = {"detail": "solicitacao registrada"}


def _para_resposta(link: CareLink, eu: User, care: CareService) -> CareLinkResponse:
    """Mostra a contraparte — cada lado vê o outro, nunca dados de terceiros."""
    contraparte = link.patient if eu.role is UserRole.DOCTOR else link.doctor
    perfil = contraparte.patient_profile or contraparte.doctor_profile
    return CareLinkResponse(
        id=link.id,
        status=link.status,
        initiated_by=link.initiated_by,
        counterpart_user_id=contraparte.id,
        counterpart_display_name=perfil.display_name if perfil else None,
        # Só enquanto pende (ver o schema): decidir e lembrar precisam do
        # endereço; acompanhar, não.
        counterpart_email=(
            contraparte.email if link.status is CareLinkStatus.PENDING else None
        ),
        counterpart_role=contraparte.role,
        #: Recado do convite (ADR-0043). Vai para os DOIS lados: quem escreveu
        #: precisa ver o que mandou na lista de convites enviados, e quem
        #: recebeu é o destinatário. Ninguém além das duas partes chega aqui.
        message=care.mensagem_do_convite(link),
        created_at=link.created_at,
        consented_at=link.consented_at,
    )


@router.post("/care-links", status_code=status.HTTP_202_ACCEPTED)
def solicitar_vinculo(
    payload: CareLinkRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    care: CareService = Depends(get_care_service),
    sender: EmailSender = Depends(get_email_sender),
) -> dict[str, str]:
    """Solicita vínculo com a contraparte pelo e-mail.

    Médico → cria `pending` (não concede acesso). Paciente → já nasce `active`,
    pois o próprio ato dele é o consentimento.

    A resposta é **sempre a mesma**, mesmo se o e-mail não existir — e é por
    isso que o aviso vai por e-mail, para a contraparte, e não na resposta.

    **Só quem já tem conta é avisado.** Não existe convite frio: sem isso,
    qualquer pessoa logada faria o WaveAI mandar e-mail para estranhos.
    """
    resultado = care.solicitar(
        solicitante=user,
        email_contraparte=payload.email,
        mensagem=payload.message,
    )
    if resultado.criado and resultado.link is not None:
        _avisar_contraparte(resultado.link, sender)
    session.commit()
    return SOLICITACAO_REGISTRADA


def _avisar_contraparte(link: CareLink, sender: EmailSender) -> None:
    """Manda o e-mail certo para o lado certo, conforme quem iniciou.

    Convite do profissional nasce `pending` e pede decisão; vínculo iniciado
    pelo paciente já nasce `active` e o profissional só precisa saber que
    ganhou acesso. São situações diferentes e o texto acompanha.
    """
    if link.initiated_by is CareLinkParty.DOCTOR:
        sender.send(
            to=link.patient.email,
            subject=ASSUNTO_CONVITE,
            body=corpo_convite(de_profissional=True),
        )
    else:
        sender.send(
            to=link.doctor.email,
            subject=ASSUNTO_ACESSO_AUTORIZADO,
            body=corpo_acesso_autorizado(),
        )


@router.get("/care-links", response_model=list[CareLinkResponse])
def listar_vinculos(
    user: User = Depends(get_current_user),
    care: CareService = Depends(get_care_service),
) -> list[CareLinkResponse]:
    """Vínculos vivos do usuário (médico vê pacientes; paciente vê médicos)."""
    return [_para_resposta(link, user, care) for link in care.listar(user)]


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
    return _para_resposta(link, user, care)


@router.post("/care-links/{care_link_id}/decline", response_model=CareLinkResponse)
def recusar_vinculo(
    care_link_id: uuid.UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    care: CareService = Depends(get_care_service),
) -> CareLinkResponse:
    """Recusa do paciente — o convite vai para `declined`, sem conceder acesso."""
    try:
        link = care.recusar(care_link_id=care_link_id, ator=user)
    except NotAllowedError:
        # Mesmo 404 do accept: não distingue "não existe" de "não é seu".
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="vinculo nao encontrado"
        ) from None
    except CareLinkError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="vinculo nao esta pendente"
        ) from None
    session.commit()
    return _para_resposta(link, user, care)


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="vinculo nao encontrado"
        ) from None
    session.commit()
    return _para_resposta(link, user, care)


@router.post("/care-links/{care_link_id}/resend", response_model=CareLinkResponse)
def reenviar_convite(
    care_link_id: uuid.UUID,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    care: CareService = Depends(get_care_service),
    settings: Settings = Depends(get_settings),
    sender: EmailSender = Depends(get_email_sender),
) -> CareLinkResponse:
    """Lembra a contraparte de um convite ainda pendente.

    **Não reescreve nada**: o recado do convite é imutável (ADR-0043), e este
    e-mail nem o carrega. Reenviar é cutucar, e fica registrado como tal
    (`resent` na trilha) — numa disputa sobre insistência, quem responde é o
    histórico, não o estado final.

    `429` quando o lembrete anterior saiu há pouco: a caixa que recebe é de
    outra pessoa, que não pediu nada.
    """
    try:
        link = care.reenviar(care_link_id=care_link_id, ator=user)
    except NotAllowedError:
        # Mesmo 404 do accept/decline: não distingue "não existe" de "não é seu".
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="vinculo nao encontrado"
        ) from None
    except CooldownError:
        minutos = max(1, settings.invite_resend_cooldown_seconds // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"lembrete enviado ha pouco; tente novamente em ate {minutos} min",
        ) from None
    except CareLinkError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="vinculo nao esta pendente"
        ) from None

    contraparte = link.patient if link.initiated_by is CareLinkParty.DOCTOR else link.doctor
    sender.send(
        to=contraparte.email,
        subject=ASSUNTO_CONVITE_LEMBRETE,
        body=corpo_convite(
            de_profissional=link.initiated_by is CareLinkParty.DOCTOR, lembrete=True
        ),
    )
    session.commit()
    return _para_resposta(link, user, care)


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
