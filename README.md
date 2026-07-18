# WaveAI

Plataforma de captação e análise de sinais de EEG (NeuroSky) assistida por IA, com dois ambientes (paciente e profissional de saúde). **Fase atual: engenharia/concepção (Fase 0)** — a documentação precede o código.

> **Posicionamento (fase atual):** ferramenta **não-clínica / não-diagnóstica** de monitoramento de EEG de consumo e bem-estar. SaMD é destino de longo prazo (ver `Medical/71` e ADR-0012). A IA **apoia**; o profissional decide.

## Estrutura do repositório (monorepo)
| Caminho | Conteúdo |
|---|---|
| `00`–`09`, `MASTER_PLAN.md` | Núcleo: visão, objetivos, glossário, hipóteses, perguntas, decisões (ADRs), roadmap, stack, backlog. |
| `Documentation/` | Índice da documentação e workflow de Git. |
| `Medical/` | Estratégia regulatória/clínica, uso pretendido. |
| `Architecture/` | Visão de arquitetura, integração NeuroSky/captação. |
| `DataScience/` | Processamento de sinais, protocolo de fidelidade. |
| `AI/` · `Backend/` · `Frontend/` · `Mobile/` · `Infrastructure/` · `Research/` · `RFC/` | Documentação por disciplina (a expandir). |
| `experiments/eeg-capture-spike/` | **Código** do spike de captação/análise (Q-TEC-05). |

## Começando pelo código
Ver [`experiments/eeg-capture-spike/README.md`](experiments/eeg-capture-spike/README.md). Resumo:
```bash
cd experiments/eeg-capture-spike
pip install -e ".[serial,dev]"
wave-eeg demo     # roda a análise em dados sintéticos (sem hardware)
pytest -q         # testes
```

## Como contribuímos
Fluxo **GitHub Flow** (branches curtas + PR + CI). Detalhes e comandos em [`Documentation/10_Git_Workflow.md`](Documentation/10_Git_Workflow.md).

## Leia primeiro
O [Plano Diretor](MASTER_PLAN.md) orienta toda a evolução do projeto.
