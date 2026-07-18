# WaveAI API — imagem de execução (MVP)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependências a partir do metadata do projeto (camada cacheável).
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copia o código da aplicação.
COPY app ./app

EXPOSE 8000

# Config por env (ver .env.example). Sem segredos na imagem.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
