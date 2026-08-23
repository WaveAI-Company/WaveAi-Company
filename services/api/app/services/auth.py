"""Regras de autenticação: registro, login, rotação de refresh e logout.

Concentra as decisões dos ADR-0020/0021/0023 fora da camada HTTP, para poderem
ser testadas sem passar por rotas.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from ..config import Settings
from ..models.annotation import AnnotationAccessEvent
from ..models.live_view import LiveViewAccessEvent
from ..models.refresh_token import RefreshToken
from ..models.result import ResultAccessEvent
from ..models.user import User, UserRole
from ..repositories.refresh_token import RefreshTokenRepository
from ..repositories.user import UserRepository
from ..security.password import PasswordHasher
from ..security.tokens import create_access_token, generate_refresh_token

#: Hash descartável usado para gastar o mesmo tempo de CPU quando o e-mail não
#: existe. Sem isso, "usuário inexistente" responderia mais rápido que "senha
#: errada" e permitiria enumerar contas pelo tempo de resposta (ADR-0023).
_DUMMY_PASSWORD = "senha-inexistente-para-tempo-uniforme"


class AuthError(Exception):
    """Falha de autenticação. Mensagem sempre genérica para o cliente."""


class EmailAlreadyRegisteredError(Exception):
    """E-mail já cadastrado.

    Continua existindo para quem chama o serviço direto (seed, scripts). A
    **rota** de cadastro não a usa mais: responder 409 seria contar a quem
    perguntou que o endereço tem dono (ver `ResultadoCadastro`).
    """


class EmailNotVerifiedError(Exception):
    """Senha correta, mas o endereço nunca foi confirmado.

    **Não** herda de `AuthError` de propósito: quem trata a falha genérica de
    login não pode capturar isto por engano. E só é levantada **depois** de a
    senha conferir — antes disso, contar que a conta existe seria oráculo de
    enumeração (ADR-0024).
    """

    def __init__(self, user: User) -> None:
        super().__init__("e-mail nao verificado")
        #: Quem chama precisa do usuário para reemitir o código de verificação.
        self.user = user


@dataclass(frozen=True)
class ResultadoCadastro:
    """O que aconteceu no cadastro — para a rota **não** precisar contar.

    A rota responde igual nos dois casos; é o e-mail que informa a pessoa certa
    (a dona do endereço), em vez de a API informar quem perguntou.
    """

    #: Conta criada. `None` quando o endereço já tinha dono.
    user: User | None
    #: Verdadeiro quando havia conta e nada foi criado.
    ja_existia: bool


class RefreshReuseError(AuthError):
    """Refresh já utilizado reapareceu: a família foi revogada."""


class WrongPasswordError(AuthError):
    """A senha atual não confere na troca de senha."""


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    def __init__(
        self,
        *,
        session: Session,
        settings: Settings,
        hasher: PasswordHasher,
    ) -> None:
        self._session = session
        self._settings = settings
        self._hasher = hasher
        self._users = UserRepository(session, hasher)
        self._refresh = RefreshTokenRepository(session)
        self._dummy_hash = hasher.hash(_DUMMY_PASSWORD)

    # -- registro --------------------------------------------------------

    def register(
        self, *, email: str, password: str, role: UserRole, display_name: str
    ) -> User:
        """Cadastro direto, que **levanta** se o e-mail já existe.

        Usado por scripts e pelo seed, onde saber do conflito é o certo. A rota
        pública usa `cadastrar`, que não distingue.
        """
        if self._users.get_by_email(email) is not None:
            raise EmailAlreadyRegisteredError
        return self._users.create(
            email=email, password=password, role=role, display_name=display_name
        )

    def cadastrar(
        self,
        *,
        email: str,
        password: str,
        role: UserRole,
        display_name: str,
        accepted_terms_version: str | None = None,
    ) -> ResultadoCadastro:
        """Cadastro da rota pública: nunca revela se o endereço já tem dono.

        Antes de desistir, tenta **reciclar** uma conta não verificada e vencida
        (o endereço volta a ficar livre). A verificação sozinha não devolve
        e-mail nenhum nem impede o banco de acumular cadastros mortos — é esta
        reciclagem que faz isso, e ela acontece no único momento em que importa:
        quando alguém quer aquele endereço.
        """
        existente = self._users.get_by_email(email)
        if existente is not None:
            if not self._pode_reciclar(existente):
                # Gasta o mesmo tempo de CPU do caminho que cria a conta. Sem
                # isto, a resposta uniforme seria desmentida pelo relógio: o
                # caminho "já existe" voltaria sem pagar o Argon2 (ADR-0023).
                self._hasher.verify(self._dummy_hash, password)
                return ResultadoCadastro(user=None, ja_existia=True)
            self._users.delete(existente)
            self._session.flush()

        user = self._users.create(
            email=email, password=password, role=role, display_name=display_name
        )
        if accepted_terms_version is not None:
            # `datetime.now` e não `func.now()`: o `now()` do Postgres é por
            # transação, e o cadastro faz mais de uma escrita — o carimbo tem
            # de ser o do ato, não o do início da transação.
            user.accepted_terms_version = accepted_terms_version
            user.accepted_terms_at = datetime.now(UTC)
        self._session.flush()
        return ResultadoCadastro(user=user, ja_existia=False)

    def _pode_reciclar(self, user: User) -> bool:
        """Uma conta não verificada e vencida pode ceder o endereço?

        **Só com o gate ligado.** Com ele desligado, uma conta não verificada
        entra e usa o produto normalmente — reciclá-la apagaria dados de alguém
        que estava usando a plataforma. A reciclagem só é segura quando "não
        verificada" implica "inutilizável".
        """
        if not self._settings.email_verification_required:
            return False
        if user.email_verified_at is not None:
            return False
        vencimento = user.created_at + timedelta(
            days=self._settings.unverified_account_ttl_days
        )
        return datetime.now(UTC) >= vencimento

    def buscar_por_email(self, email: str) -> User | None:
        """Busca tolerante para os fluxos de e-mail: formato inválido vira `None`.

        Quem chama trata "não achei" e "e-mail malformado" do mesmo jeito — as
        rotas de verificação e reenvio respondem igual nos dois casos.
        """
        try:
            return self._users.get_by_email(email)
        except ValueError:
            return None

    def marcar_verificado(self, user: User) -> None:
        """Registra a posse do endereço. Idempotente: reverificar não muda a data."""
        if user.email_verified_at is None:
            user.email_verified_at = datetime.now(UTC)
            self._session.flush()

    # -- login -----------------------------------------------------------

    def login(self, *, email: str, password: str) -> TokenPair:
        """Autentica e emite o par de tokens.

        Erros são sempre genéricos e o custo de CPU é o mesmo para e-mail
        inexistente, senha errada e conta inativa (anti-enumeração).
        """
        try:
            user = self._users.get_by_email(email)
        except ValueError:
            # E-mail malformado: mesma resposta genérica, mesmo custo.
            self._hasher.verify(self._dummy_hash, password)
            raise AuthError from None

        if user is None:
            self._hasher.verify(self._dummy_hash, password)
            raise AuthError

        senha_ok = self._users.verify_password(user, password)
        if not senha_ok or not user.is_active:
            raise AuthError

        # SÓ depois da senha correta. Quem acertou a senha já provou ter a
        # credencial: dizer a essa pessoa que falta verificar não revela nada
        # que ela não saiba. Antes disso, seria oráculo de existência de conta.
        if self._settings.email_verification_required and user.email_verified_at is None:
            raise EmailNotVerifiedError(user)

        return self._emitir(user)

    # -- rotação ---------------------------------------------------------

    def refresh(self, raw_token: str) -> TokenPair:
        """Rotaciona o refresh. Reuso revoga a família inteira (ADR-0021)."""
        registro = self._refresh.get_by_raw(raw_token)
        if registro is None:
            raise AuthError

        agora = datetime.now(UTC)

        if registro.used_at is not None:
            # Token já rotacionado reapareceu: assume-se roubo.
            self._refresh.revoke_family(registro.family_id, now=agora)
            raise RefreshReuseError

        if registro.revoked_at is not None or _expirado(registro, agora):
            raise AuthError

        user = self._users.get_by_id(registro.user_id)
        if user is None or not user.is_active:
            raise AuthError
        if registro.token_version != user.token_version:
            # Logout global posterior à emissão.
            raise AuthError

        self._refresh.mark_used(registro, now=agora)
        return self._emitir(user, family_id=registro.family_id, now=agora)

    # -- conta -----------------------------------------------------------

    def change_password(
        self, *, user: User, current_password: str, new_password: str
    ) -> TokenPair:
        """Troca a senha do titular e derruba todas as sessões antigas.

        Pede a senha atual mesmo com a sessão já autenticada: se um token
        vazasse, sem esta conferência ele bastaria para tomar a conta em
        definitivo.

        **Revoga tudo o que já foi emitido** — trocar a senha é o gesto de quem
        suspeita de acesso indevido, e sessões antigas sobrevivendo à troca
        anulariam o gesto. Em troca, quem trocou recebe um par novo aqui mesmo
        e não é expulso do próprio aparelho.
        """
        if not self._users.verify_password(user, current_password):
            raise WrongPasswordError

        self._users.set_password(user, new_password)
        self.logout_all(user)
        return self._emitir(user)

    def redefinir_senha(self, *, user: User, new_password: str) -> None:
        """Redefine a senha de quem provou posse do e-mail (2ª emenda à ADR-0044).

        Três efeitos, e nenhum deles é acessório:

        - **revoga todas as sessões** — recuperar senha é o gesto de quem perdeu
          o controle da conta; sessão antiga sobrevivendo anularia o gesto;
        - **marca o e-mail como verificado** — quem digitou o código que chegou
          ao endereço provou controlá-lo. Sem isto, com o gate ligado, uma conta
          não verificada recuperaria a senha e continuaria sem entrar: um beco
          sem saída criado por nós;
        - **não emite sessão**: a pessoa não está autenticada, e o design a manda
          de volta para o login ("Entre com a sua nova senha").
        """
        self._users.set_password(user, new_password)
        self.marcar_verificado(user)
        self.logout_all(user)

    def conferir_senha(self, *, user: User, password: str) -> bool:
        """A senha apresentada é a vigente? (mesma checagem do login)."""
        return self._users.verify_password(user, password)

    def senha_igual_a_atual(self, *, user: User, new_password: str) -> bool:
        """A senha nova repete a vigente?

        É a mesma conferência de `conferir_senha`, lida do outro lado: lá a
        resposta verdadeira autoriza, aqui ela recusa.

        Só isto — impedir **qualquer** senha já usada exigiria guardar histórico
        de hashes, que é dado pessoal novo com custo permanente (2ª emenda).
        """
        return self.conferir_senha(user=user, password=new_password)

    def excluir_conta(self, *, user: User) -> None:
        """Apaga a conta e tudo o que é do titular (ADR-0047).

        **A ordem importa.** Pseudonimizar antes de apagar: o `SET NULL` do
        banco desfaz o vínculo, mas quem grava o pseudônimo é este método — se
        o usuário sumisse primeiro, as linhas já teriam perdido o ator e não
        haveria como marcá-las.

        Só toca as linhas em que este usuário foi ator na trilha **de outra
        pessoa**. As da própria trilha somem com ela, no CASCADE, que é o
        comportamento desejado: a conta vai embora e leva o próprio rastro.

        O resto — sessões, Result, notas, vínculos, tokens — sai pelo CASCADE
        das chaves estrangeiras, sem varredura manual.

        Grava também **quando** pseudonimizou: é dessa data que correm os 12
        meses prometidos pela Política (emenda à ADR-0047). Apagar aqui não é
        atribuição deste método — quem apaga é o expurgo, em
        `services/audit_retention.py`.
        """
        pseudonimo = uuid.uuid4()
        # Uma data só para todas as linhas desta exclusão: elas perderam o dono
        # no mesmo ato, e é daqui que correm os 12 meses da Política (emenda à
        # ADR-0047). `now()` do Postgres é por transação e ficaria igual de todo
        # modo; fixar aqui deixa a intenção explícita e testável.
        pseudonimizado_em = datetime.now(UTC)
        for modelo in (ResultAccessEvent, AnnotationAccessEvent, LiveViewAccessEvent):
            self._session.execute(
                update(modelo)
                .where(
                    modelo.actor_user_id == user.id,
                    modelo.patient_user_id != user.id,
                )
                .values(
                    actor_user_id=None,
                    actor_pseudonym=pseudonimo,
                    pseudonymized_at=pseudonimizado_em,
                )
            )
        self._session.delete(user)
        self._session.flush()

    def update_display_name(self, *, user: User, display_name: str) -> User:
        self._users.set_display_name(user, display_name)
        return user

    # -- troca de e-mail (3ª emenda à ADR-0044) --------------------------

    def endereco_disponivel(self, email: str) -> bool:
        """O endereço está livre para virar o login de outra conta?

        Endereço malformado conta como indisponível: quem chama já responde
        igual nos dois casos, e assim nenhuma resposta distingue "inválido" de
        "ocupado" (ADR-0024).
        """
        try:
            return self._users.get_by_email(email) is None
        except ValueError:
            return False

    def aplicar_troca_de_email(self, *, user: User, new_email: str) -> None:
        """Efetiva a troca depois que o endereço novo provou posse.

        Dois efeitos, e nenhum é acessório:

        - **o endereço vira o login** — é o que a pessoa pediu;
        - **a conta segue verificada**, com a data da prova mais recente: quem
          digitou o código que chegou ao endereço novo provou controlá-lo, e
          exigir uma segunda verificação depois disso seria pedir a mesma prova
          duas vezes.

        **Não** derruba as sessões (diferente de trocar/redefinir a senha): a
        credencial não mudou, e quem chegou até aqui já precisou dela. Derrubar
        não atrapalharia um invasor que sabe a senha, só expulsaria o titular
        do próprio aparelho.
        """
        self._users.set_email(user, new_email)
        user.email_verified_at = datetime.now(UTC)
        self._session.flush()

    # -- logout ----------------------------------------------------------

    def logout(self, raw_token: str) -> None:
        """Revoga a família do refresh apresentado (logout deste dispositivo)."""
        registro = self._refresh.get_by_raw(raw_token)
        if registro is not None:
            self._refresh.revoke_family(registro.family_id)

    def logout_all(self, user: User) -> None:
        """Logout global: invalida tudo o que já foi emitido.

        Inclui os **access tokens** já entregues: o incremento de
        `token_version` não bate mais com a claim `tv` que eles carregam, e a
        dependência de autenticação recusa. Sem essa conferência, "invalida
        tudo" seria falso por até 15 minutos — justamente na janela em que
        quem redefine a senha quer o intruso fora."""
        self._users.revoke_tokens(user)
        self._refresh.revoke_all_for_user(user)

    # -- interno ---------------------------------------------------------

    def _emitir(
        self,
        user: User,
        *,
        family_id: uuid.UUID | None = None,
        now: datetime | None = None,
    ) -> TokenPair:
        access = create_access_token(
            user_id=user.id,
            role=user.role.value,
            settings=self._settings,
            now=now,
            token_version=user.token_version,
        )
        raw_refresh = generate_refresh_token()
        self._refresh.issue(
            user=user,
            raw_token=raw_refresh,
            ttl_days=self._settings.refresh_token_ttl_days,
            family_id=family_id,
            now=now,
        )
        return TokenPair(
            access_token=access,
            refresh_token=raw_refresh,
            expires_in=self._settings.access_token_ttl_minutes * 60,
        )


def _expirado(registro: RefreshToken, agora: datetime) -> bool:
    expires_at = registro.expires_at
    if expires_at.tzinfo is None:  # pragma: no cover - depende do driver
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at <= agora
