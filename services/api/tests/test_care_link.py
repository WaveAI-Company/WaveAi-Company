"""Vínculo médico-paciente e RBAC consent-first (ADR-0024).

O que estes testes protegem: **ninguém vê os dados de um paciente sem um ato
de autorização desse paciente**. Convite pendente não basta; revogação corta na
hora; e o convite não pode revelar quem tem conta.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from app.api.deps import reset_login_limiter
from app.db.session import get_session
from app.emails import (
    ASSUNTO_ACESSO_AUTORIZADO,
    ASSUNTO_CONVITE,
    ASSUNTO_CONVITE_LEMBRETE,
)
from app.main import app
from app.models import CareLink, CareLinkEvent, CareLinkEventType, CareLinkStatus
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .conftest import SENHA, registrar_conta


@pytest.fixture(autouse=True)
def _limiter_limpo() -> Iterator[None]:
    reset_login_limiter()
    yield
    reset_login_limiter()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


def _email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


class Ator:
    """Um usuário logado, com atalho para chamadas autenticadas."""

    def __init__(self, client: TestClient, role: str) -> None:
        self._client = client
        self.email = _email()
        self.role = role
        # O cadastro não devolve mais o usuário criado (P9-e: resposta uniforme,
        # sem oráculo de existência), então o id vem do `/auth/me`.
        registrar_conta(
            client,
            email=self.email,
            senha=SENHA,
            role=role,
            display_name=f"{role} ficticio",
        )
        login = client.post(
            "/auth/login",
            json={"email": self.email, "password": SENHA, "client": "mobile"},
        )
        self.token = login.json()["access_token"]
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def get(self, url: str):
        return self._client.get(url, headers=self.headers)

    def post(self, url: str, json: dict | None = None):
        return self._client.post(url, json=json or {}, headers=self.headers)

    def convidar(self, outro: Ator, mensagem: str | None = None):
        corpo: dict = {"email": outro.email}
        if mensagem is not None:
            corpo["message"] = mensagem
        return self.post("/care-links", corpo)

    def ver_paciente(self, paciente: Ator):
        return self.get(f"/patients/{paciente.id}")

    def vinculos(self) -> list[dict]:
        return self.get("/care-links").json()

    def recusar(self, vinculo_id: str):
        return self.post(f"/care-links/{vinculo_id}/decline")


@pytest.fixture
def medico(client: TestClient) -> Ator:
    return Ator(client, "doctor")


@pytest.fixture
def paciente(client: TestClient) -> Ator:
    return Ator(client, "patient")


# -- a invariante central ------------------------------------------------


def test_convite_pendente_nao_da_acesso(medico: Ator, paciente: Ator):
    """O ato do médico, sozinho, não autoriza nada."""
    medico.convidar(paciente)

    assert medico.ver_paciente(paciente).status_code == 403


def test_acesso_so_depois_do_paciente_aceitar(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo = paciente.vinculos()[0]
    assert vinculo["status"] == "pending"

    aceite = paciente.post(f"/care-links/{vinculo['id']}/accept")
    assert aceite.status_code == 200
    assert aceite.json()["status"] == "active"

    resposta = medico.ver_paciente(paciente)
    assert resposta.status_code == 200
    assert resposta.json()["display_name"] == "patient ficticio"


def test_sem_vinculo_nenhum_o_acesso_e_negado(medico: Ator, paciente: Ator):
    assert medico.ver_paciente(paciente).status_code == 403


def test_medico_nao_acessa_paciente_de_outro_medico(client: TestClient, paciente: Ator):
    medico_a, medico_b = Ator(client, "doctor"), Ator(client, "doctor")
    medico_a.convidar(paciente)
    paciente.post(f"/care-links/{paciente.vinculos()[0]['id']}/accept")

    # A tem acesso; B, que não foi autorizado, não.
    assert medico_a.ver_paciente(paciente).status_code == 200
    assert medico_b.ver_paciente(paciente).status_code == 403


# -- revogação -----------------------------------------------------------


def test_paciente_revoga_e_o_acesso_cai_na_hora(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")
    assert medico.ver_paciente(paciente).status_code == 200

    paciente.post(f"/care-links/{vinculo_id}/revoke")

    assert medico.ver_paciente(paciente).status_code == 403


def test_medico_tambem_pode_revogar(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")

    revoke = medico.post(f"/care-links/{vinculo_id}/revoke")

    assert revoke.status_code == 200
    assert revoke.json()["status"] == "revoked"
    assert medico.ver_paciente(paciente).status_code == 403


def test_re_vinculo_exige_novo_consentimento(medico: Ator, paciente: Ator):
    """Revogado não "reativa": o novo convite volta a nascer pendente."""
    medico.convidar(paciente)
    primeiro = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{primeiro}/accept")
    paciente.post(f"/care-links/{primeiro}/revoke")

    medico.convidar(paciente)

    novo = paciente.vinculos()[0]
    assert novo["id"] != primeiro
    assert novo["status"] == "pending"
    assert medico.ver_paciente(paciente).status_code == 403


def test_vinculo_revogado_nao_aparece_mais_na_lista(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/revoke")

    assert paciente.vinculos() == []
    assert medico.vinculos() == []


# -- recusa (declined) ---------------------------------------------------


def test_paciente_recusa_convite_e_nao_concede_acesso(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo = paciente.vinculos()[0]

    recusa = paciente.recusar(vinculo["id"])

    assert recusa.status_code == 200
    assert recusa.json()["status"] == "declined"
    # Recusar é terminal: some da vista de ambos e não dá acesso.
    assert paciente.vinculos() == []
    assert medico.vinculos() == []
    assert medico.ver_paciente(paciente).status_code == 403


def test_medico_nao_pode_recusar(medico: Ator, paciente: Ator):
    """Recusar é ato do paciente (dono dos dados), como aceitar."""
    medico.convidar(paciente)
    vinculo_id = medico.vinculos()[0]["id"]

    assert medico.recusar(vinculo_id).status_code == 404


def test_nao_recusa_vinculo_ja_ativo(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")

    assert paciente.recusar(vinculo_id).status_code == 409


def test_recusar_nao_trava_novo_convite(medico: Ator, paciente: Ator):
    """Recusado não vira barreira: o médico pode convidar de novo (linha nova)."""
    medico.convidar(paciente)
    primeiro = paciente.vinculos()[0]["id"]
    paciente.recusar(primeiro)

    medico.convidar(paciente)

    novo = paciente.vinculos()[0]
    assert novo["id"] != primeiro
    assert novo["status"] == "pending"


def test_recusa_fica_auditada(medico: Ator, paciente: Ator, db_session: Session):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.recusar(vinculo_id)

    eventos = db_session.scalars(
        select(CareLinkEvent)
        .where(CareLinkEvent.care_link_id == uuid.UUID(vinculo_id))
        .order_by(CareLinkEvent.created_at)
    ).all()
    assert [e.event for e in eventos] == [
        CareLinkEventType.REQUESTED,
        CareLinkEventType.DECLINED,
    ]
    assert str(eventos[1].actor_user_id) == paciente.id

    link = db_session.get(CareLink, uuid.UUID(vinculo_id))
    assert link.status is CareLinkStatus.DECLINED
    assert link.declined_at is not None


# -- quem pode fazer o quê ----------------------------------------------


def test_medico_nao_pode_aceitar_o_proprio_convite(medico: Ator, paciente: Ator):
    """Se pudesse, o consentimento do paciente seria decorativo."""
    medico.convidar(paciente)
    vinculo_id = medico.vinculos()[0]["id"]

    resposta = medico.post(f"/care-links/{vinculo_id}/accept")

    assert resposta.status_code == 404
    assert medico.ver_paciente(paciente).status_code == 403


def test_aceitar_vinculo_ja_ativo_devolve_409(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    assert paciente.post(f"/care-links/{vinculo_id}/accept").status_code == 200

    assert paciente.post(f"/care-links/{vinculo_id}/accept").status_code == 409


def test_aceitar_vinculo_revogado_devolve_409(medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/revoke")

    assert paciente.post(f"/care-links/{vinculo_id}/accept").status_code == 409


def test_terceiro_nao_aceita_vinculo_alheio(client: TestClient, medico: Ator, paciente: Ator):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    intruso = Ator(client, "patient")

    assert intruso.post(f"/care-links/{vinculo_id}/accept").status_code == 404


def test_paciente_nao_usa_rota_de_medico(medico: Ator, paciente: Ator):
    # /patients/{id} exige papel de médico (403 antes mesmo do vínculo).
    assert paciente.get(f"/patients/{paciente.id}").status_code == 403


def test_rotas_de_vinculo_exigem_autenticacao(client: TestClient):
    assert client.get("/care-links").status_code == 401
    assert client.post("/care-links", json={"email": _email()}).status_code == 401


# -- paciente iniciando --------------------------------------------------


def test_paciente_iniciando_ja_nasce_ativo(medico: Ator, paciente: Ator):
    """O próprio ato do paciente É o consentimento (ADR-0024)."""
    paciente.convidar(medico)

    assert paciente.vinculos()[0]["status"] == "active"
    assert medico.ver_paciente(paciente).status_code == 200


def test_vinculo_exige_papeis_diferentes(client: TestClient, paciente: Ator):
    outro_paciente = Ator(client, "patient")

    paciente.convidar(outro_paciente)

    assert paciente.vinculos() == []


# -- anti-enumeração -----------------------------------------------------


def test_convite_nao_revela_se_a_conta_existe(medico: Ator, paciente: Ator):
    existente = medico.convidar(paciente)
    inexistente = medico.post("/care-links", {"email": _email()})

    assert existente.status_code == inexistente.status_code == 202
    assert existente.json() == inexistente.json()


def test_403_nao_distingue_paciente_inexistente_de_nao_autorizado(
    medico: Ator, paciente: Ator
):
    sem_autorizacao = medico.ver_paciente(paciente)
    inexistente = medico.get(f"/patients/{uuid.uuid4()}")

    assert sem_autorizacao.status_code == inexistente.status_code == 403
    assert sem_autorizacao.json() == inexistente.json()


# -- auditoria -----------------------------------------------------------


def test_consentimento_e_revogacao_ficam_auditados(
    medico: Ator, paciente: Ator, db_session: Session
):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")
    paciente.post(f"/care-links/{vinculo_id}/revoke")

    eventos = db_session.scalars(
        select(CareLinkEvent)
        .where(CareLinkEvent.care_link_id == uuid.UUID(vinculo_id))
        .order_by(CareLinkEvent.created_at)
    ).all()

    assert [e.event for e in eventos] == [
        CareLinkEventType.REQUESTED,
        CareLinkEventType.ACCEPTED,
        CareLinkEventType.REVOKED,
    ]
    # Quem praticou cada ato fica registrado.
    assert str(eventos[0].actor_user_id) == medico.id
    assert str(eventos[1].actor_user_id) == paciente.id
    assert str(eventos[2].actor_user_id) == paciente.id


def test_estado_do_vinculo_registra_datas_de_consentimento_e_revogacao(
    medico: Ator, paciente: Ator, db_session: Session
):
    medico.convidar(paciente)
    vinculo_id = paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo_id}/accept")
    paciente.post(f"/care-links/{vinculo_id}/revoke")

    link = db_session.get(CareLink, uuid.UUID(vinculo_id))
    assert link.status is CareLinkStatus.REVOKED
    assert link.consented_at is not None
    assert link.revoked_at is not None


def test_lista_mostra_apenas_a_contraparte(medico: Ator, paciente: Ator):
    medico.convidar(paciente)

    visao_medico = medico.vinculos()[0]
    visao_paciente = paciente.vinculos()[0]

    assert visao_medico["counterpart_user_id"] == paciente.id
    assert visao_medico["counterpart_role"] == "patient"
    assert visao_paciente["counterpart_user_id"] == medico.id
    assert visao_paciente["counterpart_role"] == "doctor"


# -- mensagem opcional do convite (ADR-0043) -----------------------------
#
# Recado que o solicitante escreve junto do convite. Texto livre de uma pessoa
# sobre outra: cifrado em repouso, limitado, imutável e só visível às partes.

#: Recado SINTÉTICO, no tom do mockup (convites.html) — pessoa fictícia.
RECADO = "Oi! Posso acompanhar suas tendências entre os nossos encontros?"


def test_convite_carrega_o_recado_para_a_contraparte(client: TestClient):
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")

    assert medico.convidar(paciente, RECADO).status_code == 202

    # Quem recebeu lê o recado no convite pendente...
    assert paciente.vinculos()[0]["message"] == RECADO
    # ...e quem escreveu vê o que mandou (lista de convites enviados).
    assert medico.vinculos()[0]["message"] == RECADO


def test_convite_sem_recado_responde_nulo(client: TestClient):
    """Ausência é `None`, nunca string vazia — a tela não desenha balão vazio."""
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")

    medico.convidar(paciente)

    assert paciente.vinculos()[0]["message"] is None


def test_recado_so_de_espaco_vira_ausencia(client: TestClient):
    """`max_length`/`min_length` contam espaço: "   " passaria pelo schema."""
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")

    assert medico.convidar(paciente, "   ").status_code == 202

    assert paciente.vinculos()[0]["message"] is None


def test_recado_e_podado_nas_bordas(client: TestClient):
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")

    medico.convidar(paciente, f"  {RECADO}\n")

    assert paciente.vinculos()[0]["message"] == RECADO


def test_recado_acima_do_teto_e_recusado(client: TestClient):
    """500 é decisão de produto (ADR-0043): campo grande vira prontuário."""
    from app.api.schemas import INVITE_MESSAGE_MAX_LENGTH

    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")

    no_limite = "a" * INVITE_MESSAGE_MAX_LENGTH
    assert medico.convidar(paciente, no_limite).status_code == 202

    outro = Ator(client, "patient")
    assert medico.convidar(outro, "a" * (INVITE_MESSAGE_MAX_LENGTH + 1)).status_code == 422


def test_recado_fica_cifrado_no_banco(client: TestClient, db_session: Session):
    """ADR-0043/0037: texto livre sobre uma pessoa não fica em claro no dump."""
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")
    medico.convidar(paciente, RECADO)

    bruto = db_session.execute(select(CareLink.invite_message_encrypted)).scalars().all()

    assert bruto and bruto[0] is not None
    assert b"tend" not in bruto[0]  # nenhum pedaco do texto em claro
    assert RECADO.encode("utf-8") not in bruto[0]


def test_paciente_tambem_pode_mandar_recado(client: TestClient):
    """Mesmo endpoint nos dois sentidos — o vínculo do paciente já nasce ativo."""
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")

    paciente.convidar(medico, "Quero que você acompanhe minhas tendências.")

    vinculo = medico.vinculos()[0]
    assert vinculo["status"] == "active"
    assert vinculo["message"] == "Quero que você acompanhe minhas tendências."


def test_reconvite_nao_reescreve_o_recado(client: TestClient):
    """Imutável (ADR-0043): quem está decidindo não tem o texto trocado por baixo."""
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")
    medico.convidar(paciente, RECADO)

    assert medico.convidar(paciente, "Texto novo, depois de ela já ter lido.").status_code == 202

    assert paciente.vinculos()[0]["message"] == RECADO


def test_recado_some_com_o_convite_recusado(client: TestClient):
    """Vínculo terminal sai de todas as listagens — o recado vai junto."""
    medico, paciente = Ator(client, "doctor"), Ator(client, "patient")
    medico.convidar(paciente, RECADO)

    paciente.recusar(paciente.vinculos()[0]["id"])

    assert paciente.vinculos() == []
    assert medico.vinculos() == []


def test_recado_para_email_sem_conta_nao_e_gravado(client: TestClient, db_session: Session):
    """Anti-enumeração (ADR-0024): sem conta, nada é gravado — nem o recado."""
    medico = Ator(client, "doctor")

    resp = medico.post("/care-links", {"email": _email(), "message": RECADO})

    # Resposta uniforme, como se a conta existisse...
    assert resp.status_code == 202
    # ...e nenhuma linha (logo, nenhum recado) ficou para trás.
    assert db_session.execute(select(CareLink)).scalars().all() == []


# -- o convite avisa a contraparte por e-mail ----------------------------


def _envelhecer_eventos(db_session: Session, care_link_id: str, segundos: int) -> None:
    """Recua os eventos do vínculo, para o cooldown do lembrete já ter passado.

    Mexer no relógio do banco é mais honesto que baixar o cooldown na config:
    o teste passa a exercer **o valor que shipa**, não um valor de teste.
    """
    from datetime import UTC, datetime, timedelta

    quando = datetime.now(UTC) - timedelta(seconds=segundos)
    for evento in db_session.scalars(
        select(CareLinkEvent).where(CareLinkEvent.care_link_id == uuid.UUID(care_link_id))
    ):
        evento.created_at = quando
    db_session.flush()


def _com_assunto(emails, endereco: str, assunto: str) -> list[dict]:
    """As mensagens daquele assunto. Filtrar importa: toda conta desta suíte
    nasce com o e-mail de verificação do cadastro na caixa."""
    return [e for e in emails.para(endereco) if e["subject"] == assunto]


def test_convite_do_medico_avisa_o_paciente(medico: Ator, paciente: Ator, emails):
    """Antes desta fatia ninguém era avisado: o convite só existia dentro do app."""
    medico.convidar(paciente, mensagem="Oi! Vamos acompanhar juntas?")

    recebidos = _com_assunto(emails, paciente.email, ASSUNTO_CONVITE)
    assert len(recebidos) == 1
    corpo = recebidos[0]["body"]
    # O recado (ADR-0043) NÃO viaja: numa caixa de entrada ele vira phishing, e
    # o cliente de e-mail transformaria uma URL nele em link.
    assert "Vamos acompanhar juntas" not in corpo
    # Nem o nome de quem convidou, que também é texto escolhido por alguém.
    assert "ficticio" not in corpo


def test_vinculo_iniciado_pelo_paciente_avisa_o_medico(medico: Ator, paciente: Ator, emails):
    """Aqui não há convite a aceitar — o vínculo já nasce ativo (ADR-0024)."""
    paciente.convidar(medico)

    assert len(_com_assunto(emails, medico.email, ASSUNTO_ACESSO_AUTORIZADO)) == 1


def test_endereco_sem_conta_nao_recebe_nada(medico: Ator, emails):
    """Não existe convite frio: o WaveAI não dispara e-mail para estranhos."""
    ninguem = _email()

    resposta = medico.post("/care-links", {"email": ninguem})

    assert resposta.status_code == 202  # resposta uniforme, como sempre
    assert emails.para(ninguem) == []


def test_reconvite_nao_manda_email_de_novo(medico: Ator, paciente: Ator, emails):
    """Senão "convidar de novo" seria um jeito de furar o cooldown do lembrete."""
    medico.convidar(paciente)
    medico.convidar(paciente)

    assert len(_com_assunto(emails, paciente.email, ASSUNTO_CONVITE)) == 1


# -- reenviar o convite --------------------------------------------------


def test_reenvio_manda_lembrete_e_fica_na_trilha(
    medico: Ator, paciente: Ator, emails, db_session: Session
):
    vinculo = medico.convidar(paciente) and medico.vinculos()[0]["id"]
    _envelhecer_eventos(db_session, vinculo, 7200)

    resposta = medico.post(f"/care-links/{vinculo}/resend")

    assert resposta.status_code == 200
    assert len(_com_assunto(emails, paciente.email, ASSUNTO_CONVITE_LEMBRETE)) == 1
    eventos = [
        e.event
        for e in db_session.scalars(
            select(CareLinkEvent).where(CareLinkEvent.care_link_id == uuid.UUID(vinculo))
        )
    ]
    # Cutucar de novo não é convidar: a trilha distingue os dois.
    assert CareLinkEventType.RESENT in eventos


def test_reenvio_seguido_e_recusado(medico: Ator, paciente: Ator, emails, db_session: Session):
    """O e-mail cai na caixa de OUTRA pessoa, que não pediu nada."""
    vinculo = medico.convidar(paciente) and medico.vinculos()[0]["id"]

    resposta = medico.post(f"/care-links/{vinculo}/resend")

    assert resposta.status_code == 429
    # Nenhum lembrete saiu — só o e-mail do convite, que já estava lá.
    assert _com_assunto(emails, paciente.email, ASSUNTO_CONVITE_LEMBRETE) == []
    assert len(_com_assunto(emails, paciente.email, ASSUNTO_CONVITE)) == 1


def test_so_quem_convidou_reenvia(medico: Ator, paciente: Ator, db_session: Session):
    vinculo = medico.convidar(paciente) and medico.vinculos()[0]["id"]
    _envelhecer_eventos(db_session, vinculo, 7200)

    # Quem RECEBEU o convite não lembra a si mesmo — e nem descobre que existe
    # a rota: 404, o mesmo do "não é seu".
    assert paciente.post(f"/care-links/{vinculo}/resend").status_code == 404


def test_nao_reenvia_convite_ja_aceito(medico: Ator, paciente: Ator, db_session: Session):
    vinculo = medico.convidar(paciente) and paciente.vinculos()[0]["id"]
    paciente.post(f"/care-links/{vinculo}/accept")
    _envelhecer_eventos(db_session, vinculo, 7200)

    assert medico.post(f"/care-links/{vinculo}/resend").status_code == 409


# -- e-mail da contraparte só enquanto pende -----------------------------


def test_email_da_contraparte_aparece_enquanto_pende_e_some_depois(
    medico: Ator, paciente: Ator
):
    """Decidir e lembrar precisam do endereço; acompanhar, não."""
    medico.convidar(paciente)

    pendente = paciente.vinculos()[0]
    assert pendente["counterpart_email"] == medico.email
    assert medico.vinculos()[0]["counterpart_email"] == paciente.email

    paciente.post(f"/care-links/{pendente['id']}/accept")

    assert paciente.vinculos()[0]["counterpart_email"] is None
    assert medico.vinculos()[0]["counterpart_email"] is None


# -- contagens no cartão do profissional (emenda à ADR-0037, 2026-08-14) ---


def _semear_sessao_com_nota(
    db_session: Session, email: str, *, com_nota: bool
) -> None:
    """Uma sessão com `Result` para o paciente de `email`; opcionalmente com nota."""
    from app.config import get_settings
    from app.security.crypto import get_metrics_cipher
    from app.models import CaptureSession, SessionAnnotation, SessionStatus
    from app.repositories.user import UserRepository
    from app.security.password import Argon2PasswordHasher
    from app.services.results import ResultService

    settings = get_settings()
    cipher = get_metrics_cipher(settings)
    hasher = Argon2PasswordHasher(memory_cost=8, time_cost=1, parallelism=1)
    user = UserRepository(db_session, hasher).get_by_email(email)

    sessao = CaptureSession(
        patient_user_id=user.id,
        device="simulador",
        sample_rate=512,
        status=SessionStatus.COMPLETED,
    )
    db_session.add(sessao)
    db_session.flush()

    ResultService(session=db_session, settings=settings, cipher=cipher).persistir(
        patient=user,
        session_id=sessao.id,
        metrics={"engine_version": "teste", "rel_alpha": 0.3},
    )
    if com_nota:
        db_session.add(
            SessionAnnotation(
                session_id=sessao.id,
                patient_user_id=user.id,
                note_encrypted=cipher.encrypt({"text": "nota sintética"}),
            )
        )
    db_session.commit()


def test_contagens_so_no_vinculo_ativo_e_so_para_o_medico(
    medico: Ator, paciente: Ator, db_session: Session
):
    """Contagem é metadado do vínculo ativo — não do convite, não para o titular."""
    medico.convidar(paciente)

    pendente = medico.vinculos()[0]
    assert pendente["session_count"] is None
    assert pendente["annotation_count"] is None

    paciente.post(f"/care-links/{pendente['id']}/accept")

    # Guardar resultado exige consentimento (ADR-0026) — o gate roda antes.
    paciente.post("/me/consent")
    _semear_sessao_com_nota(db_session, paciente.email, com_nota=True)
    _semear_sessao_com_nota(db_session, paciente.email, com_nota=False)

    ativo = medico.vinculos()[0]
    assert ativo["session_count"] == 2
    assert ativo["annotation_count"] == 1

    # O paciente vê o vínculo com o médico, e não números sobre si mesmo.
    do_paciente = paciente.vinculos()[0]
    assert do_paciente["session_count"] is None
    assert do_paciente["annotation_count"] is None


def test_contagem_nao_deixa_trilha_de_acesso(
    medico: Ator, paciente: Ator, db_session: Session
):
    """O ponto central da emenda: `COUNT(*)` não é leitura, e não audita."""
    from app.models.result import ResultAccessEvent

    medico.convidar(paciente)
    vinculo = medico.vinculos()[0]
    paciente.post(f"/care-links/{vinculo['id']}/accept")
    paciente.post("/me/consent")
    _semear_sessao_com_nota(db_session, paciente.email, com_nota=True)

    antes = db_session.scalar(
        select(func.count(ResultAccessEvent.id)).where(
            ResultAccessEvent.actor_user_id == uuid.UUID(medico.id)
        )
    )

    for _ in range(3):
        assert medico.vinculos()[0]["session_count"] == 1

    depois = db_session.scalar(
        select(func.count(ResultAccessEvent.id)).where(
            ResultAccessEvent.actor_user_id == uuid.UUID(medico.id)
        )
    )
    assert depois == antes
