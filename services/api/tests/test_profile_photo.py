"""Foto de perfil (ADR-0050): upload, re-codificação, visibilidade e exclusão.

100% sintético: as imagens são geradas em memória pelo Pillow, nenhuma foto real
de pessoa (CLAUDE.md/LGPD).
"""

from __future__ import annotations

import io
import uuid
from collections.abc import Iterator

import pytest
from app.api.deps import reset_login_limiter
from app.db.session import get_session
from app.main import app
from app.models.profile_photo import ProfilePhoto
from app.services.profile_photo import ImagemInvalida, processar_foto
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from .conftest import SENHA, registrar_conta


@pytest.fixture(autouse=True)
def _limiter_limpo() -> Iterator[None]:
    # O limiter (login/cadastro) é global ao processo e o IP do TestClient é
    # constante; sem reset, criar vários Ator estoura o 5/60s e o login falha.
    reset_login_limiter()
    yield


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


def _png(cor=(200, 100, 50), tamanho=(64, 64)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", tamanho, cor).save(buf, format="PNG")
    return buf.getvalue()


class Ator:
    def __init__(self, client: TestClient, role: str) -> None:
        self._client = client
        self.email = f"user-{uuid.uuid4().hex[:12]}@example.com"
        registrar_conta(client, email=self.email, senha=SENHA, role=role, display_name=f"{role}")
        login = client.post(
            "/auth/login", json={"email": self.email, "password": SENHA, "client": "mobile"}
        )
        self.token = login.json()["access_token"]
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def enviar_foto(self, dados: bytes, tipo: str = "image/png"):
        return self._client.put(
            "/me/photo", content=dados, headers={**self.headers, "Content-Type": tipo}
        )


def _vincular(medico: Ator, paciente: Ator, client: TestClient) -> None:
    client.post("/care-links", json={"email": paciente.email}, headers=medico.headers)
    vinculo = client.get("/care-links", headers=paciente.headers).json()[0]
    client.post(f"/care-links/{vinculo['id']}/accept", headers=paciente.headers)


# -- processamento (unitário) -----------------------------------------------


def test_processar_normaliza_para_jpeg_e_encolhe():
    grande = _png(tamanho=(2000, 1000))
    saida = processar_foto(grande)
    img = Image.open(io.BytesIO(saida))
    assert img.format == "JPEG"
    assert max(img.size) <= 512  # o lado maior coube no teto
    assert img.size == (512, 256)  # proporção preservada


def test_processar_remove_exif():
    # PNG com um bloco de texto (metadado). Após re-codificar, some.
    from PIL.PngImagePlugin import PngInfo

    info = PngInfo()
    info.add_text("GPSInfo", "-23.5,-46.6")
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (10, 20, 30)).save(buf, format="PNG", pnginfo=info)

    saida = processar_foto(buf.getvalue())
    img = Image.open(io.BytesIO(saida))
    assert not img.getexif(), "o EXIF/metadado não pode sobreviver à re-codificação"
    assert b"GPSInfo" not in saida


def test_processar_recusa_nao_imagem():
    with pytest.raises(ImagemInvalida):
        processar_foto(b"isto nao e uma imagem")


def test_processar_recusa_svg():
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    with pytest.raises(ImagemInvalida):
        processar_foto(svg)


# -- upload / leitura / remoção (rota) --------------------------------------


def test_sem_foto_da_404(client: TestClient):
    ator = Ator(client, "patient")
    assert ator._client.get("/me/photo", headers=ator.headers).status_code == 404


def test_upload_guarda_jpeg_normalizado_e_serve(client: TestClient):
    ator = Ator(client, "patient")
    assert ator.enviar_foto(_png()).status_code == 204

    resp = client.get("/me/photo", headers=ator.headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"  # normalizado, mesmo vindo PNG
    assert Image.open(io.BytesIO(resp.content)).format == "JPEG"


def test_upload_substitui_a_anterior(client: TestClient):
    ator = Ator(client, "patient")
    ator.enviar_foto(_png(cor=(255, 0, 0)))
    ator.enviar_foto(_png(cor=(0, 0, 255)))
    # Uma foto por conta: continua servindo, e sem erro de duplicidade.
    assert client.get("/me/photo", headers=ator.headers).status_code == 200


def test_upload_recusa_nao_imagem_com_422(client: TestClient):
    ator = Ator(client, "patient")
    assert ator.enviar_foto(b"nao sou imagem", tipo="image/png").status_code == 422


def test_remover_foto(client: TestClient):
    ator = Ator(client, "patient")
    ator.enviar_foto(_png())
    assert client.delete("/me/photo", headers=ator.headers).status_code == 204
    assert client.get("/me/photo", headers=ator.headers).status_code == 404


def test_remover_sem_foto_e_204(client: TestClient):
    ator = Ator(client, "patient")
    assert client.delete("/me/photo", headers=ator.headers).status_code == 204


# -- visibilidade (ADR-0050) ------------------------------------------------


def test_contraparte_de_vinculo_ativo_ve_a_foto_nos_dois_sentidos(client: TestClient):
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")
    medico.enviar_foto(_png(cor=(1, 2, 3)))
    paciente.enviar_foto(_png(cor=(4, 5, 6)))
    _vincular(medico, paciente, client)

    # médico vê a do paciente E paciente vê a do médico
    assert client.get(f"/users/{paciente.id}/photo", headers=medico.headers).status_code == 200
    assert client.get(f"/users/{medico.id}/photo", headers=paciente.headers).status_code == 200


def test_sem_vinculo_a_foto_do_outro_da_404(client: TestClient):
    """404 uniforme: não distingue 'sem vínculo' de 'sem foto' — sem oráculo."""
    a, b = Ator(client, "doctor"), Ator(client, "patient")
    b.enviar_foto(_png())
    assert client.get(f"/users/{b.id}/photo", headers=a.headers).status_code == 404


def test_vinculo_so_pendente_nao_ve(client: TestClient):
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")
    paciente.enviar_foto(_png())
    client.post("/care-links", json={"email": paciente.email}, headers=medico.headers)
    # convite pendente (paciente não aceitou) não concede visão
    assert client.get(f"/users/{paciente.id}/photo", headers=medico.headers).status_code == 404


# -- exclusão de conta apaga a foto (CASCADE, ADR-0047) ---------------------


def test_excluir_conta_apaga_a_foto(client: TestClient, db_session: Session):
    ator = Ator(client, "patient")
    ator.enviar_foto(_png())
    uid = uuid.UUID(ator.id)
    assert db_session.get(ProfilePhoto, uid) is not None

    resp = client.request(
        "DELETE", "/auth/me", json={"password": SENHA}, headers=ator.headers
    )
    assert resp.status_code == 204
    db_session.expire_all()
    assert db_session.get(ProfilePhoto, uid) is None, "a CASCADE devia ter apagado a foto"
