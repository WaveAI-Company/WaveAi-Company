"""Persistência dos refresh tokens (rotação e revogação — ADR-0021)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..models.refresh_token import RefreshToken
from ..models.user import User
from ..security.tokens import hash_refresh_token


class RefreshTokenRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def issue(
        self,
        *,
        user: User,
        raw_token: str,
        ttl_days: int,
        family_id: uuid.UUID | None = None,
        now: datetime | None = None,
    ) -> RefreshToken:
        """Grava um novo refresh (novo login ou rotação dentro da família)."""
        now = now or datetime.now(UTC)
        token = RefreshToken(
            user_id=user.id,
            family_id=family_id or uuid.uuid4(),
            token_hash=hash_refresh_token(raw_token),
            token_version=user.token_version,
            expires_at=now + timedelta(days=ttl_days),
        )
        self._session.add(token)
        self._session.flush()
        return token

    def get_by_raw(self, raw_token: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(raw_token)
        )
        return self._session.scalars(stmt).one_or_none()

    def mark_used(self, token: RefreshToken, now: datetime | None = None) -> None:
        token.used_at = now or datetime.now(UTC)
        self._session.flush()

    def revoke_family(self, family_id: uuid.UUID, now: datetime | None = None) -> int:
        """Revoga todos os tokens vivos da família (reuso detectado ou logout).

        Devolve quantos foram revogados.
        """
        now = now or datetime.now(UTC)
        result = self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        self._session.flush()
        return int(result.rowcount or 0)

    def revoke_all_for_user(self, user: User, now: datetime | None = None) -> int:
        now = now or datetime.now(UTC)
        result = self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        self._session.flush()
        return int(result.rowcount or 0)
