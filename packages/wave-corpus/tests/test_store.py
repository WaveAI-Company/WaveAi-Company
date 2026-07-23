"""Store content-addressed: hash, dedup e round-trip — 100% sintético."""
import numpy as np

from wave_corpus import ContentAddressedStore, Frame


def _frame(n_channels=1, n_samples=1024, fs=512.0, seed=0, montage=("FP1",), kind="raw"):
    rng = np.random.default_rng(seed)
    return Frame(
        channels=rng.normal(0, 1, (n_channels, n_samples)),
        fs=fs,
        montage=montage,
        kind=kind,
    )


def test_write_retorna_hash_e_deduplica(tmp_path):
    store = ContentAddressedStore(tmp_path)
    frame = _frame()
    h1 = store.write(frame)
    h2 = store.write(frame)  # mesmo conteúdo -> mesmo hash, sem duplicar arquivo
    assert h1 == h2
    assert len(list(tmp_path.rglob("*.parquet"))) == 1


def test_hash_muda_com_o_conteudo(tmp_path):
    store = ContentAddressedStore(tmp_path)
    assert store.write(_frame(seed=1)) != store.write(_frame(seed=2))


def test_round_trip_preserva_amostras_e_fs(tmp_path):
    store = ContentAddressedStore(tmp_path)
    frame = _frame(n_channels=1, n_samples=2000, fs=512.0, seed=3)
    back = store.read(store.write(frame))
    assert np.array_equal(back.channels, frame.channels)
    assert back.fs == frame.fs
    assert back.montage == frame.montage
    assert back.kind == frame.kind
