"""Persistência de Result e da auditoria de acesso (ADR-0026)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models.annotation import SessionAnnotation
from ..models.result import Result, ResultAccessAction, ResultAccessEvent


class ResultRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def criar(
        self,
        *,
        session_id: uuid.UUID,
        patient_user_id: uuid.UUID,
        engine_version: str,
        metrics_encrypted: bytes,
        device: str | None = None,
        montage: str | None = None,
    ) -> Result:
        result = Result(
            session_id=session_id,
            patient_user_id=patient_user_id,
            engine_version=engine_version,
            metrics_encrypted=metrics_encrypted,
            device=device,
            montage=montage,
        )
        self._session.add(result)
        self._session.flush()
        return result

    def _condicoes(
        self,
        patient_user_id: uuid.UUID,
        *,
        desde: datetime | None,
        apenas_com_nota: bool,
    ) -> list:
        """Filtros compartilhados pela listagem e pela contagem.

        Compartilhar importa: se a contagem filtrasse diferente da lista, o
        `total` diria "40 sessões" numa lista que só consegue paginar 12 —
        a tela afirmando o que não é verdade (ADR-0027).
        """
        cond = [Result.patient_user_id == patient_user_id]
        if desde is not None:
            cond.append(Result.created_at >= desde)
        if apenas_com_nota:
            # Filtrar pela **existência** de nota não lê nota nenhuma: é o
            # mesmo metadado que a emenda à ADR-0037 de 2026-08-10 liberou.
            # Subconsulta e não join para não duplicar linha se um dia a
            # unicidade de `session_id` em `session_annotations` mudar.
            cond.append(
                Result.session_id.in_(
                    select(SessionAnnotation.session_id).where(
                        SessionAnnotation.patient_user_id == patient_user_id
                    )
                )
            )
        return cond

    def listar_do_paciente(
        self,
        patient_user_id: uuid.UUID,
        *,
        desde: datetime | None = None,
        apenas_com_nota: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[Result]:
        """Result do titular, do mais recente ao mais antigo.

        `desde` recorta a janela **no banco**: além de devolver menos, evita
        decifrar blob que ninguém vai ler. Borda inclusiva (`>=`).

        `limit`/`offset` paginam. **Ausentes = a janela inteira**, como antes
        desta fatia — o mesmo princípio do `?days=N`: o parâmetro novo só
        estreita, e a rota sem ele se comporta como sempre se comportou.
        """
        stmt = select(Result).where(
            *self._condicoes(
                patient_user_id, desde=desde, apenas_com_nota=apenas_com_nota
            )
        )
        # Desempate por `id`: o `now()` do Postgres é **por transação**, então
        # Result gravados na mesma transação compartilham `created_at` ao
        # microssegundo. Sem uma ordem total o banco pode devolver essas linhas
        # em ordens diferentes a cada consulta, e aí a página 2 repete o que a
        # 1 mostrou e pula o que ninguém viu. Com paginação isto deixa de ser
        # refinamento e vira correção (emenda à ADR-0037, 2026-08-22).
        stmt = stmt.order_by(Result.created_at.desc(), Result.id.desc())
        if offset:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)
        return list(self._session.scalars(stmt))

    def contar_do_paciente(
        self,
        patient_user_id: uuid.UUID,
        *,
        desde: datetime | None = None,
        apenas_com_nota: bool = False,
    ) -> int:
        """Quantos Result o titular tem no recorte — **sem decifrar nenhum**.

        Por isso não audita: é `COUNT(*)`, o mesmo raciocínio da emenda à
        ADR-0037 de 2026-08-14 (contagem é metadado, não conteúdo).
        """
        stmt = select(func.count()).select_from(Result).where(
            *self._condicoes(
                patient_user_id, desde=desde, apenas_com_nota=apenas_com_nota
            )
        )
        return int(self._session.scalar(stmt) or 0)

    def apagar_do_paciente(self, patient_user_id: uuid.UUID) -> int:
        """Exclusão (erasure): apaga TODOS os Result do titular. Devolve quantos."""
        resultado = self._session.execute(
            delete(Result).where(Result.patient_user_id == patient_user_id)
        )
        self._session.flush()
        return int(resultado.rowcount or 0)

    def auditar(
        self,
        *,
        patient_user_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        action: ResultAccessAction,
        count: int = 1,
    ) -> ResultAccessEvent:
        evento = ResultAccessEvent(
            patient_user_id=patient_user_id,
            actor_user_id=actor_user_id,
            action=action,
            count=count,
        )
        self._session.add(evento)
        self._session.flush()
        return evento
