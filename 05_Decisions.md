# 05 · Registro de Decisões (ADR Log) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo |
| Data | 2026-07-18 |

Registro cronológico de **Architecture Decision Records (ADRs)**. Formato: Contexto → Decisão → Alternativas → Consequências → Status. Nenhuma decisão técnica relevante deve ser tomada fora deste log.

Status possíveis: `Proposta` · `Aceita` · `Substituída` · `Revogada`.

---

## ADR-0001 — Natureza do produto: SaMD comercial
**Status:** Aceita (2026-07-18)
**Contexto:** Definir o posicionamento estratégico condiciona regulação, validação e rigor de engenharia.
**Decisão:** O WaveAI será um **produto comercial classificado como Software as a Medical Device (SaMD)**.
**Alternativas consideradas:**
- *Bem-estar/consumer* — menor barreira regulatória, porém não permite claims clínicas; conflita com a visão de apoio ao neurologista.
- *Pesquisa acadêmica* — rigor sem via comercial imediata.
- *Portfólio* — sem exigências regulatórias.
**Consequências:** Regulação (RDC 657/2022), gestão de risco (ISO 14971), ciclo de vida (IEC 62304) e QMS passam a ser pilares desde a Fase 0. Aumenta custo e prazo, mas habilita uso clínico legítimo.

## ADR-0002 — Jurisdição regulatória alvo: Brasil (ANVISA / LGPD)
**Status:** Aceita (2026-07-18)
**Contexto:** É preciso um referencial regulatório para desenhar conformidade.
**Decisão:** **Brasil** como mercado primário — ANVISA (RDC 657/2022, RDC 751/2022) e LGPD.
**Alternativas consideradas:** EUA (FDA/HIPAA), Europa (MDR/GDPR), Global.
**Consequências:** Arquitetura de dados orientada à LGPD (dado sensível, art. 11); dossiê e classificação segundo ANVISA. **[RECOMENDAÇÃO]** manter a arquitetura *portável* para futura expansão (FDA/MDR) sem retrabalho estrutural.

## ADR-0003 — Recursos: time pequeno (2–5)
**Status:** Aceita (2026-07-18)
**Contexto:** Dimensionar o roadmap ao realismo do time.
**Decisão:** Planejar para um **time pequeno multidisciplinar (2–5 pessoas)**.
**Consequências:** Priorizar escopo enxuto, reuso, serviços gerenciados e automação. Evitar complexidade distribuída prematura. Sequenciar frentes em vez de paralelizar tudo.

## ADR-0004 — Abordagem documental: docs-as-code, popular + expandir
**Status:** Aceita (2026-07-18)
**Contexto:** O projeto exige base documental sólida antes do código.
**Decisão:** Adotar **documentação-como-código** (Markdown versionado), populando os documentos fundacionais (01–09) e expandindo a taxonomia por domínio (ver [Documentation/00_Documentation_Index](Documentation/00_Documentation_Index.md)).
**Consequências:** Rastreabilidade e revisão via histórico; decisões registradas em ADR; RFCs para mudanças relevantes.

---

## Decisões pendentes (a virar ADR quando maduras)

| Futuro ADR | Tema | Depende de | Prioridade |
|---|---|---|---|
| ADR-0005 | Processamento **edge vs nuvem** | Q-TEC-01, estudo de latência | P0 |
| ADR-0006 | Stack **mobile** (React Native × Flutter × nativo) | Q-TEC-03, teste de SDK NeuroSky | P1 |
| ADR-0007 | **Banco de série temporal** e retenção | Q-TEC-04 | P1 |
| ADR-0008 | Provedor de **nuvem** e região (LGPD) | Q-LGP-01, ADR-0002 | P0 |
| ADR-0009 | Abordagem inicial de **IA** (heurística DSP × ML) | Q-AI-02, dados disponíveis | P1 |
| ADR-0010 | Estratégia de **on-ramp de bem-estar** | Q-REG-03 | P0 |
| ADR-0011 | **Arquitetura de streaming** (WebSocket × MQTT × Kafka) | Q-TEC-01/02 | P1 |

> **[RECOMENDAÇÃO]** Não promover nenhuma decisão pendente a "Aceita" antes de a pergunta em aberto correspondente estar resolvida com evidência — coerente com o princípio de não implementar o que não está suficientemente especificado.

---

