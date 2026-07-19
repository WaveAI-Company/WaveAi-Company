"""Schemas de entrada/saída da API de autenticação."""

from __future__ import annotations

import uuid
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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
