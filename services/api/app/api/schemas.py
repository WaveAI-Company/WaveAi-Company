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


class CareLinkRequest(BaseModel):
    """E-mail da contraparte (paciente, se quem pede é médico — e vice-versa)."""

    email: EmailStr


class CareLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: CareLinkStatus
    initiated_by: CareLinkParty
    #: Só a contraparte é exposta — nunca dados de terceiros.
    counterpart_user_id: uuid.UUID
    counterpart_display_name: str | None
    counterpart_role: UserRole
    created_at: datetime
    consented_at: datetime | None


class PatientSummary(BaseModel):
    """Dados mínimos do paciente (ADR-0022: minimização)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str | None
