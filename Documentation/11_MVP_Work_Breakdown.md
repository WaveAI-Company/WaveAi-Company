# 11 · Quebra de Trabalho do MVP + Segmentação no GitHub — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo — fonte das issues do GitHub |
| Data | 2026-07-18 |
| Documentos relacionados | [Architecture/22_MVP_Platform_Architecture](../Architecture/22_MVP_Platform_Architecture.md), [12_Claude_Code_Guide](12_Claude_Code_Guide.md), [10_Git_Workflow](10_Git_Workflow.md) |

Cada **issue** abaixo é auto-contida: vira **1 branch → 1 sessão do Claude Code → 1 PR**. Rótulos de aceite servem de **contrato de teste**. Ordem = dependência (M0 antes de M1…).

**Como usar no GitHub:** crie um **Milestone** por M0–M5; cada issue vira um *issue* com os campos abaixo colados; branch `feat/<área>-<slug>`; PR fecha a issue (`Closes #n`); CI verde obrigatório.

---

## Marcos (milestones)
- **M0 — Esqueleto que anda:** monorepo, CI, health checks, `wave-eeg` migrado.
- **M1 — Autenticação:** cadastro/login paciente e médico, JWT, rotas por papel.
- **M2 — Domínio & Médico:** pacientes, vínculo médico-paciente, telas de lista (dados de teste).
- **M3 — Captação & Streaming:** app conecta o dispositivo (mobile), envia raw por WS, estado ao vivo.
- **M4 — Análise & Dashboards:** serviço de análise (wave_eeg), relatório por sessão, gráficos por papel.
- **M5 — Polimento de UI:** identidade visual bonita por papel, responsividade, acessibilidade.

---

## M0 — Esqueleto que anda

### #1 · Reestruturar para monorepo + migrar wave-eeg
- **Escopo:** criar `apps/`, `services/`, `packages/`, `infra/`; `git mv experiments/eeg-capture-spike packages/wave-eeg`; ajustar imports/CI.
- **Aceite:** `pytest` de `packages/wave-eeg` verde no novo caminho; CI atualizado; docs de estrutura batem.
- **Notas p/ Claude Code:** usar `git mv` (preserva histórico); não quebrar o pacote `wave_eeg`.

### #2 · Serviço API (FastAPI) esqueleto + /health
- **Escopo:** `services/api` FastAPI, endpoint `GET /health`, config por env, Dockerfile, testes.
- **Aceite:** `GET /health` → 200 `{status:"ok"}`; teste de integração passa; sobe via docker-compose.

### #3 · Serviço Analysis (FastAPI) esqueleto + /health, importando wave_eeg
- **Escopo:** `services/analysis` FastAPI; importa `packages/wave-eeg`; `POST /analyze/demo` retorna o resultado do Exp. B sintético.
- **Aceite:** `POST /analyze/demo` → JSON com `rel_alpha`, `verdict`; teste passa.

### #4 · App Expo universal (iOS/Android/Web) — boot + navegação
- **Escopo:** `apps/wave-app` Expo (RN + Web); tela inicial; navegação; roda em web e emulador.
- **Aceite:** `npm run web` abre; build mobile inicia; tela placeholder por papel (mock).

### #5 · docker-compose + CI unificado
- **Escopo:** `infra/docker-compose.yml` (api, analysis, postgres); CI roda testes de api, analysis, wave-eeg e lint do app.
- **Aceite:** `docker compose up` sobe tudo; CI verde nos 4 pacotes.

---

## M1 — Autenticação

### #6 · Modelo de usuário + migrations (Postgres)
- **Escopo:** `User(email, hash, role∈{patient,doctor})`, perfis, migrations (Alembic).
- **Aceite:** migration cria tabelas; teste de repositório CRUD passa; senha com hash forte (bcrypt/argon2).

### #7 · Registro + login + JWT (papéis)
- **Escopo:** `POST /auth/register`, `POST /auth/login` → JWT (access+refresh) com `role`; middleware de autorização.
- **Aceite:** login retorna JWT; rota protegida exige token; papel errado → 403; testes cobrem casos.

### #8 · Fluxo de auth no app (web+mobile) + rotas por papel
- **Escopo:** telas de login/registro; guarda de rota; ao logar, direciona UI de paciente ou médico.
- **Aceite:** logar como paciente mostra área do paciente; como médico, a do médico; token persistido com segurança.

