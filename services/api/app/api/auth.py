"""Rotas de autenticação (ADR-0020/0021/0023)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db.session import get_session
from ..emails import (
    ASSUNTO_CADASTRO_EXISTENTE,
    ASSUNTO_ENDERECO_JA_EM_USO,
    ASSUNTO_RECUPERACAO,
    ASSUNTO_TROCA_AVISO,
    ASSUNTO_TROCA_DE_EMAIL,
    ASSUNTO_VERIFICACAO,
    corpo_cadastro_existente,
    corpo_endereco_ja_em_uso,
    corpo_recuperacao,
    corpo_troca_aviso_endereco_antigo,
    corpo_troca_de_email,
    corpo_verificacao,
)
from ..legal import TERMS_VERSION
from ..models.single_use_token import SingleUseTokenPurpose
from ..models.user import User
from ..security.rate_limit import SlidingWindowRateLimiter
from ..services.auth import (
    AuthError,
    AuthService,
    EmailNotVerifiedError,
    TokenPair,
    WrongPasswordError,
)
from ..services.email import EmailSender
from ..services.single_use_token import SingleUseTokenService
from .deps import (
    client_ip,
    get_auth_service,
    get_current_user,
    get_email_sender,
    get_login_limiter,
    get_register_limiter,
    get_single_use_token_service,
)
from .schemas import (
    ChangeEmailRequest,
    ChangePasswordRequest,
    ClientPlatform,
    ConfirmEmailChangeRequest,
    DeleteMeRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateMeRequest,
    UserResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

#: Mensagem única para qualquer falha de credencial: não revela se o e-mail
#: existe, se a senha está errada ou se a conta está inativa (ADR-0023).
CREDENCIAIS_INVALIDAS = "credenciais invalidas"

#: Resposta única do cadastro: exista ou não a conta, quem pediu vê isto. Quem
#: precisa saber que houve uma tentativa é a **dona do endereço**, e ela fica
#: sabendo por e-mail — não por esta resposta (ADR-0024, mesmo princípio do
#: convite de vínculo).
CADASTRO_REGISTRADO = {"detail": "cadastro registrado; confira seu e-mail"}

#: Resposta única do reenvio, pelo mesmo motivo.
REENVIO_REGISTRADO = {"detail": "se houver conta pendente, o codigo foi reenviado"}

#: Recusa única da verificação: não distingue código errado, expirado, já usado
#: e e-mail sem conta.
CODIGO_INVALIDO = "codigo invalido ou expirado"

#: Resposta única do "esqueci minha senha".
RECUPERACAO_REGISTRADA = {"detail": "se houver conta, o codigo foi enviado"}

#: Resposta única do pedido de troca de e-mail: igual esteja o endereço livre
#: ou já pertencendo a outra conta (ADR-0024). Sem isto, qualquer pessoa logada
#: teria um oráculo de "este e-mail tem WaveAI?" — a mesma brecha que o `409`
#: do cadastro tinha antes da P9-e. Quem precisa saber é a dona do endereço.
TROCA_DE_EMAIL_REGISTRADA = {"detail": "se o endereco estiver livre, o codigo foi enviado"}


def _enviar_recuperacao_de_senha(
    *, user: User, tokens: SingleUseTokenService, sender: EmailSender, settings: Settings
) -> None:
    """Emite o segredo de recuperação e manda **link e código** (o design pede
    os dois na mesma tela — `Design/round1/login.html`)."""
    emitido = tokens.emitir(user=user, purpose=SingleUseTokenPurpose.PASSWORD_RESET)
    sender.send(
        to=user.email,
        subject=ASSUNTO_RECUPERACAO,
        body=corpo_recuperacao(
            codigo=emitido.codigo,
            link=(
                f"{settings.email_link_base_url.rstrip('/')}"
                f"/reset-password?token={emitido.valor}"
            ),
            minutos=settings.single_use_token_ttl_minutes,
        ),
    )


def _enviar_codigo_de_verificacao(
    *, user: User, tokens: SingleUseTokenService, sender: EmailSender, settings: Settings
) -> None:
    """Emite o código e manda o e-mail. Falha de envio **derruba** a operação.

    De propósito: uma conta criada sem nenhum jeito de verificá-la é pior que um
    cadastro que falhou e pode ser repetido — e, com o gate ligado, ela ficaria
    inacessível para sempre.
    """
    emitido = tokens.emitir(user=user, purpose=SingleUseTokenPurpose.EMAIL_VERIFICATION)
    sender.send(
        to=user.email,
        subject=ASSUNTO_VERIFICACAO,
        body=corpo_verificacao(
            codigo=emitido.codigo, minutos=settings.single_use_token_ttl_minutes
        ),
    )


def _resposta_usuario(user: User) -> UserResponse:
    perfil = user.patient_profile or user.doctor_profile
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        display_name=perfil.display_name if perfil else None,
        created_at=user.created_at,
    )


def _aplicar_refresh(
    response: Response,
    tokens: TokenPair,
    client: ClientPlatform,
    settings: Settings,
) -> TokenResponse:
    """Entrega o refresh conforme a plataforma (ADR-0021)."""
    corpo = TokenResponse(access_token=tokens.access_token, expires_in=tokens.expires_in)

    if client is ClientPlatform.WEB:
        # httpOnly: inacessível a JS, mitiga roubo por XSS. Nunca no corpo.
        response.set_cookie(
            key=settings.refresh_cookie_name,
            value=tokens.refresh_token,
            httponly=True,
            secure=settings.refresh_cookie_secure,
            samesite=settings.refresh_cookie_samesite,
            max_age=settings.refresh_token_ttl_days * 24 * 3600,
            path="/auth",
        )
    else:
        # Mobile guarda em expo-secure-store (Keychain/Keystore).
        corpo.refresh_token = tokens.refresh_token

    return corpo


def _ler_refresh(request: Request, payload: RefreshRequest, settings: Settings) -> str:
    token = payload.refresh_token or request.cookies.get(settings.refresh_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIAIS_INVALIDAS)
    return token


@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
def register(
    payload: RegisterRequest,
    request: Request,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
    limiter: SlidingWindowRateLimiter = Depends(get_register_limiter),
    tokens: SingleUseTokenService = Depends(get_single_use_token_service),
    sender: EmailSender = Depends(get_email_sender),
) -> dict[str, str]:
    """Cria a conta e manda o código de verificação — **sem** dizer se o e-mail
    já tinha dono.

    Antes respondia 409 "e-mail ja cadastrado", o que era um oráculo de
    existência de conta. Agora a resposta é única e quem é avisado é a pessoa
    certa: a dona do endereço recebe um e-mail dizendo que houve uma tentativa.
    """
    # Versão dos Termos antes de tudo (ADR-0048): recusar depois de criar a
    # conta deixaria uma conta sem aceite. A recusa é sobre o **texto**, nunca
    # sobre o endereço, então não abre o oráculo que a ADR-0024 fechou.
    if (
        payload.accepted_terms_version is not None
        and payload.accepted_terms_version != TERMS_VERSION
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="termos desatualizados; recarregue a pagina",
        )

    # Throttle por IP. O e-mail **não** entra na chave: a própria chave viraria
    # o oráculo que esta rota passou a evitar.
    ip = client_ip(request)
    if not limiter.is_allowed(f"register:{ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="tentativas demais; tente novamente em instantes",
        )

    resultado = service.cadastrar(
        email=payload.email,
        password=payload.password,
        role=payload.role,
        display_name=payload.display_name,
        accepted_terms_version=payload.accepted_terms_version,
    )
    if resultado.user is not None:
        _enviar_codigo_de_verificacao(
            user=resultado.user, tokens=tokens, sender=sender, settings=settings
        )
    else:
        sender.send(
            to=payload.email,
            subject=ASSUNTO_CADASTRO_EXISTENTE,
            body=corpo_cadastro_existente(),
        )
    session.commit()
    return CADASTRO_REGISTRADO


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
def verify_email(
    payload: VerifyEmailRequest,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    tokens: SingleUseTokenService = Depends(get_single_use_token_service),
) -> Response:
    """Confirma a posse do endereço pelo código de 6 dígitos.

    Não emite sessão: o design mostra um botão "Entrar no WaveAI" depois do
    "Tudo pronto!" (`criar-conta.html`, passo 3 de 3), então quem entra é o
    login de sempre.
    """
    user = service.buscar_por_email(payload.email)
    token = (
        None
        if user is None
        else tokens.consumir_codigo(
            user=user,
            purpose=SingleUseTokenPurpose.EMAIL_VERIFICATION,
            codigo=payload.code,
        )
    )
    if token is None:
        # Mesma recusa para código errado, expirado, já usado e e-mail sem
        # conta — senão a rota vira oráculo pelo caminho do erro.
        session.commit()  # preserva a tentativa contabilizada no token
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=CODIGO_INVALIDO
        )

    service.marcar_verificado(user)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
    limiter: SlidingWindowRateLimiter = Depends(get_register_limiter),
    tokens: SingleUseTokenService = Depends(get_single_use_token_service),
    sender: EmailSender = Depends(get_email_sender),
) -> dict[str, str]:
    """Reenvia o código de verificação. Resposta única, exista ou não a conta.

    É a **outra porta**: quem fechou o app no meio do cadastro volta por aqui.
    O cooldown mora no banco (último token vivo), então vale com N réplicas —
    diferente do rate limit por IP, que é do processo.
    """
    ip = client_ip(request)
    if not limiter.is_allowed(f"resend:{ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="tentativas demais; tente novamente em instantes",
        )

    user = service.buscar_por_email(payload.email)
    # Nada a fazer se não há conta, se ela já está verificada, ou se o último
    # código saiu agora há pouco — e, nos três casos, a resposta é a mesma.
    if (
        user is not None
        and user.email_verified_at is None
        and not tokens.em_cooldown(
            user=user, purpose=SingleUseTokenPurpose.EMAIL_VERIFICATION
        )
    ):
        _enviar_codigo_de_verificacao(
            user=user, tokens=tokens, sender=sender, settings=settings
        )
    session.commit()
    return REENVIO_REGISTRADO


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
    limiter: SlidingWindowRateLimiter = Depends(get_login_limiter),
) -> TokenResponse:
    # Throttle ANTES do Argon2: senão cada tentativa custaria ~19 MiB ao
    # servidor e o hash forte viraria vetor de DoS (ADR-0023).
    ip = client_ip(request)
    for chave in (f"ip:{ip}", f"ip+email:{ip}|{payload.email.strip().lower()}"):
        if not limiter.is_allowed(chave):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="tentativas demais; tente novamente em instantes",
            )

    try:
        tokens = service.login(email=payload.email, password=payload.password)
    except EmailNotVerifiedError:
        # 403 (e não 401): a credencial está certa, o que falta é a posse do
        # endereço. Só chega aqui quem acertou a senha, então contar o estado
        # da conta não revela nada a quem não sabia — e é o que permite o app
        # oferecer "reenviar código" (a outra porta).
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="e-mail nao verificado"
        ) from None
    except AuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIAIS_INVALIDAS
        ) from None

    session.commit()
    return _aplicar_refresh(response, tokens, payload.client, settings)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
    limiter: SlidingWindowRateLimiter = Depends(get_register_limiter),
    tokens: SingleUseTokenService = Depends(get_single_use_token_service),
    sender: EmailSender = Depends(get_email_sender),
) -> dict[str, str]:
    """Inicia a recuperação. Resposta única, exista ou não a conta (ADR-0024).

    Funciona para conta **não verificada** de propósito: redefinir a senha vale
    como prova de posse do endereço (2ª emenda à ADR-0044), então este é também
    o caminho de quem nunca conseguiu verificar.
    """
    ip = client_ip(request)
    if not limiter.is_allowed(f"forgot:{ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="tentativas demais; tente novamente em instantes",
        )

    user = service.buscar_por_email(payload.email)
    # Conta inexistente, inativa ou pedido repetido dentro do cooldown: nada a
    # fazer — e, nos três casos, a resposta é exatamente a mesma.
    if (
        user is not None
        and user.is_active
        and not tokens.em_cooldown(user=user, purpose=SingleUseTokenPurpose.PASSWORD_RESET)
    ):
        _enviar_recuperacao_de_senha(
            user=user, tokens=tokens, sender=sender, settings=settings
        )
    session.commit()
    return RECUPERACAO_REGISTRADA


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    payload: ResetPasswordRequest,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    tokens: SingleUseTokenService = Depends(get_single_use_token_service),
) -> Response:
    """Redefine a senha por **código digitado** ou **token do link**.

    Não emite sessão: o design manda de volta para o login ("Senha atualizada ·
    Entre com a sua nova senha").
    """
    if payload.token is not None:
        # O link não carrega o endereço — o próprio token identifica a linha.
        token = tokens.consumir(
            valor=payload.token, purpose=SingleUseTokenPurpose.PASSWORD_RESET
        )
        user = token.user if token is not None else None
    else:
        user = service.buscar_por_email(payload.email or "")
        token = (
            None
            if user is None
            else tokens.consumir_codigo(
                user=user,
                purpose=SingleUseTokenPurpose.PASSWORD_RESET,
                codigo=payload.code or "",
            )
        )

    if token is None or user is None:
        session.commit()  # preserva a tentativa contabilizada no token
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=CODIGO_INVALIDO
        )

    if service.senha_igual_a_atual(user=user, new_password=payload.new_password):
        # O segredo já foi queimado acima; recusar aqui é sobre a senha, não
        # sobre o direito de redefinir — quem repetiu pede outro código.
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="a nova senha precisa ser diferente da atual",
        )

    service.redefinir_senha(user=user, new_password=payload.new_password)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    raw = _ler_refresh(request, payload, settings)
    try:
        tokens = service.refresh(raw)
    except AuthError:
        # Cobre também o reuso (que já revogou a família dentro do serviço).
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIAIS_INVALIDAS
        ) from None

    session.commit()
    return _aplicar_refresh(response, tokens, payload.client, settings)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: RefreshRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> Response:
    token = payload.refresh_token or request.cookies.get(settings.refresh_cookie_name)
    if token:
        service.logout(token)
        session.commit()
    response.delete_cookie(settings.refresh_cookie_name, path="/auth")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return _resposta_usuario(user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UpdateMeRequest,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    user: User = Depends(get_current_user),
) -> UserResponse:
    """Edita o próprio cadastro. Só o titular, e só o nome de exibição."""
    service.update_display_name(user=user, display_name=payload.display_name)
    session.commit()
    return _resposta_usuario(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    payload: DeleteMeRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
    limiter: SlidingWindowRateLimiter = Depends(get_login_limiter),
) -> Response:
    """Exclusão da própria conta — **imediata e definitiva** (ADR-0047).

    Apaga sessões, Result, notas, vínculos e tokens pelo CASCADE. O que
    sobrevive é a trilha de leitura **de outras pessoas** em que este usuário
    foi o ator: o evento fica, pseudonimizado, para o titular que permanece não
    perder a evidência de que houve acesso.

    **Throttled como a troca de senha**, e pela mesma razão: o campo "senha"
    aqui é um oráculo, e sem limite seria um caminho mais silencioso do que o
    próprio login para adivinhá-la.

    Não há carência: quem confirmou, apagou. A tela tem de dizer isso **antes**.
    """
    ip = client_ip(request)
    if not limiter.is_allowed(f"exclusao:{ip}|{user.id}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="tentativas demais; tente novamente em instantes",
        )

    if not service.conferir_senha(user=user, password=payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIAIS_INVALIDAS
        )

    service.excluir_conta(user=user)
    session.commit()
    # O cookie tem de sair junto: deixá-lo para trás faria o navegador tentar
    # renovar a sessão de uma conta que não existe mais.
    response.delete_cookie(settings.refresh_cookie_name, path="/auth")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password", response_model=TokenResponse)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    client: ClientPlatform = ClientPlatform.WEB,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
    limiter: SlidingWindowRateLimiter = Depends(get_login_limiter),
) -> TokenResponse:
    """Troca a senha do titular e devolve um par de tokens novo.

    **Throttled como o login**, e pela mesma razão: o campo "senha atual" é um
    oráculo de senha, e sem limite ele seria um caminho mais silencioso do que
    o próprio login para adivinhá-la.
    """
    ip = client_ip(request)
    if not limiter.is_allowed(f"senha:{ip}|{user.id}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="tentativas demais; tente novamente em instantes",
        )

    try:
        tokens = service.change_password(
            user=user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except WrongPasswordError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIAIS_INVALIDAS
        ) from None

    session.commit()
    return _aplicar_refresh(response, tokens, client, settings)


# -- troca de e-mail (3ª emenda à ADR-0044) ------------------------------


@router.post("/email", status_code=status.HTTP_202_ACCEPTED)
def request_email_change(
    payload: ChangeEmailRequest,
    request: Request,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
    limiter: SlidingWindowRateLimiter = Depends(get_login_limiter),
    tokens: SingleUseTokenService = Depends(get_single_use_token_service),
    sender: EmailSender = Depends(get_email_sender),
) -> dict[str, str]:
    """Pede a troca do endereço da conta. Resposta **uniforme**.

    Simétrica ao `POST /auth/password`, e pelas mesmas razões: pede a senha
    atual (um token roubado não pode bastar) e é throttled (o campo "senha
    atual" é um oráculo de senha).

    A troca não acontece aqui: ela fica pendente no token até o **novo**
    endereço confirmar o código — é o endereço novo que precisa provar posse,
    não o antigo.
    """
    ip = client_ip(request)
    if not limiter.is_allowed(f"email:{ip}|{user.id}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="tentativas demais; tente novamente em instantes",
        )

    if not service.conferir_senha(user=user, password=payload.current_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIAIS_INVALIDAS
        )

    # Pedir o endereço que já é o seu não é ambíguo nem revela nada de
    # terceiros — a pessoa conhece o próprio e-mail —, então aqui vale dizer o
    # que houve em vez de mandá-la esperar um código que não vem.
    if payload.new_email.strip().lower() == user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="este ja e o e-mail da conta",
        )

    if not tokens.em_cooldown(user=user, purpose=SingleUseTokenPurpose.EMAIL_CHANGE):
        # O aviso ao endereço ATUAL sai independentemente de o destino estar
        # livre. Se dependesse disso, a presença do aviso contaria se o
        # endereço tem conta — e o titular é justamente quem não pode ficar sem
        # esse sinal quando alguém tenta mover a conta dele.
        sender.send(
            to=user.email,
            subject=ASSUNTO_TROCA_AVISO,
            body=corpo_troca_aviso_endereco_antigo(
                minutos=settings.single_use_token_ttl_minutes
            ),
        )
        if service.endereco_disponivel(payload.new_email):
            emitido = tokens.emitir(
                user=user,
                purpose=SingleUseTokenPurpose.EMAIL_CHANGE,
                new_email=payload.new_email,
            )
            sender.send(
                to=payload.new_email,
                subject=ASSUNTO_TROCA_DE_EMAIL,
                body=corpo_troca_de_email(
                    codigo=emitido.codigo,
                    minutos=settings.single_use_token_ttl_minutes,
                ),
            )
        else:
            # Endereço ocupado: nenhum token, nenhum código — e quem fica
            # sabendo é a dona do endereço, não quem pediu (ADR-0024).
            sender.send(
                to=payload.new_email,
                subject=ASSUNTO_ENDERECO_JA_EM_USO,
                body=corpo_endereco_ja_em_uso(),
            )

    session.commit()
    return TROCA_DE_EMAIL_REGISTRADA


@router.post("/email/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm_email_change(
    payload: ConfirmEmailChangeRequest,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
    user: User = Depends(get_current_user),
    tokens: SingleUseTokenService = Depends(get_single_use_token_service),
) -> Response:
    """Confirma a troca com o código que chegou ao endereço novo.

    Não emite sessão nem devolve o usuário: a sessão em curso continua valendo
    (a credencial não mudou) e o app relê o `GET /auth/me`.
    """
    token = tokens.consumir_codigo(
        user=user,
        purpose=SingleUseTokenPurpose.EMAIL_CHANGE,
        codigo=payload.code,
    )
    if token is None or token.new_email is None:
        # Preserva a tentativa contabilizada na linha do token — é o contador
        # que segura a adivinhação de 6 dígitos (1ª emenda à ADR-0044).
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=CODIGO_INVALIDO
        )

    # Confere de novo: entre o pedido e a confirmação (até 10 min) alguém pode
    # ter cadastrado o endereço. Aqui um erro específico não vaza nada — quem
    # digitou o código controla a caixa, e o token só foi emitido porque o
    # endereço estava livre.
    if not service.endereco_disponivel(token.new_email):
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="este e-mail ficou indisponivel; peca a troca novamente",
        )

    service.aplicar_troca_de_email(user=user, new_email=token.new_email)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