## ADR-0012 — Estratégia regulatória faseada (protótipo não-clínico agora, SaMD depois)
**Status:** Aceita (2026-07-18)
**Contexto:** O fundador definiu a claim de forma genérica para evitar responsabilidade diagnóstica e informou **não haver neurologista consultor**, desejando evoluir tecnicamente sem validação clínica contínua. Isso é **incompatível** com operar como SaMD comercial *agora* (SaMD exige validação clínica).
**Decisão:** Operar a **fase atual como protótipo de pesquisa / ferramenta de bem-estar não-clínica e não-diagnóstica**, adotando a Declaração de Uso Pretendido de [Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md); manter **SaMD como destino de longo prazo** (pós-investimento, com neurologista e QMS).
**Alternativas:** (a) manter SaMD desde já — inviável sem neurologista/validação; (b) manter claim genérica sem reposicionar — pior dos mundos (finalidade médica + ambiguidade).
**Consequências:** Reduz risco regulatório imediato; permite progresso técnico solo; exige disciplina de comunicação (guarda-corpos de marketing/UX). **Refina ADR-0001**, que passa a ser alvo de longo prazo, não modo de operação atual. Cria Q-REG-05.

---

## ADR-0013 — Estratégia de captação de sinal (estudo) + camada de abstração de dispositivo
**Status:** Aceita (2026-07-18)
**Contexto:** Necessário ler o raw 512 Hz do MindWave Mobile 2 para o estudo de fidelidade (Q-TEC-05). Quatro opções avaliadas em [Architecture/21](Architecture/21_NeuroSky_Integration_and_Capture.md). Fato verificado: o aparelho é dual-mode (SPP para PC/Mac/Android, BLE/GATT para iOS) — iOS não é bloqueio.
**Decisão:** Para a **captação do estudo (PC/Mac, em Python)**: abordagem **híbrida** — (1) *bootstrap* rápido com TGC + biblioteca Python (NeuroPy/pyThinkGear) para validar a malha; (2) **parser direto do protocolo ThinkGear (pyserial)** como fundação durável. Tudo atrás de uma interface **`DeviceReader`** (anti-corrupção). Captação do estudo **desacoplada** do stack do produto.
**Alternativas:** só TGC (desktop/antigo, libs sem manutenção); só parser direto (mais trabalho inicial).
**Consequências:** Destrava o estudo de fidelidade; reduz dependência de libs não mantidas; reusa conhecimento de protocolo para o produto. **Não** decide a captação móvel do produto (fica em ADR-0006, agora informada pelos fatos de Bluetooth). Cria riscos R-09/R-10/R-11/R-12 (ver Architecture/21).

---

## ADR-0014 — Estrutura de repositório: monorepo
**Status:** Aceita (2026-07-18)
**Contexto:** Início da codificação, atrelada ao GitHub `WaveAI-Company/WaveAi-Company`. Time pequeno; necessidade de versionar documentação e código de forma rastreável.
**Decisão:** **Monorepo** — documentação (núcleo + disciplinas) e código no mesmo repositório. Código do spike em `experiments/eeg-capture-spike/`; futuros `app/`, `backend/` etc. no mesmo repo.
**Alternativas:** multi-repo (mais isolamento, mais overhead p/ time pequeno); só-código (docs fora do Git — perde rastreabilidade conjunta).
**Consequências:** rastreabilidade única de docs+código+decisões; CI no mesmo repo. Crescimento futuro pode motivar mover docs para `docs/` (opcional, não bloqueante).

## ADR-0015 — Modelo de branches: GitHub Flow
**Status:** Aceita (2026-07-18)
**Contexto:** Boas práticas de branch para um time de 2–5 pessoas.
**Decisão:** **GitHub Flow** — `main` protegida e sempre implantável; branches curtas por tarefa; **Pull Request** com **CI obrigatório**; Conventional Commits. Guia e comandos em [Documentation/10_Git_Workflow](Documentation/10_Git_Workflow.md).
**Alternativas:** Git Flow (cerimônia desnecessária nesta fase); trunk-based (exige CI/feature flags maduros).
**Consequências:** fluxo leve e revisável; exige proteção de `main` e CI verde. Mudanças estruturais entram como RFC antes de virar ADR.

---

## ADR-0016 — Cliente: app universal React (Expo) para web + mobile, ambos os papéis
**Status:** Aceita (2026-07-18)
**Contexto:** O produto deve funcionar em **web e mobile**, para **médico e paciente**, com máximo reuso de React.
**Decisão:** Um **app Expo (React Native + React Native Web)** único → iOS/Android/Web, com UI condicionada ao papel. Captura de EEG é *capability* por plataforma (mobile via módulo nativo BLE/SPP; web sem suporte exibe aviso).
**Alternativas:** Next.js (web) + Expo (mobile) separados com pacotes compartilhados — mais controle na web, porém mais código/coordenação.
**Consequências:** um só codebase e time; dashboards ricos exigem cuidado no RN Web. Ref.: [Architecture/22](Architecture/22_MVP_Platform_Architecture.md).

