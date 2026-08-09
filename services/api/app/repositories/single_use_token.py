"""Persistência dos tokens de uso único (ADR-0044)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..models.single_use_token import SingleUseToken, SingleUseTokenPurpose


class SingleUseTokenRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def criar(
        self,
        *,
        user_id: uuid.UUID,
        purpose: SingleUseTokenPurpose,
        token_hash: str,
        expires_at: datetime,
        code_hash: str | None = None,
    ) -> SingleUseToken:
        token = SingleUseToken(
            user_id=user_id,
            purpose=purpose,
            token_hash=token_hash,
            code_hash=code_hash,
            expires_at=expires_at,
        )
        self._session.add(token)
        self._session.flush()
        return token

    def get_por_hash(self, token_hash: str) -> SingleUseToken | None:
        """Busca pelo hash — nunca pelo valor em claro, que não é guardado."""
        stmt = select(SingleUseToken).where(SingleUseToken.token_hash == token_hash)
        return self._session.scalars(stmt).one_or_none()

    def ultimo_vivo(
        self, *, user_id: uuid.UUID, purpose: SingleUseTokenPurpose
    ) -> SingleUseToken | None:
        """Token ainda utilizável do par (usuário, propósito), se houver.

        "Vivo" = não usado e não substituído. Como a emissão supersede os
        anteriores, no máximo um sobrevive — o `order by` é cinto e suspensório.
        Expirado ainda conta como vivo aqui: quem decide sobre prazo é o
        serviço, para que "expirado" e "inexistente" caiam na mesma recusa.
        """
        stmt = (
            select(SingleUseToken)
            .where(
                SingleUseToken.user_id == user_id,
                SingleUseToken.purpose == purpose,
                SingleUseToken.used_at.is_(None),
                SingleUseToken.superseded_at.is_(None),
            )
            .order_by(SingleUseToken.created_at.desc())
            .limit(1)
        )
        return self._session.scalars(stmt).first()

    def superseder_vivos(
        self, *, user_id: uuid.UUID, purpose: SingleUseTokenPurpose, quando: datetime
    ) -> int:
        """Marca como substituídos os tokens ainda válidos do par (usuário, propósito).

        É isto que faz "reenviar" **não** deixar N tokens vivos por conta: só o
        último emitido continua valendo.
        """
        resultado = self._session.execute(
            update(SingleUseToken)
            .where(
                SingleUseToken.user_id == user_id,
                SingleUseToken.purpose == purpose,
                SingleUseToken.used_at.is_(None),
                SingleUseToken.superseded_at.is_(None),
            )
            .values(superseded_at=quando)
        )
        self._session.flush()
        return int(resultado.rowcount or 0)

    def apagar_expirados(self, *, user_id: uuid.UUID, agora: datetime) -> int:
        """Limpeza **oportunista** dos expirados daquele usuário.

        Roda na emissão em vez de virar um job: o volume por pessoa é pequeno e
        o momento em que ela pede um token novo é exatamente quando os antigos
        já não servem para nada.
        """
        resultado = self._session.execute(
            delete(SingleUseToken).where(
                SingleUseToken.user_id == user_id,
                SingleUseToken.expires_at < agora,
            )
        )
        self._session.flush()
        return int(resultado.rowcount or 0)
