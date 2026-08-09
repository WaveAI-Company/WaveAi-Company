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
from ..services.analysis_client import AnalysisClient, AnalysisUnavailableError
from ..services.annotation import AnnotationService
from ..services.results import ResultService
from ..services.narrator import Narrator
from .deps import (
    Janela,
    get_analysis_client,
    get_annotation_service,
    get_current_user,
    get_narrator,
    get_result_service,
    janela_periodo,
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
    janela: Janela | None = Depends(janela_periodo),
) -> dict:
    """Direito de **acesso**: o titular vê seus próprios Result.

    `?days=N` recorta a janela (ausente = tudo). `window_days` devolve o que foi
    aplicado, para a tela não depender só do próprio estado ao rotular o período.
    """
    results = service.listar(titular=user, ator=user, desde=janela.desde if janela else None)
    session.commit()
    return {"results": results, "window_days": janela.days if janela else None}


@router.get("/me/results/export")
def exportar_meus_dados(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    service: ResultService = Depends(get_result_service),
    annotations: AnnotationService = Depends(get_annotation_service),
) -> dict:
    """Direito de **portabilidade**: exporta tudo do titular em JSON aberto.

    Inclui as **anotações de contexto** (ADR-0037) ao lado dos Result — a
    portabilidade é de tudo o que é do titular, não só do dado derivado.
    """
    export = service.exportar(titular=user)
    export["annotations"] = annotations.exportar(titular=user)
    session.commit()
    return export


@router.delete("/me/results")
def apagar_meus_dados(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    service: ResultService = Depends(get_result_service),
    annotations: AnnotationService = Depends(get_annotation_service),
) -> dict:
    """Direito de **exclusão**: apaga TODOS os Result **e anotações** do titular.

    A nota de contexto é dado do titular (ADR-0037); o erasure a alcança junto
    com os Result — o `DELETE /me/results` não apaga sessões, então a nota não
    sairia pelo `CASCADE` de sessão. Apagar por titular fecha esse buraco.
    """
    apagados = service.apagar_tudo(titular=user)
    notas_apagadas = annotations.apagar_tudo(titular=user)
    session.commit()
    return {"deleted": apagados, "annotations_deleted": notas_apagadas}


# -- leitura pelo médico (RBAC + CareLink ativo + auditoria) -------------


@router.get("/patients/{patient_id}/results")
def results_do_paciente(
    patient_id: uuid.UUID,
    paciente: User = Depends(require_active_care_link),
    ator: User = Depends(require_role(UserRole.DOCTOR)),
    session: Session = Depends(get_session),
    service: ResultService = Depends(get_result_service),
    janela: Janela | None = Depends(janela_periodo),
) -> dict:
    """Médico lê os Result de um paciente. Exige CareLink `active` (403 sem) e
    o acesso fica auditado em nome do titular.

    `?days=N` recorta a janela — o gate do vínculo roda antes e não muda.
    """
    results = service.listar(
        titular=paciente, ator=ator, desde=janela.desde if janela else None
    )
    session.commit()
    return {
        "patient_id": str(paciente.id),
        "results": results,
        "window_days": janela.days if janela else None,
    }


# -- relatório longitudinal (N5) ----------------------------------------


