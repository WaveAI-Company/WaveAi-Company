# eeg-capture-spike

Spike de **captação e análise de EEG** (NeuroSky MindWave Mobile 2, protocolo ThinkGear).
Objetivo: validar as ferramentas de conexão/extração/análise **antes** de comprometer o stack do produto — ver `Architecture/21` e `DataScience/31` (Exp. B), decisão em ADR-0013.

## Por que dá para rodar sem o aparelho
O código é dividido em camadas testáveis:
- `thinkgear.py` — parser puro do protocolo (byte stream → eventos).
- `simulator.py` — gera um stream ThinkGear sintético (para testes/CI).
- `reader.py` — `DeviceReader` com `SimulatedReader` (sem hardware) e `SerialReader` (real).
- `analysis.py` — PSD, potências de banda e o teste do alfa (olhos fechados vs. abertos).
- `cli.py` — comandos `demo`, `capture`, `analyze`.

## Instalação
```bash
cd packages/wave-eeg
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[serial,dev]"
```

## Rodar sem hardware (demo + testes)
```bash
wave-eeg demo            # roda o Exp. B em dados sintéticos e imprime o veredito
pytest -q                # roda a suíte de testes
```

## Captura com o dispositivo real
1. Pareie o MindWave Mobile 2 via Bluetooth (SPP) no SO. Isso cria uma porta serial:
   - Windows: `COMx` (veja em Gerenciador de Dispositivos → Portas COM).
   - Linux: `/dev/rfcomm0` (após `rfcomm bind`).
2. Capture blocos rotulados por condição (Exp. B):
   ```bash
   wave-eeg capture --port COM5 --secs 60 --condition OC --out of.csv   # olhos fechados
   wave-eeg capture --port COM5 --secs 60 --condition OA --out oa.csv   # olhos abertos
   ```
3. Junte num único CSV (colunas `raw,condition`) e analise:
   ```bash
   wave-eeg analyze sessao.csv
   ```

> **Privacidade (LGPD):** CSVs de sinal ficam fora do Git por padrão (`.gitignore`). Não comite dados de pessoas identificáveis.

## Próximos passos
- Substituir os stubs de artefato/qualidade pelos experimentos A, D, E do protocolo (`DataScience/31`).
- Migrar o `SerialReader` para a fundação durável de captação do produto (mesma interface `DeviceReader`).
