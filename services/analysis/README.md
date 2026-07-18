# services/analysis — WaveAI Analysis (FastAPI)

Serviço de análise: expõe o **`AnalysisEngine`** por HTTP. Toda a matemática
vive em `packages/wave-eeg`; aqui só a adaptação ao contrato.

> Resultados são **exploratórios, não-clínicos e não-diagnósticos**
> (ver `Medical/71_Intended_Use_and_Regulatory_Positioning.md`).

## Arquitetura (por que existe um contrato)

```
AnalysisEngine (app/engine/base.py)      # interface versionada
  ├── process_window(samples, fs)  -> WindowResult     # ao vivo
  └── process_session(samples, fs, labels?) -> SessionReport   # batch
WaveEegEngine (app/engine/wave_eeg_engine.py)          # implementação v0
```

A API/UI dependem **apenas do contrato**. Evoluir a ciência = nova
implementação do engine, sem tocar em app/API (ver `Architecture/22`, §5).
Todo resultado carrega `engine_version` (rastreabilidade).

## Instalação

O serviço depende do pacote local `wave-eeg`, instalado a partir do monorepo:

```bash
cd services/analysis
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ../../packages/wave-eeg              # dependência local primeiro
pip install -e ".[dev]"
```

## Rodar

```bash
uvicorn app.main:app --reload --port 8001
```

- `GET /health` → `200 {"status":"ok"}`
- `POST /analyze/demo` → Exp. B (alfa relativa, olhos fechados vs. abertos) em
  dados **sintéticos**; retorna `rel_alpha`, `verdict`, bandas e qualidade.

```bash
curl -X POST http://127.0.0.1:8001/analyze/demo
```

## Testes

```bash
pytest -q
```

## Configuração (por ambiente)

Prefixo `WAVEAI_ANALYSIS_` (ver `.env.example`). O `.env` real **não** é
versionado (segredos fora do Git).

| Variável | Padrão | Descrição |
|---|---|---|
| `WAVEAI_ANALYSIS_APP_NAME` | `waveai-analysis` | Nome exibido do serviço |
| `WAVEAI_ANALYSIS_APP_ENV` | `development` | Ambiente lógico |
| `WAVEAI_ANALYSIS_DEMO_SECONDS` | `30` | Duração (s) por condição no demo |

## Docker

O build usa a **raiz do monorepo** como contexto (precisa de `packages/wave-eeg`):

```bash
docker build -f services/analysis/Dockerfile -t waveai-analysis .
docker run --rm -p 8001:8001 waveai-analysis
```

## Dados e limites conhecidos

- O demo usa sinal **sintético** (`data_source: "synthetic"`), nunca dado real
  de pessoa (LGPD).
- `quality` reporta métricas **objetivas sem limiar** (`signal_std`,
  `mains_power`, `mains_power_ratio`). O que conta como sinal "bom o
  suficiente" ainda não está definido — ver **Q-TEC-06** em
  `04_Open_Questions.md`.