---

## M2 — Domínio & Médico

### #9 · Pacientes e vínculo médico-paciente (API)
- **Escopo:** `CareLink(doctor,patient)`; endpoints: médico lista/adiciona pacientes vinculados; RBAC (médico só vê seus pacientes).
- **Aceite:** médico A não acessa paciente de médico B (403); testes de autorização passam.

### #10 · Telas do médico: lista de pacientes + detalhe (mock)
- **Escopo:** lista de pacientes, tela de detalhe com sessões (dados de teste fictícios rotulados).
- **Aceite:** navegação médico → paciente → sessões funciona no web e mobile.

### #11 · Telas do paciente: início + histórico (mock)
- **Escopo:** home do paciente, histórico de sessões (mock), perfil.
- **Aceite:** paciente vê seu histórico fictício; UI responsiva.

---

## M3 — Captação & Streaming

### #12 · Captura de EEG no app (capability por plataforma)
- **Escopo:** `DeviceConnection` no cliente (espelha o `DeviceReader`); impl. mobile (módulo nativo BLE/SPP — ref. [Architecture/21](../Architecture/21_NeuroSky_Integration_and_Capture.md)); em web sem suporte, exibir "captura indisponível neste dispositivo".
- **Aceite:** no mobile, conecta o MindWave e recebe amostras raw; feature detecta plataforma sem suporte.

### #13 · Gateway WebSocket (API) + envio de raw autenticado
- **Escopo:** `WS /stream` autenticado por JWT; app envia blocos de raw; API cria `Session` e encaminha à Analysis.
- **Aceite:** stream autenticado cria sessão; sem token → recusa; teste com cliente WS simulado passa.

### #14 · Análise em streaming (features ao vivo)
- **Escopo:** Analysis processa janelas via `AnalysisEngine.process_window`; devolve `{quality, rel_alpha, ...}`; app mostra estado ao vivo.
- **Aceite:** com stream simulado (usar simulador do `wave_eeg`), o app exibe features atualizando; teste ponta a ponta.

---

## M4 — Análise & Dashboards

### #15 · Relatório por sessão (batch)
- **Escopo:** ao encerrar, `AnalysisEngine.process_session` gera `Result` (bandas, qualidade, alfa); grava `engine_version`.
- **Aceite:** sessão encerrada gera relatório persistido; endpoint REST retorna; teste passa.

### #16 · Dashboards (gráficos) por papel
- **Escopo:** paciente vê tendências pessoais; médico vê dashboards por paciente/sessão (biblioteca de gráficos).
- **Aceite:** gráficos renderizam a partir de `Result` real (de dados sintéticos/reais de teste), web e mobile.

### #17 · Integração real com o dispositivo ponta a ponta
- **Escopo:** capturar do MindWave → stream → análise → dashboard, numa única jornada.
- **Aceite:** demo real: coletar 60 s e ver features/relatório no app. (Sem claim clínica.)

---

## M5 — Polimento de UI
### #18 · Design system + identidade por papel
- **Escopo:** tema, componentes, tipografia; visual "bonito" distinto para paciente e médico; acessibilidade básica.
- **Aceite:** telas principais aplicam o design system; contraste/AA razoável; responsivo.

---

## Convenções de issue (cole em cada uma)
```
Título: <área>: <objetivo>
Contexto: (link ao doc/ADR relevante)
Escopo: (o que fazer, o que NÃO fazer)
Critérios de aceite: (checklist testável)
Testes: (o que deve ser coberto)
Dependências: (#issues)
Restrições: análise plugável; sem claim clínica; sem dado real; segredos fora do Git.
```

> **[RECOMENDAÇÃO]** Faça **um PR por issue**, pequeno e revisável. Não empilhe milestones. Cada merge deve manter o `main` sempre funcional (GitHub Flow, [doc 10](10_Git_Workflow.md)).

---

## #0 · Bootstrap do GitHub (rodar uma vez)
Cria automaticamente os 6 milestones (M0–M5) e as 18 issues:
```bash
gh auth login                          # se ainda não autenticado
bash infra/scripts/bootstrap_github.sh # dentro do repositório
```
Requer o **GitHub CLI** (`gh`). Milestones repetidos são ignorados; **não** rode as issues duas vezes (ou apague as duplicadas). Cada issue aponta para este documento (escopo/aceite/testes completos aqui).

