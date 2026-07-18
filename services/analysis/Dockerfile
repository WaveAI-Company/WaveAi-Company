# WaveAI Analysis — imagem de execução (MVP).
# Contexto de build = RAIZ do monorepo (precisa de packages/wave-eeg):
#   docker build -f services/analysis/Dockerfile -t waveai-analysis .
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependência local do monorepo primeiro (satisfaz o requisito wave-eeg).
COPY packages/wave-eeg /tmp/wave-eeg
RUN pip install --no-cache-dir /tmp/wave-eeg && rm -rf /tmp/wave-eeg

COPY services/analysis/pyproject.toml ./
RUN pip install --no-cache-dir .

COPY services/analysis/app ./app

EXPOSE 8001

# Config por env (ver .env.example). Sem segredos na imagem.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
