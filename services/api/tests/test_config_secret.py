"""O segredo do JWT é fail-closed (ADR-0023): sem ele, a app não sobe."""

import pytest
from app.config import JWT_SECRET_MIN_BYTES, Settings
from pydantic import ValidationError

VALIDO = "x" * JWT_SECRET_MIN_BYTES


def _settings(secret: str | None) -> Settings:
    if secret is None:
        return Settings(_env_file=None)
    return Settings(jwt_secret=secret, _env_file=None)


def test_segredo_ausente_impede_carregar(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("WAVEAI_API_JWT_SECRET", raising=False)
    with pytest.raises(ValidationError):
        _settings(None)


@pytest.mark.parametrize("secret", ["", "   ", "curto-demais", "x" * (JWT_SECRET_MIN_BYTES - 1)])
def test_segredo_vazio_ou_curto_e_rejeitado(secret: str):
    with pytest.raises(ValidationError):
        _settings(secret)


def test_segredo_valido_e_aceito():
    assert _settings(VALIDO).jwt_secret == VALIDO


def test_nao_existe_default_de_segredo():
    # Se algum dia alguém colocar um default "para facilitar o dev", este
    # teste falha: é exatamente assim que chaves vazam.
    assert Settings.model_fields["jwt_secret"].is_required()


def test_ttls_seguem_o_adr_0021():
    s = _settings(VALIDO)
    assert s.access_token_ttl_minutes == 15
    assert s.refresh_token_ttl_days == 7
    assert s.jwt_algorithm == "HS256"


def test_cookie_secure_desliga_em_dev_por_padrao(monkeypatch: pytest.MonkeyPatch):
    # Sem override, dev roda sobre http local: cookie Secure não persiste e
    # derrubava a sessão no reload. O default passa a desligar sozinho.
    monkeypatch.delenv("WAVEAI_API_REFRESH_COOKIE_SECURE", raising=False)
    s = Settings(jwt_secret=VALIDO, app_env="development", _env_file=None)
    assert s.refresh_cookie_secure is False


def test_cookie_secure_liga_fora_de_dev_por_padrao(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("WAVEAI_API_REFRESH_COOKIE_SECURE", raising=False)
    s = Settings(jwt_secret=VALIDO, app_env="production", _env_file=None)
    assert s.refresh_cookie_secure is True


def test_cookie_secure_override_explicito_sempre_vence(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("WAVEAI_API_REFRESH_COOKIE_SECURE", raising=False)
    s = Settings(
        jwt_secret=VALIDO,
        app_env="development",
        refresh_cookie_secure=True,
        _env_file=None,
    )
    assert s.refresh_cookie_secure is True
