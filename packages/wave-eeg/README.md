# wave-eeg — motor de análise de EEG do WaveAI

Pacote Python (`wave_eeg`; versão em `src/wave_eeg/__init__.py`) com o DSP e a
ciência de dados do produto para o NeuroSky MindWave Mobile 2 (canal único,
FP1, 512 Hz, protocolo ThinkGear). É o **motor de análise de produção**: o
`AnalysisEngine` de `services/analysis` (`WaveEegEngine`) embrulha este pacote,
e nenhum DSP deve ser espalhado pela API ou pela UI. Nasceu como spike de
validação (ADR-0013) e hoje é o motor completo.

Uso **exploratório de bem-estar — não-clínico e não-diagnóstico**; sem claim
clínica (`Medical/71_Intended_Use_and_Regulatory_Positioning.md`). Decisões em
`05_Decisions.md` (ADRs 0013, 0027, 0028, 0031–0035); ciência em `DataScience/`
(protocolo `31`, features `32`); arquitetura em
`Architecture/22_MVP_Platform_Architecture.md`.

## Módulos (`src/wave_eeg/`)

| Módulo | Papel |
|---|---|
| `thinkgear.py`, `simulator.py`, `reader.py` | parser do protocolo, simulador sintético, `DeviceReader` (simulado e serial) |
| `devices.py` | modelo de sinal device-agnóstico e montagem (ADR-0033) |
| `analysis.py` | pré-processamento, PSD, potências de banda, teste do alfa |
| `features.py` | catálogo de features transparentes e interpretáveis |
| `quality.py` | veredito de qualidade de sinal, score 0..1 (ADR-0031) |
| `baseline.py` | baseline pessoal e desvio em N sigma (ADR-0032) |
| `longitudinal.py`, `summary.py` | tendências entre sessões e sumário determinístico em PT-BR (ADR-0035) |
| `esense.py` | métricas eSense da NeuroSky, separadas do catálogo de features (ADR-0034) |
| `exp_b.py`, `exp_c.py`, `exp_d.py` | experimentos do protocolo de fidelidade (`DataScience/31`) |
| `cli.py` | comando `wave-eeg` |

Todo resultado do serviço grava a `engine_version` (rastreabilidade).

## Instalar e testar

```bash
cd packages/wave-eeg
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[serial,dev]"
pytest -q                # testes em tests/ (dados 100% sintéticos)
```

Requer Python >= 3.9; dependências `numpy` e `scipy` (`pyserial` no extra
`serial`). O CI roda `pytest -q` e `ruff check .` (config no `ruff.toml` da raiz).

## CLI

```bash
wave-eeg demo                # Exp. B em dados sintéticos, sem hardware
wave-eeg capture --port COM5 --secs 60 --condition OC --out oc.csv
wave-eeg analyze sessao.csv  # CSV com colunas t,raw,condition
wave-eeg --help              # demais subcomandos (experimentos B, C, D)
```

Captura real: pareie o aparelho por Bluetooth SPP no SO (porta `COMx` no
Windows, `/dev/rfcomm0` no Linux). **Privacidade (LGPD):** testes e fixtures
são sempre sintéticos; CSVs de sinal ficam fora do Git (`.gitignore`). A única
exceção é a autocaptação do próprio desenvolvedor, nos termos da ADR-0028, que
nunca é commitada.

## Uso pelo serviço

`services/analysis` instala este pacote a partir do monorepo (o contexto de
build do `Dockerfile` de `services/analysis` é a raiz) e o expõe por HTTP. Ver
`services/analysis/README.md`.
