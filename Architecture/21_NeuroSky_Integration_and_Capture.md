# 21 · Integração NeuroSky e Estratégia de Captação (v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Rascunho — resolve o spike Q-TEC-05 |
| Data | 2026-07-18 |
| Dispositivo | NeuroSky MindWave Mobile 2 |
| Documentos relacionados | [31_Signal_Fidelity_Study_Protocol](../DataScience/31_Signal_Fidelity_Study_Protocol.md), [20_System_Architecture_Overview](20_System_Architecture_Overview.md), [07_Tech_Stack](../07_Tech_Stack.md), [05_Decisions](../05_Decisions.md) |

> Rótulos: **[FATO] / [HIPÓTESE] / [OPINIÃO] / [RECOMENDAÇÃO]**.

---

## 0. Correção de premissa: iOS **não** é bloqueio *(fato verificado)*
**[HIPÓTESE que eu havia levantado]** Bluetooth SPP é um perfil do Bluetooth **Classic**; no iOS, apps de terceiros não usam SPP com acessórios não-MFi — o que **poderia** inviabilizar o app iOS.

**[FATO verificado]** O MindWave Mobile 2 tem **módulo dual-mode BT/BLE**: **SPP (Classic)** para **PC, Mac e Android**, e **BLE (GATT)** para **iOS**. No iOS a conexão é por **BLE**, sem pareamento explícito e **sem exigir MFi**. → **O risco de bloqueio de iOS está removido.** Bom exemplo do princípio de verificar antes de afirmar.

---

## 1. Dois contextos que não devem ser confundidos *(a lacuna nas 4 opções)*
As quatro alternativas que você levantou resolvem **um** dos contextos. Há dois:

| Contexto | Onde roda | Transporte | O que as 4 opções cobrem |
|---|---|---|---|
| **A · Captação para o ESTUDO** (agora) | PC/Mac | SPP (Classic) | **Sim** — é onde vivem as 4 opções |
| **B · Captação no PRODUTO** (futuro) | App móvel | Android=SPP · iOS=BLE | **Não** — nenhuma das 4 cobre mobile |

**[OPINIÃO]** Tratar os dois como o mesmo problema é um erro comum. Para o **estudo**, o melhor caminho é capturar **no PC com Python** (perto de `scipy`/`mne`), desacoplado do stack do produto. O produto móvel é um segundo problema, resolvido depois (ADR-0006).

---

## 2. Fatos técnicos verificados

### 2.1 Bluetooth (dual-mode)
| Plataforma | Transporte | Implicação |
|---|---|---|
| PC / Mac | Bluetooth Classic **SPP** (vira porta serial/COM) | Ideal para o estudo |
| Android | Bluetooth Classic **SPP** (RFCOMM) | Viável nativamente / RN com módulo Classic |
| iOS | **BLE (GATT)** | Via CoreBluetooth / RN com módulo BLE; sem MFi |

### 2.2 Protocolo ThinkGear (baixo nível)
**[FATO]** Pacote = `0xAA 0xAA` (2× SYNC) + `PLENGTH` + payload + `CHECKSUM`, com `checksum = (~soma_dos_bytes_do_payload) & 0xFF`. O **raw EEG** é transmitido a ≤ **512 Hz**. Documentado oficialmente (ThinkGear Serial Stream Guide / Communications Protocol). → implementar o parser direto é **simples e bem-suportado**.

### 2.3 Dois "protocolos" distintos da NeuroSky (não confundir)
- **ThinkGear Communications/Serial Protocol** — *bytes crus* na porta serial (o dispositivo fala isso).
- **ThinkGear Socket Protocol** — *JSON via TCP* (porta 13854), exposto pelo **ThinkGear Connector (TGC)**, um app **desktop** que faz a ponte Bluetooth→socket.

---

## 3. Comparação das opções (Contexto A — estudo em PC)

| # | Opção | Como acessa | Prós | Contras / Risco |
|---|---|---|---|---|
| 1 | **TGC + Socket JSON** (oficial) | App TGC → JSON/TCP | Oficial; sem implementar protocolo; entrega raw+bandas+eSense | TGC é **desktop e antigo**; atrito possível em SO moderno **[HIPÓTESE]**; camada extra (jitter) |
| 2 | **pyThinkGear** | Cliente Python p/ socket do TGC | Rápido de usar | Depende do TGC; projeto **sem manutenção** |
| 3 | **NeuroPy** | Abre a **porta serial** e faz o parse | Não depende do TGC | Projeto **sem manutenção**; confirmar via serial no spike |
| 4 | **Protocolo direto** (pyserial) | Lê bytes da serial e parseia | **Máx. controle** (timestamp, robustez); zero deps aging; reusável no produto | Mais trabalho inicial (parser ~100–150 linhas) |

