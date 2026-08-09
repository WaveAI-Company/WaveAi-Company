"""Schemas de entrada/saída da API de autenticação."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..models.care_link import CareLinkParty, CareLinkStatus
from ..models.user import UserRole

#: Comprimento mínimo de senha. Alinhado ao OWASP (mínimo 8); o custo real de
#: força bruta vem do Argon2id (ADR-0020).
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


class ClientPlatform(str, Enum):
    """Onde o refresh será guardado (ADR-0021).

    `web` → cookie httpOnly (o token não vai no corpo, para JS não alcançá-lo).
    `mobile` → corpo da resposta, para o app salvar em `expo-secure-store`.
    """

    WEB = "web"
    MOBILE = "mobile"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    role: UserRole
    display_name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    client: ClientPlatform = ClientPlatform.WEB


class RefreshRequest(BaseModel):
    #: Só o mobile envia no corpo; no web o token vem pelo cookie.
    refresh_token: str | None = None
    client: ClientPlatform = ClientPlatform.WEB


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    #: Presente apenas para `client=mobile`.
    refresh_token: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: UserRole
    display_name: str | None = None
    #: Quando a conta foi criada — o "membro desde" do painel de conta. Já
    #: existia no modelo; faltava sair pela API.
    created_at: datetime


class UpdateMeRequest(BaseModel):
    """Edição do próprio cadastro.

    Só `display_name`: o e-mail é a identidade de login e trocá-lo é outro
    fluxo (precisa reverificar o endereço novo antes de valer). O papel não se
    edita — mudar de paciente para profissional mudaria o que a pessoa pode
    ver, e isso não é um campo de formulário.
    """

    display_name: str = Field(min_length=1, max_length=120)

    @field_validator("display_name")
    @classmethod
    def _sem_espaco_a_toa(cls, v: str) -> str:
        """Poda as bordas e recusa nome só de espaço.

        `min_length` conta os espaços, então `"   "` passava pelo schema e
        chegava vazio ao banco. Normalizar aqui — e não na rota — mantém a
        regra junto do contrato, onde ela é testável sem HTTP.
        """
        podado = v.strip()
        if not podado:
            raise ValueError("nome nao pode ser vazio")
        return podado


class ChangePasswordRequest(BaseModel):
    """Troca de senha do próprio titular.

    Pede a senha atual mesmo com a sessão válida: um token roubado não deve
    bastar para tomar a conta em definitivo.
    """

    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)


class ConsentRequest(BaseModel):
    """Aceite do termo. `version` é a versão que o app exibiu ao titular.

    Opcional por compatibilidade, mas quando presente a API valida contra a
    versão vigente: consentir a um termo desatualizado é recusado.
    """

    version: str | None = Field(default=None, max_length=32)


#: Teto de tamanho da nota de contexto (ADR-0037). Contexto curto, não prontuário.
ANNOTATION_MAX_LENGTH = 2000


class AnnotationRequest(BaseModel):
    """Nota de contexto de uma sessão (autorrelato do titular, ADR-0037)."""

    note: str = Field(min_length=1, max_length=ANNOTATION_MAX_LENGTH)


#: Teto do recado do convite (ADR-0043). É decisão de PRODUTO, não de coluna:
#: campo grande convida a virar prontuário, e o enquadramento é não-clínico
#: (Medical/71). 500 cabe as três/quatro frases do design e não cabe um
#: histórico.
INVITE_MESSAGE_MAX_LENGTH = 500


class CareLinkRequest(BaseModel):
    """E-mail da contraparte (paciente, se quem pede é médico — e vice-versa).

    `message` é o recado opcional que a contraparte lê junto do convite
    (ADR-0043) — dar contexto à decisão é o que reduz aceite no escuro.
    """

    email: EmailStr
    message: str | None = Field(default=None, max_length=INVITE_MESSAGE_MAX_LENGTH)

    @field_validator("message")
    @classmethod
    def _recado_vazio_e_ausencia(cls, v: str | None) -> str | None:
        """Poda as bordas; recado só de espaço vira **ausência**, não string vazia.

        Mesmo motivo do `display_name`: `max_length` e `min_length` contam
        espaço, então `"   "` chegaria ao banco como uma mensagem que a tela
        exibiria entre aspas — um balão vazio ao lado do nome de quem convidou.
        """
        if v is None:
            return None
        return v.strip() or None


class CareLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: CareLinkStatus
    initiated_by: CareLinkParty
    #: Só a contraparte é exposta — nunca dados de terceiros.
    counterpart_user_id: uuid.UUID
    counterpart_display_name: str | None
    counterpart_role: UserRole
    #: Recado de quem convidou (ADR-0043), decifrado. `None` quando não houve.
    #: A tela exibe como **citação atribuída** — aspas e nome de quem escreveu —
    #: nunca como texto do sistema, e sem autolink: convite com texto de
    #: terceiro é vetor clássico de phishing.
    message: str | None = None
    created_at: datetime
    consented_at: datetime | None


class PatientSummary(BaseModel):
    """Dados mínimos do paciente (ADR-0022: minimização)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str | None
