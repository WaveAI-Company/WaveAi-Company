# WaveAI API — imagem de execução (MVP)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependências a partir do metadata do projeto (camada cacheável).
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copia o código da aplicação e as migrations (necessárias para rodar
# `alembic upgrade head` de dentro do container).
COPY app ./app
COPY alembic.ini ./
COPY migrations ./migrations
# O seed de desenvolvimento roda de DENTRO do container: é lá que o banco do
# compose é alcançável sem ninguém montar uma DATABASE_URL à mão — e URL de
# banco montada à mão é como se semeia o banco errado. O script se recusa a
# rodar com `app_env` diferente de `development` (fail-closed), então estar na
# imagem não cria conta em lugar nenhum por si só.
COPY scripts ./scripts

EXPOSE 8000

# Config por env (ver .env.example). Sem segredos na imagem.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