> **[Nota de fidelidade/timing]** Para o que o estudo precisa (potências de banda, alfa OF/OA, reatividade), **a ordem das amostras já define o tempo** (1/512 s por amostra), então o TGC é **adequado**. A vantagem do parser direto é **durabilidade e independência**, não validade do estudo.

---

## 4. Recomendação — Contexto A (estudo, agora)
**[RECOMENDAÇÃO] Abordagem híbrida, atrás de uma abstração:**
1. **Bootstrap (dias):** TGC + biblioteca Python (NeuroPy **ou** pyThinkGear) para **ver dado fluindo já** e validar a malha ponta a ponta (captação → CSV → PSD → alfa).
2. **Fundação durável:** implementar o **parser direto do protocolo** (pyserial) como base oficial de captação — motivos: libs 2/3 **sem manutenção**, TGC frágil em SO moderno **[HIPÓTESE]**, controle de timestamp e **reuso do conhecimento de protocolo para o produto**.
3. Tudo por trás de uma **interface `DeviceReader`** (seção 6), para trocar de implementação sem tocar no resto.

**[OPINIÃO]** Concordo que a opção 1 é o começo mais fácil (por isso o bootstrap), mas **discordo de parar nela**: o TGC não é o caminho do produto e as libs envelhecem. O parser direto é barato e paga-se rápido.

## 5. Recomendação — Contexto B (produto móvel, futuro)
- **Android:** SPP/Classic — módulo nativo (ex.: `react-native-bluetooth-classic`) ou SDK Android da NeuroSky. **[HIPÓTESE]** confirmar manutenção do SDK.
- **iOS:** BLE/GATT — CoreBluetooth (ex.: `react-native-ble-plx`) ou SDK iOS da NeuroSky.
- **Consequência de design:** o app terá **duas vias de transporte** (Classic no Android, BLE no iOS) atrás da **mesma** abstração `DeviceReader`. Decisão do framework fica em **ADR-0006**, agora **informada** pelos fatos de Bluetooth.

## 6. Camada de abstração de dispositivo (anti-corrupção)
**[RECOMENDAÇÃO]** Definir uma interface estável, independente de biblioteca/transporte:
```
DeviceReader:
  connect() / disconnect()
  onRawSample(callback: {t, amplitude})      # 512 Hz
  onMetric(callback: {poorSignal, bands, blink, eSense})
  status()  # qualidade de conexão/sinal
Implementações: DirectSerialReader (estudo) · TGCSocketReader (bootstrap) · MobileBleReader / MobileSppReader (produto)
```
Isso mitiga o risco **R-07** (dependência de SDK proprietário) e permite suportar outros aparelhos no futuro.

## 7. Formato dos dados de captação (para o estudo)
**[RECOMENDAÇÃO]** Gravar em **CSV ou Parquet**: `timestamp, raw_amplitude, poor_signal, condicao/rotulo_evento`, com um *sidecar* de metadados da sessão (sujeito pseudonimizado, aparelho, ajuste, notas). Alinhar com [doc 31](../DataScience/31_Signal_Fidelity_Study_Protocol.md).

## 8. Riscos
| ID | Risco | Sev. | Mitigação |
|---|---|---|---|
| R-07 | Dependência de SDK/lib proprietária | 🟡 | Abstração `DeviceReader`; parser direto |
| R-09 (novo) | Bibliotecas (pyThinkGear/NeuroPy) sem manutenção | 🟡 | Parser direto como fundação |
| R-10 (novo) | TGC com atrito em SO moderno **[HIPÓTESE]** | 🟡 | Não depender do TGC no caminho durável |
| R-11 (novo) | Perda de amostras / latência na captação | 🟡 | Medir no Exp. A do doc 31 (% janelas úteis) |
| R-12 (novo) | Assimetria SPP(Android)/BLE(iOS) no produto | 🟢–🟡 | Abstração + módulos por plataforma |

## 9. Decisão e perguntas
- **ADR-0013** (registrado em [05_Decisions](../05_Decisions.md)): estratégia híbrida + abstração para o estudo.
- **Q-TEC-05:** opções mapeadas e recomendação definida → resta **executar** o spike (parser). Rebaixada P0→P1.
- **Q-TEC-03 / ADR-0006:** agora informadas pelos fatos de Bluetooth.
