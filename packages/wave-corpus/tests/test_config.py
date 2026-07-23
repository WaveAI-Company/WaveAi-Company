"""Separação física do banco de produção (ADR-0030), fail-closed."""
import pytest

from wave_corpus.config import PRODUCTION_DB_ENV, CorpusSettings


def test_recusa_o_mesmo_banco_da_producao(monkeypatch):
    monkeypatch.setenv(PRODUCTION_DB_ENV, "postgresql+psycopg://h/prod")
    with pytest.raises(ValueError):
        CorpusSettings(database_url="postgresql+psycopg://h/prod", root="_corpus")


def test_aceita_banco_separado(monkeypatch):
    monkeypatch.setenv(PRODUCTION_DB_ENV, "postgresql+psycopg://h/prod")
    s = CorpusSettings(database_url="postgresql+psycopg://h/research", root="_corpus")
    assert s.database_url.endswith("/research")


def test_sem_producao_no_ambiente_ok(monkeypatch):
    monkeypatch.delenv(PRODUCTION_DB_ENV, raising=False)
    # limpa também as envs do próprio corpus para não vazar do ambiente do CI.
    monkeypatch.delenv("WAVEAI_CORPUS_DATABASE_URL", raising=False)
    monkeypatch.delenv("WAVEAI_CORPUS_ROOT", raising=False)
    s = CorpusSettings()
    assert s.root == "_corpus"
    assert s.database_url.startswith("sqlite:///")
