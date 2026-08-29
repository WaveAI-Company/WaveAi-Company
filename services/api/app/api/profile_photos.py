"""Foto de perfil (ADR-0050): upload, remoção e leitura.

- **Própria:** `PUT/GET/DELETE /me/photo`.
- **Do contraparte:** `GET /users/{user_id}/photo` — só se houver um CareLink
  **ativo** entre quem olha e o alvo. A visibilidade é mútua (médico↔paciente) e,
  como o `display_name`, **não** é auditada (ADR-0050): é metadado de identidade
  do vínculo, não o dado de saúde que a ADR-0037 protege.

O upload chega como **corpo cru** (`Content-Type: image/*`), não multipart: evita
uma dependência a mais e o Pillow valida o conteúdo de verdade, não o cabeçalho.
A imagem é re-codificada no servidor (sem EXIF) antes de tocar o banco.

Sem URL pública: toda leitura passa por autenticação e pelo predicado do vínculo.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..db.session import get_session
from ..models.profile_photo import ProfilePhoto
from ..models.user import User
from ..services.care import CareService
from ..services.profile_photo import (
    CONTENT_TYPE,
    TAMANHO_MAXIMO_UPLOAD,
    ImagemInvalida,
    processar_foto,
)
from .deps import get_care_service, get_current_user

router = APIRouter(tags=["profile-photo"])


def _buscar(session: Session, user_id: uuid.UUID) -> ProfilePhoto | None:
    return session.get(ProfilePhoto, user_id)


def _resposta_imagem(foto: ProfilePhoto | None) -> Response:
    if foto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sem foto")
    # `private`: é dado do titular; nada de cache compartilhado.
    return Response(
        content=foto.image,
        media_type=foto.content_type,
        headers={"Cache-Control": "private, max-age=0, no-store"},
    )


@router.put("/me/photo", status_code=status.HTTP_204_NO_CONTENT)
async def upload_minha_foto(
    request: Request,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    """Recebe a imagem crua no corpo, re-codifica e guarda (cria ou substitui)."""
    dados = await request.body()
    # Guarda barata antes de gastar CPU no decode. O serviço confere de novo, mas
    # recusar aqui evita ler um corpo enorme inteiro na memória do handler.
    if len(dados) > TAMANHO_MAXIMO_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="imagem grande demais",
        )
    try:
        normalizada = processar_foto(dados)
    except ImagemInvalida as exc:
        # 422 literal: o Starlette está renomeando a constante e o alias antigo
        # emite DeprecationWarning (mesma escolha de `main.py`).
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    foto = _buscar(session, user.id)
    if foto is None:
        session.add(ProfilePhoto(user_id=user.id, content_type=CONTENT_TYPE, image=normalizada))
    else:
        foto.content_type = CONTENT_TYPE
        foto.image = normalizada
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/photo")
def minha_foto(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    return _resposta_imagem(_buscar(session, user.id))


@router.delete("/me/photo", status_code=status.HTTP_204_NO_CONTENT)
def remover_minha_foto(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    foto = _buscar(session, user.id)
    if foto is not None:
        session.delete(foto)
        session.commit()
    # 204 mesmo sem foto: remover o que já não existe é sucesso, e não vira
    # oráculo de "havia foto?".
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/users/{user_id}/photo")
def foto_do_contraparte(
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    care: CareService = Depends(get_care_service),
) -> Response:
    """Foto de um usuário vinculado. 404 uniforme quando não há vínculo ativo OU
    não há foto — não distingue os dois, para não virar oráculo de vínculo."""
    if user_id != user.id and not care.ha_vinculo_ativo(a=user.id, b=user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sem foto")
    return _resposta_imagem(_buscar(session, user_id))