def _relatorio_longitudinal(
    *, titular: User, ator: User, session: Session,
    service: ResultService, analysis: AnalysisClient, narrator: Narrator,
    janela: Janela | None = None,
) -> dict:
    """Monta a série do titular (audita leitura) e pede o relatório à Analysis.

    A ciência (tendências) vive atrás do `AnalysisEngine`; o gateway só entrega a
    série cronológica de features + qualidade e serializa o resultado. A
    `narrative` (N6-b) é a camada de linguagem opcional por cima do sumário
    determinístico — `None` quando desligada ou indisponível (ADR-0035).

    O recorte de período é aplicado **aqui**, no gateway: a Analysis recebe uma
    lista de features sem carimbo de tempo e é cega a data por construção —
    mandar janela para lá seria empurrar regra de domínio para dentro do
    `AnalysisEngine`."""
    serie = service.serie_longitudinal(
        titular=titular, ator=ator, desde=janela.desde if janela else None
    )
    session.commit()

    if not serie["sessions"]:
        # Série vazia (janela sem sessões, ou conta nova): **não** chama a
        # Analysis. Ela recusa lista vazia (`min_length=1`), o que virava um 503
        # "analise indisponivel" — uma mentira: o serviço está de pé, é que não
        # há o que analisar. Com o padrão de 30 dias na tela, este deixou de ser
        # um caso de borda. `engine_version` fica nulo porque **nenhum motor
        # rodou** — nada foi computado para carimbar.
        return {
            "patient_id": str(titular.id),
            "n_sessions": 0,
            "period": None,
            "window_days": janela.days if janela else None,
            "engine_version": None,
            "report": {"n_sessions": 0, "features": {}},
            "summary": [],
            "narrative": None,
            "disclaimer": None,
        }

    try:
        resposta = analysis.longitudinal_report(
            serie["sessions"], quality_scores=serie["quality_scores"]
        )
    except AnalysisUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="analise indisponivel",
        ) from None
    report = resposta.get("report", {})
    summary = resposta.get("summary", [])
    return {
        "patient_id": str(titular.id),
        "n_sessions": len(serie["sessions"]),
        #: Intervalo **observado** (primeira e última sessão que entraram) — pode
        #: ser menor que a janela pedida, e é `None` quando não entrou nenhuma.
        "period": serie["period"],
        #: Janela **pedida** em dias (`None` = histórico inteiro). Separado do
        #: `period` de propósito: o design mostra os dois ("últimos 30 dias" na
        #: sobrancelha, "6 jul – 2 ago" embaixo), e sem isto uma janela vazia
        #: viraria um card sem nenhum rótulo de período.
        "window_days": janela.days if janela else None,
        "engine_version": resposta.get("engine_version"),
        "report": report,
        "summary": summary,
        #: Prosa aterrada por LLM (N6-b) — só derivada dos números acima; `None`
        #: cai no `summary` determinístico no app. Nunca quebra o relatório.
        "narrative": narrator.narrate(report, summary),
        "disclaimer": resposta.get("disclaimer"),
    }


@router.get("/me/report/longitudinal")
def meu_relatorio_longitudinal(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    service: ResultService = Depends(get_result_service),
    analysis: AnalysisClient = Depends(get_analysis_client),
    narrator: Narrator = Depends(get_narrator),
    janela: Janela | None = Depends(janela_periodo),
) -> dict:
    """Titular vê o **relatório longitudinal** das próprias sessões (N5).

    `?days=N` restringe as tendências às últimas N dias (ausente = tudo).
    """
    return _relatorio_longitudinal(
        titular=user, ator=user, session=session, service=service,
        analysis=analysis, narrator=narrator, janela=janela,
    )


@router.get("/patients/{patient_id}/report/longitudinal")
def relatorio_longitudinal_do_paciente(
    patient_id: uuid.UUID,
    paciente: User = Depends(require_active_care_link),
    ator: User = Depends(require_role(UserRole.DOCTOR)),
    session: Session = Depends(get_session),
    service: ResultService = Depends(get_result_service),
    analysis: AnalysisClient = Depends(get_analysis_client),
    narrator: Narrator = Depends(get_narrator),
    janela: Janela | None = Depends(janela_periodo),
) -> dict:
    """Médico vê o relatório longitudinal de um paciente. Exige CareLink `active`
    (403 sem) e o acesso fica auditado em nome do titular.

    `?days=N` restringe as tendências — é o seletor de período do painel.
    """
    return _relatorio_longitudinal(
        titular=paciente, ator=ator, session=session, service=service,
        analysis=analysis, narrator=narrator, janela=janela,
    )
