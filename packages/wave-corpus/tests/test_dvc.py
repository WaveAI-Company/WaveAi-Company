"""Remote DVC sempre local/descartável (ADR-0028/0030)."""
import numpy as np
import pytest

from wave_corpus import LocalRemote
from wave_corpus.dvc import DvcLocalRepo, dvc_available


@pytest.mark.parametrize(
    "remote_ruim",
    ["s3://bucket/x", "https://host/x", "gs://b", "ssh://h/p", "gdrive://x", "azure://c"],
)
def test_recusa_remote_nao_local(remote_ruim):
    with pytest.raises(ValueError):
        LocalRemote(remote_ruim)


def test_aceita_remote_local(tmp_path):
    assert LocalRemote(str(tmp_path / "dvc-remote")).is_local
    assert LocalRemote(f"file://{tmp_path}").is_local


@pytest.mark.skipif(not dvc_available(), reason="binário dvc ausente (extra [dvc])")
def test_integracao_dvc_local(tmp_path):
    remote = LocalRemote(str(tmp_path / "remote"))
    repo = DvcLocalRepo(root=tmp_path / "corpus", remote=remote)
    repo.init()
    (tmp_path / "corpus").mkdir(parents=True, exist_ok=True)
    np.save(tmp_path / "corpus" / "d.npy", np.arange(100, dtype=float))
    repo.add("d.npy")
    repo.push()
    # o remote local recebeu objetos versionados
    assert any((tmp_path / "remote").rglob("*"))
