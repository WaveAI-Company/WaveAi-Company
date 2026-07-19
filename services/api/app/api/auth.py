"""Rotas de autenticação (ADR-0020/0021/0023)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db.session import get_session
from ..models.user import User
from ..security.rate_limit import SlidingWindowRateLimiter
from ..services.auth import (
    AuthError,
    AuthService,
    EmailAlreadyRegisteredError,
    TokenPair,
)
from .deps import client_ip, get_auth_service, get_current_user, get_login_limiter
from .schemas import (
    ClientPlatform,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

#: Mensagem única para qualquer falha de credencial: não revela se o e-mail
#: existe, se a senha está errada ou se a conta está inativa (ADR-0023).
CREDENCIAIS_INVALIDAS = "credenciais invalidas"


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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    session: Session = Depends(get_session),
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    try:
        user = service.register(
            email=payload.email,
            password=payload.password,
            role=payload.role,
            display_name=payload.display_name,
        )
    except EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="e-mail ja cadastrado"
        ) from None
    session.commit()
    return UserResponse(
        id=user.id, email=user.email, role=user.role, display_name=payload.display_name
    )


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
    except AuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIAIS_INVALIDAS
        ) from None

    session.commit()
    return _aplicar_refresh(response, tokens, payload.client, settings)


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
    perfil = user.patient_profile or user.doctor_profile
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        display_name=perfil.display_name if perfil else None,
    )