---

## Atualização (2026-07-18) — segurança de #6/#7 (decidido)
- **#6 (hash de senha):** usar **Argon2id** (`argon2-cffi`) atrás de `PasswordHasher`; parâmetros OWASP (m=19 MiB, t=2, p=1). Ver **ADR-0020**.
- **#7 (JWT):** access **15 min** + refresh **7 dias** rotacionado e revogável; armazenamento por plataforma (mobile `expo-secure-store`; web cookie `httpOnly`); HS256 por env. Ver **ADR-0021**.

### Confirmações de #6/#7 (2026-07-18)
- **Revogação:** `token_version` no `User` (logout global) já na **#6**; tabela `RefreshToken` (rotação + **detecção de reuso** → revoga a família de tokens) na **#7**, com migration própria. ✔
- **Perfil:** apenas `display_name` — ver **ADR-0022** (minimização/LGPD). ✔
- **Migrations:** **não** auto-rodar no start do container; passo explícito `alembic upgrade head` (documentar; helper de dev opcional, ex.: alvo no Makefile/compose). ✔
- **E-mail:** normalizar (trim + lowercase) na borda + **constraint única** no valor normalizado; validar formato. ✔

### Confirmações de #7 (2026-07-18) — segurança operacional
- **Segredo JWT:** `WAVEAI_API_JWT_SECRET` sem default; a app não sobe se ausente/curto (≥ 32 bytes). Ver **ADR-0023**.
- **Reuse de refresh:** confirmado — reuso de um refresh já rotacionado revoga a **família inteira** do login (todos os descendentes), não só o token. Guardar **hash** do token + `family_id`/`jti` + `used_at`. (Detalha ADR-0021.)
- **Rate limiting:** **mínimo já na #7** (throttle por IP+e-mail ANTES do Argon2, erros genéricos, tempo uniforme); **completo na #19**. Ver ADR-0023.

### #19 · Endurecimento de auth (M1) — [novo]
- **Escopo:** lockout de conta; rate-limit distribuído (Redis); backoff/CAPTCHA; auditoria de falhas de login.
- **Depende de:** #7. **Ref.:** ADR-0023.
- **Aceite:** limiter compartilhado entre réplicas; bloqueio após N falhas; eventos de falha auditados.

### Notas para #8 (2026-07-18) — armazenamento de token por plataforma
- **Abstração `TokenStorage`** (capability por plataforma, como `DeviceConnection`):
  - **Mobile:** refresh em `expo-secure-store` (Keychain/Keystore); access em **memória**.
  - **Web:** refresh em **cookie `httpOnly`** setado pelo backend → o app **NÃO** guarda o refresh em JS (nem `localStorage`, nem storage algum); só mantém o access em memória. "Salvar refresh" no web é **no-op**; o navegador envia o cookie sozinho. Chamar o refresh com `credentials: 'include'`.
- **[RECOMENDAÇÃO] Deploy same-origin no MVP** (app web e API no mesmo domínio/proxy) para o cookie `httpOnly` funcionar simples. Com `SameSite=Lax/Strict` o **CSRF** fica mitigado. Se um dia for cross-site: `SameSite=None; Secure` + token anti-CSRF (double-submit) — deixar TODO, não implementar agora.
- **Validação:** caminho web verificável no navegador; mobile só por bundle (como na #4) — aceitável para o MVP.
- **#19** (endurecimento de auth) ainda não existe como issue no GitHub — **criar via `gh`** (o bootstrap gerou só as 18 originais).

### Notas para #9 (2026-07-18) — consentimento (ver ADR-0024)
- `CareLink` nasce **`pending`** (sem acesso a dado nenhum); vira **`active`** só após **ato explícito do paciente** (aceite ou iniciativa própria). RBAC a sessões/resultados exige `active`.
- Convite por e-mail: resposta **genérica idêntica** (anti-enumeração, como no login).
- **Revogação** por paciente **ou** médico a qualquer momento; efeito **imediato**; estado `revoked`; re-vínculo = novo consentimento.
- **Auditar** eventos de consentimento/revogação (quem, quando).
- **Aceite (testes):** médico com vínculo `pending` **não** acessa dados (403); acesso só com `active`; paciente revoga → acesso cortado imediatamente; convite **não** revela se o e-mail tem conta.
