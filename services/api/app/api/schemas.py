"""Schemas de entrada/saída da API de autenticação."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from ..models.care_link import CareLinkParty, CareLinkStatus
from ..models.user import UserRole

#: Comprimento mínimo de senha. Alinhado ao OWASP (mínimo 8); o custo real de
#: força bruta vem do Argon2id (ADR-0020).
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

#: Uma letra e um dígito **ASCII**, exatamente como a tela cobra em
#: `PasswordStrength.tsx` (`/[a-zA-Z]/` e `/[0-9]/`). Deliberadamente NÃO são
#: `str.isalpha()`/`str.isdigit()`: os dois aceitam unicode ("٣".isdigit() é
#: True) e o front não — usar o idioma do Python mudaria a divergência de
#: lugar em vez de fechá-la, que é justamente o motivo desta regra existir.
_TEM_LETRA = re.compile(r"[A-Za-z]")
_TEM_DIGITO = re.compile(r"[0-9]")


def _validar_forca_da_senha(valor: str) -> str:
    """Os mesmos três requisitos do medidor da tela (o comprimento vem do `Field`).

    A regra vale só na **escrita** (cadastro, troca e redefinição). O `login`
    segue aceitando qualquer comprimento: quem criou a conta antes desta regra
    tem uma senha que ela recusaria, e trancar essas pessoas do lado de fora
    seria trocar um desalinhamento por um incidente.
    """
    if not _TEM_LETRA.search(valor) or not _TEM_DIGITO.search(valor):
        raise ValueError("a senha precisa de pelo menos uma letra e um numero")
    return valor


#: Senha em campo de ESCRITA. `Field` cuida do comprimento; o validador, do
#: resto. Um tipo só para os três lugares não divergirem com o tempo.
SenhaNova = Annotated[
    str,
    Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH),
    AfterValidator(_validar_forca_da_senha),
]


class ClientPlatform(str, Enum):
    """Onde o refresh será guardado (ADR-0021).

    `web` → cookie httpOnly (o token não vai no corpo, para JS não alcançá-lo).
    `mobile` → corpo da resposta, para o app salvar em `expo-secure-store`.
    """

    WEB = "web"
    MOBILE = "mobile"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: SenhaNova
    role: UserRole
    display_name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    client: ClientPlatform = ClientPlatform.WEB


#: Dígitos do código de verificação, como o design mostra.
VERIFICATION_CODE_DIGITS = 6


class VerifyEmailRequest(BaseModel):
    """Confirmação de posse do endereço pelo código de 6 dígitos."""

    email: EmailStr
    code: str = Field(
        min_length=VERIFICATION_CODE_DIGITS, max_length=VERIFICATION_CODE_DIGITS
    )

    @field_validator("code")
    @classmethod
    def _so_digitos(cls, v: str) -> str:
        podado = v.strip()
        if not podado.isdigit():
            raise ValueError("o codigo tem apenas digitos")
        return podado


class ResendVerificationRequest(BaseModel):
    """Pedido de reenvio do código. Responde igual exista ou não a conta."""

    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """Pedido de recuperação. Responde igual exista ou não a conta (ADR-0024)."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Redefinição por **uma** das duas formas do segredo (ADR-0044 + emendas).

    `email` + `code` é o caminho de quem digita os 6 dígitos; `token` é o de
    quem abriu o link do e-mail — e o link não carrega o endereço, por isso ele
    vale sozinho.
    """

    email: EmailStr | None = None
    code: str | None = Field(
        default=None, min_length=VERIFICATION_CODE_DIGITS, max_length=VERIFICATION_CODE_DIGITS
    )
    token: str | None = Field(default=None, min_length=16, max_length=512)
    new_password: SenhaNova

    @field_validator("code")
    @classmethod
    def _so_digitos(cls, v: str | None) -> str | None:
        if v is None:
            return None
        podado = v.strip()
        if not podado.isdigit():
            raise ValueError("o codigo tem apenas digitos")
        return podado

    @model_validator(mode="after")
    def _uma_forma_so(self) -> ResetPasswordRequest:
        """Exige exatamente uma das duas formas.

        Aceitar as duas juntas obrigaria a decidir qual vence — e "qual dos dois
        segredos mandou" não é pergunta que deva existir.
        """
        por_codigo = self.email is not None and self.code is not None
        por_link = self.token is not None
        if por_codigo == por_link:
            raise ValueError("envie e-mail + codigo, ou o token do link")
        return self


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

    #: Conferência contra o hash guardado, não senha nascendo: fica fora da
    #: regra de força, senão quem tem senha legada não consegue nem trocá-la.
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: SenhaNova


class ChangeEmailRequest(BaseModel):
    """Pedido de troca do endereço da conta (3ª emenda à ADR-0044).

    Pede a senha atual pela mesma razão da troca de senha — e com mais motivo:
    o e-mail é o canal de recuperação, então quem o troca leva a conta junto.
    """

    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    #: Mesmo teto da coluna `users.email` — o `EmailStr` valida formato, não
    #: comprimento, e um endereço maior que a coluna estouraria no banco.
    new_email: EmailStr = Field(max_length=320)


class ConfirmEmailChangeRequest(BaseModel):
    """Confirmação da troca pelo código que chegou ao endereço **novo**."""

    code: str = Field(
        min_length=VERIFICATION_CODE_DIGITS, max_length=VERIFICATION_CODE_DIGITS
    )

    @field_validator("code")
    @classmethod
    def _so_digitos(cls, v: str) -> str:
        podado = v.strip()
        if not podado.isdigit():
            raise ValueError("o codigo tem apenas digitos")
        return podado


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


class LiveSharingRequest(BaseModel):
    """Chave do compartilhamento ao vivo de uma sessão (ADR-0045)."""

    enabled: bool


class PatientSummary(BaseModel):
    """Dados mínimos do paciente (ADR-0022: minimização)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str | None
