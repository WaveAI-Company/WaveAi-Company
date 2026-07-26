"""Regras de Result: persistência com gate de consentimento e direitos do
titular (ADR-0026 / Medical/72).
"""

from __future__ import annotations

import uuid
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

    # -- direito de acesso ----------------------------------------------

    def listar(self, *, titular: User, ator: User) -> list[dict[str, Any]]:
        """Lê os Result do titular (decifrando) e audita quem leu."""
        results = self._repo.listar_do_paciente(titular.id)
        if results:
            self._repo.auditar(
                patient_user_id=titular.id,
                actor_user_id=ator.id,
                action=ResultAccessAction.READ,
                count=len(results),
            )
        return [self._para_dict(r) for r in results]

    # -- direito de exportação (portabilidade) --------------------------

    def exportar(self, *, titular: User) -> dict[str, Any]:
        """Empacota tudo do titular em formato aberto (JSON)."""
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
