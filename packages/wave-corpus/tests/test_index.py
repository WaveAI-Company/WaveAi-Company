"""Índice: metadados + ponteiros que resolvem, e modelo multicanal (ADR-0033)."""
import numpy as np
import pytest

from wave_corpus import CorpusIndex, Frame


@pytest.fixture
def index(tmp_path):
    # SQLite em arquivo (compartilha o schema entre conexões, ao contrário do
    # in-memory). Em deployment o índice é Postgres (ADR-0030).
    idx = CorpusIndex(
        database_url=f"sqlite:///{tmp_path / 'index.db'}",
        root=tmp_path / "store",
    )
    idx.create_all()
    return idx


def _frame(n_channels, montage, fs=512.0, n_samples=1024, seed=0, kind="raw"):
    rng = np.random.default_rng(seed)
    return Frame(
        channels=rng.normal(0, 1, (n_channels, n_samples)),
        fs=fs,
        montage=montage,
        kind=kind,
    )


def test_indice_grava_metadados_e_resolve_ponteiro(index):
    sid = index.add_session(
        device="NeuroSky MindWave Mobile 2",
        montage=["FP1"],
        fs=512.0,
        experimental_condition="olhos_fechados",
        poor_signal=12.0,
    )
    frame = _frame(1, ("FP1",))
    content_hash = index.add_frame(sid, frame)

    sess = index.get_session(sid)
    assert sess.device == "NeuroSky MindWave Mobile 2"
    assert sess.montage == ["FP1"]
    assert sess.experimental_condition == "olhos_fechados"
    assert sess.poor_signal == 12.0

    arts = index.artifacts_for(sid)
    assert len(arts) == 1
    assert arts[0].content_hash == content_hash
    assert arts[0].kind == "raw"
    assert arts[0].n_channels == 1
    assert arts[0].n_samples == 1024

    # o ponteiro resolve de volta para o sinal guardado no store
    back = index.read_frame(arts[0].content_hash)
    assert np.array_equal(back.channels, frame.channels)


def test_neurosky_n1_e_multicanal_forward_proof(index):
    # NeuroSky preenche N=1 no modelo canais × amostras (ADR-0033).
    sid1 = index.add_session(device="NeuroSky MindWave Mobile 2", montage=["FP1"], fs=512.0)
    index.add_frame(sid1, _frame(1, ("FP1",), seed=1))
    assert index.get_session(sid1).montage == ["FP1"]
    assert index.artifacts_for(sid1)[0].n_channels == 1

    # o MESMO modelo aceita N>1 sem mudar código (ex.: 4 canais, sem driver novo).
    montage4 = ("TP9", "AF7", "AF8", "TP10")
    sid4 = index.add_session(device="Generico 4ch", montage=list(montage4), fs=256.0)
    h4 = index.add_frame(sid4, _frame(4, montage4, fs=256.0, seed=2))
    assert index.artifacts_for(sid4)[0].n_channels == 4
    assert index.read_frame(h4).channels.shape == (4, 1024)