## ADR-0017 — Execução da análise: no servidor
**Status:** Aceita (2026-07-18)
**Contexto:** Onde roda o DSP/ML: no app (edge) ou no servidor.
**Decisão (recomendada):** **No servidor.** O app envia o raw (~1 KB/s) por WebSocket; o serviço Python (reusa `wave_eeg` atrás de `AnalysisEngine`) processa e devolve. Centraliza, torna atualizável sem republicar o app e rastreável.
**Alternativas:** edge (offline/baixa latência, mas reescrever DSP em JS e difícil evoluir); híbrido (qualidade no edge, DSP no servidor) — futuro.
**Consequências:** exige conectividade para a análise ao vivo; histórico funciona offline.

## ADR-0018 — Backend/Auth: FastAPI + JWT + PostgreSQL
**Status:** Aceita (2026-07-18)
**Decisão (recomendada):** **FastAPI + JWT** (papéis paciente/médico), PostgreSQL. Mesma linguagem da análise; reusa o ecossistema Python.
**Alternativas:** BaaS gerenciado (Supabase/Firebase) — muito menos código, menos controle, outra stack; Node/NestJS — TS alinhado ao front, separa do Python.
**Consequências:** mais código de auth para manter, em troca de controle e coerência.

## ADR-0019 — Transporte: WebSocket (ao vivo) + REST
**Status:** Aceita (2026-07-18)
**Decisão (recomendada):** **WebSocket** para o stream ao vivo (raw → features) e **REST** para auth, CRUD e relatórios de sessão.
**Alternativas:** só REST (upload de sessão + relatório assíncrono) — mais simples, sem "ao vivo".
**Consequências:** duas superfícies (WS+REST) para manter; melhor experiência ao vivo.

---

## ADR-0020 — Hashing de senha: Argon2id
**Status:** Aceita (2026-07-18)
**Contexto:** As issues #6/#7 introduzem credenciais. A escolha do algoritmo de hash de senha é decisão de segurança e deve ficar em ADR, não enterrada num commit.
**Decisão:** **Argon2id** (lib `argon2-cffi` no FastAPI), atrás de uma interface `PasswordHasher` (permite trocar de algoritmo no futuro e suportar `needs_rehash`). Parâmetros conforme **OWASP Password Storage**: mínimo **m=19 MiB, t=2, p=1** (alternativa: m=46 MiB, t=1, p=1); usar os defaults mantidos pela lib e permitir ajuste por variável de ambiente. Nunca armazenar a senha — o hash do Argon2 já embute salt e parâmetros.
**Alternativas:** **bcrypt** (aceitável, porém OWASP o reserva a sistemas legados; limite de 72 bytes exige pré-hash de senhas longas); **scrypt**; **PBKDF2** (mais frágil a GPU). Argon2id venceu a Password Hashing Competition e é a recomendação atual.
**Consequências:** dependência `argon2-cffi`; custo de CPU/memória por login (aceitável e desejável). Implementar `check_needs_rehash` para futuros upgrades de parâmetros.

## ADR-0021 — Política de tokens (JWT): TTL, rotação, revogação e armazenamento
**Status:** Aceita (2026-07-18)
**Contexto:** Definir tempo de vida dos tokens e onde o app (Expo universal) os persiste — decisão de segurança referenciada por #7 e #8.
**Decisão:**
- **Access token** JWT **curto: 15 min**; claims mínimas (`sub`, `role`, `exp`, `jti`); assinatura **HS256** com segredo forte via env (MVP mono-serviço; migrar para RS256 se vários serviços passarem a validar).
- **Refresh token: 7 dias**, **rotacionado a cada uso** e **revogável** (guardar hash/`jti` no banco, ou `token_version` por usuário; logout invalida). 
- **Armazenamento no cliente:** **Mobile** → `expo-secure-store` (Keychain iOS / Keystore Android) para o refresh, access em memória. **Web** → refresh em **cookie `httpOnly` + `Secure` + `SameSite`** (inacessível a JS, mitiga roubo por XSS), access em memória. **Nunca** tokens em `localStorage`.
- **Não** colocar dado sensível no payload do JWT (é apenas base64, legível).
**Alternativas:** access longo sem refresh (sem revogação — pior); tokens em `localStorage` (vulnerável a XSS); tokens opacos + sessão no servidor (mais estado; reconsiderar em escala).
**Consequências:** backend ganha endpoints de refresh + revogação; o cliente trata persistência **por plataforma** (nuance do app universal). Segredos e rotação de chave via env/secret manager.

