# 13 · Runbook — Demonstração ponta a ponta com o aparelho (#17)

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo |
| Data | 2026-07-21 |
| Documentos relacionados | [Architecture/21](../Architecture/21_NeuroSky_Integration_and_Capture.md), [ADR-0025, ADR-0026, ADR-0028](../05_Decisions.md), [Medical/72](../Medical/72_Consent_and_Data_Subject_Rights.md) |

Como rodar a jornada completa — **captar do MindWave → transmitir → analisar → ver o relatório → dashboard** — com aparelho real.

> **[REGRA]** Vale a **ADR-0028**: só o **próprio sinal de quem opera**, em banco **local descartável**, com consentimento dado **pelo app**. Captar terceiros continua **proibido**. Nada de dado real entra em fixture, seed ou commit.

---

## 1. Pré-requisitos

- **MindWave Mobile 2** com pilha, **pareado no Android** (Configurações → Bluetooth). O transporte no Android é **SPP/RFCOMM**, e o pareamento é feito **pelo sistema**, não pelo app.
- Celular Android e o PC **na mesma rede Wi-Fi**.
- **Development client** instalado no celular. Expo Go **não serve**: a captação usa módulo nativo (`react-native-bluetooth-classic`).

> **[ARMADILHA] Dependência nativa nova exige recompilar o development client.** Módulo nativo **não** entra por *hot reload* — ele precisa estar compilado no APK. Se alguém adicionar um pacote com código nativo (foi o caso do `react-native-svg` na #16) e o build do celular for anterior, a tela que o usa quebra com `IllegalViewOperationException: Can't find ViewManager...`, mesmo com o JS atualizado.
>
> Pior: **verificar só no navegador não pega isso**, porque o React Native Web renderiza esses componentes em JS, sem código nativo. Toda dependência nativa precisa de uma passada em **build de dispositivo**.
>
> Correção: `npx expo run:android` (com o aparelho conectado) ou um novo EAS Build.
- Docker (Postgres), e os venvs de `services/api` e `services/analysis`.

## 2. Subir a infraestrutura

```bash
# Postgres descartável
docker run -d --name waveai-dev-pg \
  -e POSTGRES_USER=waveai -e POSTGRES_PASSWORD=waveai_dev -e POSTGRES_DB=waveai \
  -p 5432:5432 postgres:16-alpine

# Analysis (porta 8001)
cd services/analysis && ./.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001

# API (porta 8000) — migrations primeiro
cd services/api
export WAVEAI_API_JWT_SECRET="<openssl rand -hex 32>"
export WAVEAI_API_RESULT_ENCRYPTION_KEY="<Fernet key>"
export WAVEAI_API_REFRESH_COOKIE_SECURE=false
./.venv/Scripts/python.exe -m alembic upgrade head
./.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> **`--host 0.0.0.0` não é detalhe.** Em `127.0.0.1` a API só existe para o PC, e o celular falha silenciosamente ao conectar.

## 3. Apontar o app para o IP da máquina na LAN

`apps/wave-app/.env` (não versionado):

```
EXPO_PUBLIC_API_URL=http://<IP-DA-MAQUINA-NA-LAN>:8000
```

> **Armadilha recorrente:** o IP da LAN **muda** (DHCP). Confira com `ipconfig` (Windows) / `ip addr` (Linux) **a cada sessão**; um IP obsoleto aqui é a causa mais provável de "o app não conecta". `localhost` **não** funciona para o celular.
>
> Consequência conhecida: com o app web em `localhost:8081` e a API num IP de LAN, o cookie de refresh vira **cross-site** e a sessão não sobrevive a um *reload* da página **no navegador**. No celular não há esse problema (o refresh vai para o `expo-secure-store`). Para testar no navegador, aponte para `http://localhost:8000`.

## 4. Subir o app no celular

```bash
cd apps/wave-app && npx expo start --dev-client --lan
```

Abra o development client no celular e carregue o projeto.

## 5. A jornada

1. **Entrar** (ou criar conta de paciente).
2. **Consentir** — "Autorize guardar seus resultados" → ler o termo → **Concordo e autorizo**. Sem isto, a sessão é analisada e exibida, mas **não é guardada** (gate do ADR-0026), e a tela dirá exatamente isso.
3. **Estado ao vivo** → **Procurar aparelhos pareados** → tocar no MindWave.
4. Acompanhar o **contato do sensor** (`0` = bom, `200` = eletrodo solto) e a **alfa relativa** atualizando a cada ~2 s.
5. Coletar **~60 s** e tocar **Parar captação**.
6. Ver o **Relatório da sessão** na própria tela: alfa média, composição por banda, qualidade e `engine_version`. O cálculo é sobre a sessão inteira e leva alguns segundos — o estado "Encerrando a sessão…" cobre essa espera.
7. Confirmar **"Sessão guardada no seu histórico"** e vê-la em **Histórico**, com o ponto novo na linha de tendência.

## 6. Se algo falhar

| Sintoma | Causa provável |
|---|---|
| App não conecta / erro de rede | IP da LAN obsoleto no `.env`, ou API em `127.0.0.1` em vez de `0.0.0.0` |
| Aparelho não aparece na lista | MindWave não pareado **no Android**, desligado, ou sem pilha |
| Contato do sensor preso em `200` | Eletrodo sem contato com a testa, ou clipe de orelha solto |
| "Análise indisponível" | Serviço de Analysis (8001) fora do ar — a captação segue, sem features |
| "Sessão não guardada" | Consentimento não dado, ou `WAVEAI_API_RESULT_PERSISTENCE_ENABLED=false` |
| Sessão cai ao recarregar no navegador | Esperado com API em IP de LAN (cookie cross-site) — ver §3 |
| `Can't find ViewManager...` numa tela | Dependência **nativa** nova sem recompilar o dev client — ver §1 |

## 7. Ao terminar

```bash
docker rm -f waveai-dev-pg   # o banco é descartável — leva junto o dado da autocaptação
```

Para apagar sem derrubar o banco, use o direito de exclusão do próprio app: **`DELETE /me/results`** (Medical/72 §3).
