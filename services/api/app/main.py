"""Aplicação FastAPI da API do WaveAI.

Hoje expõe health check, autenticação (JWT + papéis) e os vínculos
médico-paciente. O gateway WebSocket do stream entra na #13.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .api import (
    annotations_router,
    auth_router,
    care_links_router,
    live_router,
    results_router,
    stream_router,
)
from .config import get_settings

# Fail-closed: sem WAVEAI_API_JWT_SECRET válido a app nem sobe (ADR-0023).
settings = get_settings()

app = FastAPI(title=settings.app_name, version=__version__)

# Origens explícitas (nunca "*"): o cookie do refresh viaja com credenciais, e
# curinga + credenciais é combinação proibida pelo padrão CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(care_links_router)
app.include_router(results_router)
app.include_router(annotations_router)
app.include_router(stream_router)
app.include_router(live_router)


#: Chaves do erro do pydantic que devolvem ao cliente o que ELE mandou.
_ECO_DA_ENTRADA = {"input", "ctx", "url"}


@app.exception_handler(RequestValidationError)
async def erro_de_validacao_sem_eco(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """422 sem devolver o valor recusado.

    O default do FastAPI ecoa `input` em cada erro — então uma senha recusada
    volta inteira no corpo da resposta e vai parar em qualquer log, proxy ou
    monitoração no caminho. E senha recusada quase sempre é uma variação da
    senha de verdade da pessoa.

    O cliente continua recebendo **onde** (`loc`) e **por quê** (`msg`), que é
    o que ele precisa para corrigir; o que sai é só o eco da entrada. Vale para
    todos os campos, não só senha: `loc` já diz o campo, e nenhum consumidor
    nosso lê `input` (o app usa `detail` só como texto).
    """
    erros = [
        {chave: valor for chave, valor in erro.items() if chave not in _ECO_DA_ENTRADA}
        for erro in exc.errors()
    ]
    # 422 literal: o Starlette está renomeando a constante
    # (`..._UNPROCESSABLE_ENTITY` → `..._UNPROCESSABLE_CONTENT`) e usar
    # qualquer um dos dois nomes amarra a app a uma faixa de versão.
    return JSONResponse(status_code=422, content={"detail": erros})


@app.get("/health")
def health() -> dict[str, str]:
    """Health check do serviço. Não expõe dado sensível."""
    return {"status": "ok"}
