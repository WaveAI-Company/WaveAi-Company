"""Ingestão idempotente + ResearchResult só com a tétrade (ADR-0030)."""
import numpy as np
import pytest

from wave_corpus import CorpusIndex, Frame, Provenance, ingest_frame


@pytest.fixture
def index(tmp_path):
    idx = CorpusIndex(
        database_url=f"sqlite:///{tmp_path / 'index.db'}",
        root=tmp_path / "store",
    )
    idx.create_all()
    return idx


def _frame(seed=0):
    rng = np.random.default_rng(seed)
    return Frame(channels=rng.normal(0, 1, (1, 1024)), fs=512.0, montage=("FP1",))


def test_ingestao_id_imutavel_e_idempotente(index):
    frame = _frame()
    s1, h1 = ingest_frame(index, frame, device="NeuroSky", condition="olhos_fechados")
    s2, h2 = ingest_frame(index, frame, device="NeuroSky", condition="olhos_fechados")

    assert h1 == h2  # id content-addressed é imutável
    assert s1 == s2  # idempotente por conteúdo: reusa a mesma sessão
    # dedup no store (1 parquet) e no índice (1 artefato)
    assert len(list(index.store.root.rglob("*.parquet"))) == 1
    assert len(index.artifacts_for(s1)) == 1


def test_add_result_persiste_com_tetrade_completa(index):
    sid, dataset_version = ingest_frame(index, _frame(1), device="NeuroSky")
    prov = Provenance(
        git_commit="c0ffee",
        dataset_version=dataset_version,
        engine_version="wave_eeg-0.1",
        hyperparameters={"lo": 1.0, "hi": 45.0},
    )
    index.add_result(sid, dataset_version, prov)

    results = index.results_for(sid)
    assert len(results) == 1
    assert results[0].dataset_version == dataset_version
    assert results[0].engine_version == "wave_eeg-0.1"
    assert results[0].git_commit == "c0ffee"
    assert results[0].computation_id == prov.computation_id()


def test_result_sem_tetrade_nao_persiste(index):
    sid, dataset_version = ingest_frame(index, _frame(2), device="NeuroSky")
    with pytest.raises(ValueError):
        # engine_version vazio -> Provenance falha na construção; add_result nem roda.
        index.add_result(
            sid,
            dataset_version,
            Provenance(
                git_commit="c",
                dataset_version=dataset_version,
                engine_version="",
                hyperparameters={},
            ),
        )
    assert index.results_for(sid) == []