---

## ADR-0022 — Minimização de dados de perfil (LGPD)
**Status:** Aceita (2026-07-18)
**Contexto:** Ao modelar o usuário (#6) surge a tentação de adicionar campos de perfil (CRM, data de nascimento, condição de saúde). São dados pessoais — alguns **sensíveis** — e decisões de produto, não de implementação.
**Decisão:** Perfis **minimalistas**: apenas `display_name` (além de email, role e credenciais). **Não** coletar CRM, data de nascimento, condição de saúde ou qualquer dado sensível nesta fase. A **verificação profissional do médico** (ex.: CRM + validação) é **feature futura**, com issue e finalidade próprias quando o produto exigir.
**Alternativas:** coletar campos "por precaução" — rejeitado: viola a **minimização** da LGPD, cria dado sensível sem finalidade e é decisão de produto não especificada.
**Consequências:** menor superfície de dados pessoais e menor risco. Quando um campo for necessário, entra com **finalidade explícita** e, se sensível, base legal/consentimento. Coerente com [Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md) (não-clínico) e com o princípio de o coder não inventar produto.

---

## ADR-0023 — Endurecimento do login: segredo fail-closed + rate limiting
**Status:** Aceita (2026-07-18)
**Contexto:** O login combina Argon2id (caro por design, ~19 MiB/tentativa) e JWT assinado. Dois riscos operacionais não cobertos: (a) segredo de assinatura fraco/ausente; (b) tentativas de login sem limite → força bruta online **e** DoS por amplificação do hash.
**Decisão:**
- **Segredo JWT fail-closed:** `WAVEAI_API_JWT_SECRET` via env, **sem default**, validado no carregamento da config (Pydantic Settings). A app **recusa iniciar** se ausente/vazio ou abaixo do mínimo (**≥ 32 bytes**). Exigido em **todos** os ambientes (dev via `.env`/`.env.example` com `openssl rand -hex 32`; prod via secret manager; testes definem segredo de teste explícito). O que muda por ambiente é a **origem** do segredo, nunca a exigência.
- **Rate limiting no login (mínimo já na #7):** limitar tentativas por **(IP + e-mail)** e por IP (janela deslizante/token bucket), com **throttle ANTES** de executar o Argon2 (não deixar o atacante forçar o hash caro). Erros **genéricos** e tempo de resposta **uniforme** (anti-enumeração de usuários). In-memory no MVP mono-instância; **migrar para Redis** ao escalar réplicas (limitação conhecida).
- **Endurecimento completo → issue #19 (M1):** lockout de conta, limiter distribuído (Redis), backoff/CAPTCHA, auditoria de falhas.
**Alternativas:** adiar todo rate-limit (rejeitado — expõe DoS/brute-force desde o 1º dia); default de segredo "para facilitar o dev" (rejeitado — é assim que chaves vazam).
**Consequências:** login robusto desde o MVP. Reforça ADR-0021 (JWT) e ADR-0020 (Argon2id). O limiter in-memory não compartilha estado entre réplicas até o #19.

---

## ADR-0024 — Consentimento e ciclo de vida do vínculo médico-paciente (CareLink)
**Status:** Aceita (2026-07-18)
**Contexto:** A #9 cria `CareLink(doctor, patient, status)`. Dados de EEG/saúde são **sensíveis** (LGPD art. 11); o acesso de um profissional aos dados de uma pessoa precisa de base legal — na nossa arquitetura, o **consentimento explícito do titular**. É a decisão de maior consequência regulatória do MVP.
**Decisão:**
- **Consent-first:** o vínculo nasce **`pending`** e **não concede acesso a nenhum dado**. O acesso (RBAC a sessões/resultados) só existe com o vínculo **`active`**, o que exige um **ato explícito do paciente** (aceitar o convite do médico, **ou** o próprio paciente iniciar o vínculo). **Invariante: nenhum acesso aos dados de um paciente sem um ato de autorização desse paciente** — enforçado na **camada de autorização**, não só na UI.
- **Convite à prova de enumeração:** convidar por e-mail retorna resposta **genérica e idêntica** ("solicitação registrada"), exista ou não a conta (mesmo vetor da ADR-0023). A aceitação aparece depois, pela mudança de status do vínculo — não pela resposta ao convite.
- **Revogação bilateral, a qualquer momento:** paciente **e** médico podem encerrar. Para o paciente é **exercício de direito sobre os próprios dados (LGPD)**, não cortesia: efeito **imediato** (acesso cortado na hora), estado vira `revoked`. Re-vincular exige **novo ciclo de consentimento** (pending→active), sem reativação silenciosa.
- **Auditoria:** registrar eventos de consentimento e revogação (quem, quando) — é o registro que sustenta a base legal.
**Alternativas:** vínculo **ativo na criação** (acesso unilateral do médico) — **rejeitado**: processa dado sensível sem base legal válida, viola autonomia e contradiz [Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md).
**Consequências:** fluxo de convite/aceite no app (#10/#11) e RBAC condicionado a `active`. Semente para um futuro doc de **Consentimento & Direitos do Titular** (escopo, expiração, exclusão/portabilidade). Relaciona ADR-0023, [Medical/70](Medical/70_Regulatory_Clinical_Strategy.md) (LGPD) e Medical/71.

---

## ADR-0025 — Autenticação do WebSocket via primeira mensagem
**Status:** Aceita (2026-07-18)
**Contexto:** O `WS /stream` (#13) precisa autenticar sem vazar credencial. Navegadores **não** permitem cabeçalho custom em WebSocket; `?token=` na URL vaza em logs de servidor, proxy e histórico.
**Decisão:** Autenticar por **primeira mensagem** `{"type":"auth","token":"<access JWT>"}` logo após o handshake, com **timeout de 10 s** (fecha conexão anônima pendurada, com close code de aplicação). **Nenhum frame de dados é processado antes do auth.** Validar o access token (ADR-0021): assinatura, expiração, papel. **Vincular a `CaptureSession` ao usuário autenticado** (o paciente transmite o **próprio** sinal). `wss://` (TLS) obrigatório.
**Alternativas:** `?token=` na URL (vaza — rejeitado); subprotocolo `Sec-WebSocket-Protocol` (hack, também pode ser logado); cookie httpOnly no handshake (funciona no web same-origin, mas **não** no mobile — inconsistente). A primeira-mensagem é a única **portável** web+mobile e sem vazamento.
**Consequências:** o cliente envia auth antes de transmitir; a expiração do access token no meio de uma captura longa fica como **TODO** (capturas do MVP são curtas; re-auth futura). Reforça ADR-0021/0023.

---

## ADR-0026 — Persistência de dados biométricos derivados (Result) sob LGPD
**Status:** Aceita (2026-07-18)
**Contexto:** A **#15** é o marco em que o sistema passa a **persistir dados derivados de uma pessoa real** (features de EEG: bandas, `rel_alpha`, qualidade, verdict + `engine_version` + vínculo ao usuário). Até aqui **nada biométrico foi gravado**. Isso torna as obrigações da LGPD **concretas**, não mais hipotéticas.
**Decisão:**
- **O que persiste:** apenas o **`Result`** (features derivadas + `engine_version` + metadados de sessão), vinculado ao paciente. **Raw não** (ADR-0025). Dados derivados de EEG são tratados com o **padrão de dado sensível** (cautela máxima), mesmo no enquadramento não-clínico ([Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md)).
- **Base legal / consentimento:** o paciente captura o **próprio** dado (serviço que contratou) + **consentimento informado** no cadastro/captura. Acesso do médico só com CareLink `active` (ADR-0024).
- **Cifragem em repouso** do armazenamento de `Result`.
- **Direitos do titular** suportados desde já: **acesso, exportação (portabilidade) e exclusão (erasure)** — o schema deve permitir apagar/anonimizar **todos** os `Result` de um usuário.
- **Retenção:** definir política (mínimo: manter até o titular excluir) e registrar.
- **Auditoria** de acesso a `Result` (quem leu o quê) — estende ADR-0024.
- **[GATE de produção]** Nenhum dado derivado de **pessoa real** é persistido em produção até: (a) **consentimento informado** no fluxo e (b) **direitos de acesso/exclusão/exportação** implementados. Em dev/test, **apenas dados sintéticos** (regra do `CLAUDE.md` permanece).
**Alternativas:** persistir sem cifragem/direitos "para ir rápido" — **rejeitado** (dado biométrico sem salvaguardas); guardar raw — fora de escopo (ADR-0025).
**Consequências:** a #15 ganha requisitos de cifragem, consentimento e direitos; nasce [Medical/72](Medical/72_Consent_and_Data_Subject_Rights.md). Relaciona ADR-0017, 0024, 0025, [Medical/70](Medical/70_Regulatory_Clinical_Strategy.md)/71.
