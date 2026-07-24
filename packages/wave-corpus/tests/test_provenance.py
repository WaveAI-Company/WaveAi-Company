"""Tétrade de proveniência e identidade determinística (ADR-0030)."""
import pytest

from wave_corpus import Provenance


def test_tetrade_incompleta_falha():
    incompletas = [
        dict(git_commit="", dataset_version="d", engine_version="e", hyperparameters={}),
        dict(git_commit="c", dataset_version="", engine_version="e", hyperparameters={}),
        dict(git_commit="c", dataset_version="d", engine_version="", hyperparameters={}),
        dict(git_commit="c", dataset_version="d", engine_version="e", hyperparameters=None),
    ]
    for kwargs in incompletas:
        with pytest.raises(ValueError):
            Provenance(**kwargs)


def test_hyperparams_vazio_explicito_ok():
    # {} é um valor presente (computação sem parâmetros) — diferente de None.
    Provenance(git_commit="c", dataset_version="d", engine_version="e", hyperparameters={})


def test_computation_id_ignora_commit_e_ordem():
    a = Provenance("c1", "ds", "eng-1", {"lo": 1.0, "hi": 45.0})
    b = Provenance("c2", "ds", "eng-1", {"hi": 45.0, "lo": 1.0})  # commit e ordem diferentes
    assert a.computation_id() == b.computation_id()


def test_computation_id_muda_com_entrada_engine_ou_params():
    base = Provenance("c", "ds", "eng-1", {"lo": 1.0})
    assert base.computation_id() != Provenance("c", "ds", "eng-2", {"lo": 1.0}).computation_id()
    assert base.computation_id() != Provenance("c", "ds", "eng-1", {"lo": 2.0}).computation_id()
    assert base.computation_id() != Provenance("c", "ds2", "eng-1", {"lo": 1.0}).computation_id()
