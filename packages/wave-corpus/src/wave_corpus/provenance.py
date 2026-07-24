"""Tétrade de proveniência (ADR-0030 / DataScience/31 §12).

Todo `Result` de pesquisa amarra **quatro** âncoras de reprodutibilidade:

1. **`git_commit`** — commit do código que produziu o resultado;
2. **`dataset_version`** — identificador **imutável** do dataset (id
   content-addressed do corpus / versão DVC);
3. **`engine_version`** — versão de comportamento do `AnalysisEngine`;
4. **`hyperparameters`** — parâmetros da computação.

Faltando qualquer uma, o resultado **não é reprodutível** — e, por regra rígida,
não deve ser persistido. A construção é **fail-closed**.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Mapping

#: Versão do esquema de identidade de computação (muda se a canonicalização mudar).
_COMPUTATION_SCHEMA = b"wave_corpus.computation.v1"

#: Campos textuais obrigatórios da tétrade (hyperparameters é validado à parte).
_REQUIRED_TEXT = ("git_commit", "dataset_version", "engine_version")


def _canonical_json(obj: Mapping[str, Any]) -> str:
    """JSON canônico (chaves ordenadas) para hashing estável de hiperparâmetros."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


@dataclass(frozen=True)
class Provenance:
    """As quatro âncoras de reprodutibilidade de um resultado de pesquisa."""

    git_commit: str
    dataset_version: str
    engine_version: str
    hyperparameters: Mapping[str, Any]

    def __post_init__(self) -> None:
        for name in _REQUIRED_TEXT:
            value = getattr(self, name)
            if value is None or not str(value).strip():
                raise ValueError(
                    f"proveniência incompleta: '{name}' é obrigatório (ADR-0030). "
                    "Sem a tétrade, o resultado não é reprodutível e não persiste."
                )
        if self.hyperparameters is None:
            raise ValueError(
                "proveniência incompleta: 'hyperparameters' é obrigatório "
                "(use um dict vazio explícito se a computação não tiver parâmetros)."
            )
        # normaliza para um dict próprio (não compartilha referência com o chamador).
        object.__setattr__(self, "hyperparameters", dict(self.hyperparameters))

    def computation_id(self) -> str:
        """Identidade **determinística** da computação: dataset × engine × params.

        **Não** inclui o `git_commit`: o `engine_version` é a versão de
        comportamento, então duas execuções com a mesma entrada, o mesmo engine e
        os mesmos hiperparâmetros têm a **mesma** identidade (resultado
        idempotente). O commit fica registrado para auditoria, não para identidade.
        """
        h = hashlib.sha256()
        h.update(_COMPUTATION_SCHEMA)
        h.update(self.dataset_version.encode("utf-8"))
        h.update(b"\x00")
        h.update(self.engine_version.encode("utf-8"))
        h.update(b"\x00")
        h.update(_canonical_json(self.hyperparameters).encode("utf-8"))
        return h.hexdigest()

    def to_dict(self) -> dict:
        return {
            "git_commit": self.git_commit,
            "dataset_version": self.dataset_version,
            "engine_version": self.engine_version,
            "hyperparameters": dict(self.hyperparameters),
        }
