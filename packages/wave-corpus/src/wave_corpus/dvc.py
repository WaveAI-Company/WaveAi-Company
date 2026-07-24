"""Integração DVC do corpus — **remote sempre local e descartável** (ADR-0028/0030).

O corpus é alimentado por sintético e pela **autocaptação do dev**. Regra rígida:
a autocaptação **nunca sai da máquina**. Por isso o remote DVC é obrigatoriamente
um caminho **local**; qualquer remote de nuvem/rede é recusado (`LocalRemote`).

O binário `dvc` é **opcional** (extra `[dvc]`): `DvcLocalRepo` embrulha
`dvc init/add/push` para o operador versionar os bytes no remote local. Sem o
binário, o resto do corpus (store content-addressed + índice + proveniência)
funciona igual — a identidade imutável do dataset já vem do hash de conteúdo.
"""
from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

#: Esquemas de remote proibidos: nuvem/rede. Autocaptação não é empurrada (ADR-0028).
_REMOTE_NAO_LOCAL = (
    "s3://", "gs://", "azure://", "azure:", "ssh://", "http://", "https://",
    "hdfs://", "webhdfs://", "gdrive://", "oss://", "dvc://", "remote://",
)


@dataclass(frozen=True)
class LocalRemote:
    """Remote DVC do corpus: um diretório **local** e descartável.

    Recusa qualquer URL de nuvem/rede na construção (fail-closed). `file://` é
    aceito por ser local.
    """

    path: str

    def __post_init__(self) -> None:
        raw = str(self.path).strip()
        if not raw:
            raise ValueError("remote DVC vazio")
        low = raw.lower()
        if low.startswith("file://"):
            return
        if any(low.startswith(p) for p in _REMOTE_NAO_LOCAL) or "://" in raw:
            raise ValueError(
                f"remote DVC deve ser local/descartável; recusado: {raw!r} "
                "(autocaptação nunca é empurrada — ADR-0028)."
            )

    @property
    def is_local(self) -> bool:
        return True

    def as_path(self) -> Path:
        raw = str(self.path)
        if raw.lower().startswith("file://"):
            raw = raw[len("file://"):]
        return Path(raw)


def dvc_available() -> bool:
    """True se o binário `dvc` está no PATH (integração real disponível)."""
    return shutil.which("dvc") is not None


class DvcLocalRepo:
    """Wrapper fino do binário `dvc` num repo **standalone** (sem SCM), remote local.

    Usa `dvc init --no-scm` para um corpus descartável desacoplado do git do
    monorepo. Requer o extra `[dvc]`. Métodos são no-op seguros de reproduzir.
    """

    def __init__(self, root: str | Path, remote: LocalRemote) -> None:
        if not dvc_available():
            raise RuntimeError(
                "binário `dvc` não encontrado; instale o extra: pip install -e '.[dvc]'"
            )
        self.root = Path(root)
        self.remote = remote

    def _run(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["dvc", *args],
            cwd=str(self.root),
            check=True,
            capture_output=True,
            text=True,
        )

    def init(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        if not (self.root / ".dvc").exists():
            self._run("init", "--no-scm")
        self.remote.as_path().mkdir(parents=True, exist_ok=True)
        # -d default, -f força reconfigurar (idempotente).
        self._run("remote", "add", "-d", "-f", "local", str(self.remote.as_path()))

    def add(self, rel_path: str | Path) -> None:
        self._run("add", str(rel_path))

    def push(self) -> None:
        self._run("push")
