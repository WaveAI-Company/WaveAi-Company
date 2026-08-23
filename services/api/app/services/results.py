"""Regras de Result: persistência com gate de consentimento e direitos do
titular (ADR-0026 / Medical/72).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..config import Settings
from ..models.result import Result, ResultAccessAction
from ..models.user import User
from ..repositories.result import ResultRepository
from ..security.crypto import MetricsCipher


class ConsentRequiredError(Exception):
    """Persistência bloqueada: o titular não consentiu (ADR-0026)."""


class ResultService:
    def __init__(
        self, *, session: Session, settings: Settings, cipher: MetricsCipher
    ) -> None:
        self._session = session
        self._settings = settings
        self._cipher = cipher
        self._repo = ResultRepository(session)

    # -- persistência (gateway, ao encerrar a sessão) --------------------

    def persistir(
        self, *, patient: User, session_id: uuid.UUID, metrics: dict[str, Any]
    ) -> Result | None:
        """Grava o Result do paciente, se permitido.

        Devolve `None` (sem gravar) quando o gate impede — sem consentimento do
        titular, ou persistência desligada (produção antes da #29, ADR-0026). A
        captação em si não é afetada: só o dado derivado deixa de ser gravado.
        """
        if not self._settings.result_persistence_enabled:
            return None
        if patient.consent_given_at is None:
            raise ConsentRequiredError

        engine_version = str(metrics.get("engine_version", "desconhecida"))
        result = self._repo.criar(
            session_id=session_id,
            patient_user_id=patient.id,
            engine_version=engine_version,
            metrics_encrypted=self._cipher.encrypt(metrics),
            device=self._device_de(metrics),
            montage=self._montage_de(metrics),
        )
        self._repo.auditar(
            patient_user_id=patient.id,
            actor_user_id=patient.id,
            action=ResultAccessAction.CREATED,
        )
        return result

    # -- baseline pessoal (uso interno, ADR-0032) -----------------------

    def historico_de_features(self, *, titular: User) -> list[dict[str, Any]]:
        """Features das sessões passadas do titular, para montar o baseline
        pessoal (ADR-0032, opção "derivar dos Result persistidos").

        **Uso interno**: é derivação do próprio pipeline, não um acesso de humano
        aos dados — por isso **não audita** como leitura (diferente de `listar`).
        Result anteriores ao Catálogo N2 (sem `features`) são ignorados. Como só
        lê o que já é do titular, a exclusão dos Result zera o baseline de graça.
        """
        historico: list[dict[str, Any]] = []
        for result in self._repo.listar_do_paciente(titular.id):
            metrics = self._cipher.decrypt(result.metrics_encrypted)
            feats = metrics.get("features")
            if isinstance(feats, dict) and feats:
                historico.append(feats)
        return historico

    # -- relatório longitudinal (N5) ------------------------------------

    def serie_longitudinal(
        self, *, titular: User, ator: User, desde: datetime | None = None
    ) -> dict[str, Any]:
        """Série **cronológica** (mais antiga → mais recente) de features +
        qualidade das sessões do titular, para o relatório longitudinal (N5).

        Diferente de `historico_de_features` (uso interno do baseline): isto é um
        **acesso humano** aos dados derivados do titular — o titular vê os
        próprios, ou o médico com CareLink — então **audita como leitura** (como
        `listar`). Result sem `features` (anteriores ao Catálogo N2) são ignorados.

        `desde` recorta a janela; o corte vai para o banco e a auditoria registra
        o que foi **de fato** lido, não o histórico inteiro. A tendência passa a
        ser a da janela pedida — é isso que o seletor de período do painel quer.
        """
        results = list(reversed(self._repo.listar_do_paciente(titular.id, desde=desde)))  # ASC
        sessions: list[dict[str, Any]] = []
        quality_scores: list[float | None] = []
        times: list[Any] = []
        session_ids: list[uuid.UUID] = []
        duracao_total = 0.0
        tem_duracao = False
        for result in results:
            metrics = self._cipher.decrypt(result.metrics_encrypted)
            feats = metrics.get("features")
            if not isinstance(feats, dict) or not feats:
                continue
            sessions.append(feats)
            quality = metrics.get("quality") if isinstance(metrics.get("quality"), dict) else {}
            score = quality.get("score")
            quality_scores.append(float(score) if score is not None else None)
            times.append(result.created_at)
            session_ids.append(result.session_id)
            # Duração = amostras / taxa, o mesmo cálculo que o app fazia sobre a
            # lista inteira. Sobe para cá porque com a lista paginada o cliente
            # deixa de ter o período todo em mãos, e um total derivado de uma
            # página seria a tela afirmando o que não é verdade (ADR-0027).
            # Não é DSP: é aritmética de metadado da captação, não análise de
            # sinal — a ciência continua toda atrás do `AnalysisEngine`.
            n_amostras, fs = metrics.get("n_samples"), metrics.get("fs")
            if isinstance(n_amostras, int | float) and isinstance(fs, int | float) and fs:
                duracao_total += float(n_amostras) / float(fs)
                tem_duracao = True

        if sessions:
            self._repo.auditar(
                patient_user_id=titular.id,
                actor_user_id=ator.id,
                action=ResultAccessAction.READ,
                count=len(sessions),
            )

        period = None
        if times:
            period = {"first": times[0].isoformat(), "last": times[-1].isoformat()}
        return {
            "sessions": sessions,
            "quality_scores": quality_scores,
            "period": period,
            #: Ids das sessões que entraram — só para quem precisa contar
            #: metadado sobre elas (ex.: quantas têm autorrelato). Nunca sai
            #: para o cliente por aqui.
            "session_ids": session_ids,
            #: `None` e não `0` quando nenhuma sessão trouxe amostras/taxa:
            #: "não dá para saber" e "zero segundos" são coisas diferentes, e
            #: mostrar 0 s seria inventar (ADR-0027).
            "total_duration_seconds": duracao_total if tem_duracao else None,
        }

    # -- direito de acesso ----------------------------------------------

    def listar(
        self,
        *,
        titular: User,
        ator: User,
        desde: datetime | None = None,
        apenas_com_nota: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """Lê os Result do titular (decifrando) e audita quem leu.

        Devolve **a página e o total do recorte**. O total é `COUNT(*)` e não
        decifra nada — é o que permite a tela dizer "12 de 40" sem inflar a
        trilha nem pedir o histórico inteiro.

        `desde` recorta a janela. Minimização: quem pede "últimos 30 dias" não
        recebe (nem faz o servidor decifrar) três anos para o cliente esconder o
        resto — e a trilha de acesso conta o que a pessoa realmente viu.

        `limit`/`offset` paginam, e **cada página deixa seu próprio evento**,
        com `count` igual ao que saiu em claro naquela chamada (emenda à
        ADR-0037 de 2026-08-22). Nenhuma página escapa da trilha.
        """
        total = self._repo.contar_do_paciente(
            titular.id, desde=desde, apenas_com_nota=apenas_com_nota
        )
        results = self._repo.listar_do_paciente(
            titular.id,
            desde=desde,
            apenas_com_nota=apenas_com_nota,
            limit=limit,
            offset=offset,
        )
        if results:
            self._repo.auditar(
                patient_user_id=titular.id,
                actor_user_id=ator.id,
                action=ResultAccessAction.READ,
                count=len(results),
            )
        return [self._para_dict(r) for r in results], total

    # -- direito de exportação (portabilidade) --------------------------

    def exportar(self, *, titular: User) -> dict[str, Any]:
        """Empacota tudo do titular em formato aberto (JSON).

        **Sem recorte de período, de propósito:** portabilidade é o direito a
        *tudo* (Medical/72). Uma janela aqui devolveria uma cópia parcial com
        cara de completa — o oposto do que o direito garante.
        """
        results = self._repo.listar_do_paciente(titular.id)
        self._repo.auditar(
            patient_user_id=titular.id,
            actor_user_id=titular.id,
            action=ResultAccessAction.EXPORTED,
            count=len(results) or 1,
        )
        return {
            "user_id": str(titular.id),
            "email": titular.email,
            "consent_given_at": (
                titular.consent_given_at.isoformat() if titular.consent_given_at else None
            ),
            "consent_version": titular.consent_version,
            "results": [self._para_dict(r) for r in results],
        }

    # -- direito de exclusão (erasure) ----------------------------------

    def apagar_tudo(self, *, titular: User) -> int:
        """Apaga todos os Result do titular. Efeito completo e auditado."""
        quantidade = self._repo.apagar_do_paciente(titular.id)
        self._repo.auditar(
            patient_user_id=titular.id,
            actor_user_id=titular.id,
            action=ResultAccessAction.DELETED,
            count=quantidade,
        )
        return quantidade

    # -- interno ---------------------------------------------------------

    @staticmethod
    def _device_de(metrics: dict[str, Any]) -> str | None:
        """Aparelho de origem carimbado pela Analysis (ADR-0033), se houver."""
        device = metrics.get("device")
        return str(device) if device else None

    @staticmethod
    def _montage_de(metrics: dict[str, Any]) -> str | None:
        """Montagem (lista de posições) serializada em claro, ex.: "FP1".

        A Analysis devolve a montagem como lista (um rótulo por canal); aqui vira
        uma string separada por vírgula para caber na coluna de proveniência.
        """
        montage = metrics.get("montage")
        if isinstance(montage, (list, tuple)) and montage:
            return ",".join(str(canal) for canal in montage)
        return None

    def _para_dict(self, result: Result) -> dict[str, Any]:
        return {
            "id": str(result.id),
            "session_id": str(result.session_id),
            "engine_version": result.engine_version,
            "device": result.device,
            "montage": result.montage,
            "created_at": result.created_at.isoformat(),
            "metrics": self._cipher.decrypt(result.metrics_encrypted),
        }
