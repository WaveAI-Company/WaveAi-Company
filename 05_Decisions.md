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

## ADR-0009 — Abordagem inicial de IA: heurística DSP + estatística; transfer learning de EEG parqueado sob gatilho
**Status:** Aceita (2026-07-26)
**Contexto:** Resolve **Q-AI-02** (heurística DSP × ML) e relaciona **Q-AI-01** (dados rotulados). O pipeline hoje é 100% **DSP transparente + estatística**: Catálogo de Features N2 ([DataScience/32](DataScience/32_Feature_Catalog.md)), qualidade (**ADR-0031**), baseline pessoal + desvio N σ (**ADR-0032**) e tendências longitudinais (N5). O fundador levantou se **importar modelos de EEG pré-treinados** (transfer learning) já ajudaria.

**[FATO] Não faz sentido agora — e não por ser prematuro, mas por razões concretas:** (1) **montagem** — modelos pré-treinados de EEG exploram **estrutura espacial multicanal**; nós somos **1 canal (FP1)**, então a maior parte do que eles codificam não se aplica; (2) transfer learning **reduz mas não elimina** a necessidade de **dado rotulado do nosso domínio** (consumo seco FP1, o gap que o Exp. D expôs) — **Q-AI-01 segue aberta**; (3) é **caixa-preta** e briga com o **XAI** que o médico precisa (caberia só como sinal secundário rotulado, nos termos da **ADR-0034**); (4) **não há tarefa supervisionada definida** (não classificamos diagnóstico — Medical/71).

**Decisão:** abordagem inicial = **heurística de DSP + estatística** (baselines pessoais, tendências). **ML / transfer learning de EEG fica parqueado** e **reentra sob QUALQUER gatilho:**
- **(A)** upgrade para **multicanal** (ex.: Muse 2 — forward-proofing da **ADR-0033**): aí features espaciais + ICA entram e modelos channel-agnostic passam a fazer sentido;
- **(B)** existir **dado rotulado do nosso domínio** (Q-AI-01 resolvida, com protocolo + base legal — Q-ETH-01);
- **(C)** haver uma **tarefa supervisionada concreta** com benchmark para superar as features transparentes.

Quando reentrar, **pluga atrás do `AnalysisEngine`** (novo `engine_version`), como sinal **explicável** ou **secundário rotulado** — nunca fundamento opaco de claim. Nota útil: já fazemos a **transferência que cabe em 1 canal** — transferir **conhecimento da literatura** (Berger, bandas, assinaturas de artefato do Exp. D) para features desenhadas à mão.
**Alternativas consideradas:** (a) **adotar transfer learning já** — rejeitada (montagem + dado + caixa-preta); (b) **descartar ML de vez** — rejeitada: o gatilho multicanal é real e **parquear custa zero** (já é plugável).
**Consequências:** **nenhuma mudança no plano atual**; a arquitetura (`AnalysisEngine`, corpus de pesquisa N4, forward-proofing multicanal) já acomoda a reentrada. Resolve **Q-AI-02**; **Q-AI-01** permanece aberta como pré-condição. Relaciona ADR-0033, ADR-0034, [DataScience/30](DataScience/30_EEG_Signal_Processing_Strategy.md) e a **ADR-0035** (camada de linguagem).

---

## Decisões pendentes (a virar ADR quando maduras)

| Futuro ADR | Tema | Depende de | Prioridade |
|---|---|---|---|
| ADR-0005 | Processamento **edge vs nuvem** | Q-TEC-01, estudo de latência | P0 |
| ADR-0006 | Stack **mobile** (React Native × Flutter × nativo) | Q-TEC-03, teste de SDK NeuroSky | P1 |
| ADR-0007 | **Banco de série temporal** e retenção | Q-TEC-04 | P1 |
| ADR-0008 | Provedor de **nuvem** e região (LGPD) | Q-LGP-01, ADR-0002 | P0 |
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

**[Adendo 2026-07-20 — #29] Estado `declined` fecha o ciclo.** O CareLink ganhou o estado terminal **`declined`** (o paciente **recusa** um convite `pending`), ao lado de `revoked`. Como o revogado, ele **não concede acesso** e é **terminal** — re-convidar cria uma linha nova (novo consentimento), nunca reativa. O índice parcial de "vínculo vivo" passou a excluir `revoked` **e** `declined` (recusar não pode travar um re-convite), e a listagem esconde ambos (a recusa não vira um "carimbo" que exponha a decisão do paciente ao médico). Só o paciente recusa (como só ele aceita); a recusa é auditada. Ciclo completo: `pending → active | declined`; `active → revoked`.

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

**[Adendo 2026-07-20 — #29] Consentimento informado versionado + gate destravado.** O consentimento passou de um simples carimbo de data (`consent_given_at`, semente da #15) para **informado e versionado**: registra-se **qual termo** o titular aceitou (`consent_version`), não só quando (Medical/72 §2). O **backend é a fonte da versão vigente**; o app envia a versão que exibiu e a API **recusa (409)** um aceite a termo desatualizado — consentir a um texto que já mudou não é informado. A UI do termo (o que é guardado, para quê, retenção, quem acessa, direitos) é a tela `patient/consent`. Com a #29, os dois requisitos do **[GATE de produção]** estão satisfeitos — **consentimento informado no fluxo** (b) direitos já entregues na #15 —, então a persistência de dado de pessoa real pode ser habilitada em produção (a regra de dev/test com **só sintético** permanece).

---

## ADR-0027 — Gráficos no app: `react-native-svg` + componentes próprios
**Status:** Aceita (2026-07-21)
**Contexto:** A **#16** (dashboards por papel) exige gráficos no app **universal** (iOS/Android/Web via Expo, ADR-0016). O `package.json` não tinha nenhuma biblioteca de gráficos, e a escolha condiciona bundle, portabilidade e liberdade visual — decisão técnica relevante, logo entra no log.
**Decisão:** Usar **`react-native-svg`** (parte do SDK do Expo, funciona nas três plataformas) e escrever **componentes de gráfico próprios** (`TrendChart`, `BandBars`, `SignalQuality`), em vez de adotar uma biblioteca de charting pronta. Barras proporcionais são feitas com `View`s e flex — é problema de **layout**, não de geometria —, ficando responsivas sem medir nada; o SVG entra onde há geometria real (a linha de tendência).
**Alternativas consideradas:**
- **`react-native-gifted-charts`** — menos código a escrever, porém API e estilo de terceiros, mais superfície de dependência e ajustes para casar com o tema escuro.
- **`victory-native`** — ecossistema maduro e API compartilhada com a web, mas pesado; a linha XL depende de **Skia**, que complica o alvo web do Expo.
**Consequências:** uma única dependência bem suportada, controle total do visual (o design system é a #18) e nenhuma surpresa cross-platform — ao custo de manter ~200 linhas de componentes de gráfico. Se a necessidade de gráficos crescer muito (zoom, interação, muitas séries), reavaliar uma biblioteca é um passo natural, sem retrabalho de dados.

**[Adendo 2026-07-21 — #17] Revertido: saímos do `react-native-svg`.** A dependência **nativa** cobrou um preço que a #16 não previu, porque a #16 foi verificada **só no navegador** — onde o React Native Web renderiza SVG em JavaScript e dispensa código nativo. No aparelho, o development client era anterior à dependência e a tela de histórico quebrava com `IllegalViewOperationException: Can't find ViewManager`. Módulo nativo não entra por *hot reload*: exige recompilar o app.

Recompilar, por sua vez, esbarrou num problema de ambiente da máquina de desenvolvimento (o Gradle falha ao abrir um seletor NIO: `SocketException: Invalid argument` em `sun.nio.ch.UnixDomainSockets`, dentro de `PipeImpl`). Ou seja: um gráfico de linha simples passou a bloquear a entrega.

**Decisão:** o `TrendChart` foi reescrito com **`View`s**, como as barras já eram — cada segmento é um retângulo fino rotacionado entre dois pontos. O `react-native-svg` **saiu do projeto**. O resultado visual é indistinguível no tamanho em que usamos, funciona no build atual do aparelho (verificado) e o app volta a não ter dependência nativa além do Bluetooth.

**O que isto ensina, e vale como regra:** toda dependência **nativa** precisa de uma passada em **build de dispositivo** antes de ser considerada verificada — navegador não prova nada sobre ela. E, para um desenho simples, `View`s valem mais que uma dependência nativa: o custo dela não é o bundle, é o acoplamento ao ciclo de build.

**Nota de honestidade visual (vale para todo gráfico do produto):** a escala do eixo y é automática **com mínimo e máximo rotulados** — sem os rótulos, uma variação minúscula pareceria dramática. E `SignalQuality` mostra os valores medidos **sem veredito**: o que conta como sinal "bom o suficiente" segue indefinido (**Q-TEC-06**), então a UI não inventa faixa "boa/ruim". Coerente com [Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md) (não-clínico) e com a regra de o coder não decidir parâmetro clínico.

---

## ADR-0028 — Autocaptação do desenvolvedor em desenvolvimento (exceção estreita à regra de "sem dado real")
**Status:** Aceita (2026-07-21)
**Contexto:** A **#17** exige uma demonstração **real** ponta a ponta: captar do MindWave, transmitir, analisar e ver o relatório. Isso colide de frente com uma **regra rígida** do `CLAUDE.md` ("**sem dado real de pessoa** em testes/dev") e com o gate do **ADR-0026** ("em dev/test, **apenas dados sintéticos**"). A colisão é real e não pode ser resolvida no silêncio de um commit: EEG é dado biométrico, tratado aqui com padrão de **dado sensível**.
**Decisão:** Permitir uma exceção **estreita e nomeada**: o **próprio desenvolvedor/fundador**, atuando como **titular do dado**, pode captar o **seu próprio** sinal e persistir o `Result` derivado em **ambiente local de desenvolvimento**, sob todas as condições abaixo — que são cumulativas, não alternativas:

1. **Titular = operador.** Só o próprio sinal de quem opera. Captar terceiros (amigos, familiares, voluntários) **continua proibido** e exigiria protocolo próprio, base legal e nova decisão.
2. **Consentimento pelo fluxo real.** O consentimento informado versionado (#29) é exercido **no app**, como qualquer usuário — não por atalho no banco. É o mesmo gate do ADR-0026, não uma exceção a ele.
3. **Só banco local e descartável.** Nunca em ambiente compartilhado, nunca em produção. O dado **não** é commitado, exportado para o repositório, nem vira *fixture*.
4. **Fixtures e seeds seguem 100% sintéticos.** Nenhum dado de autocaptação alimenta teste automatizado ou o `seed_dev` — a regra do `CLAUDE.md` permanece **intacta** para tudo que é versionado.
5. **Direito de exclusão à mão.** `DELETE /me/results` apaga tudo; o `Result` é cifrado em repouso como qualquer outro.
6. **Raw continua não persistido** (ADR-0025): mesmo na captação real, só o derivado é gravado.

**Alternativas consideradas:**
- **Demo real sem persistir** (`result_persistence_enabled=false`): honraria a regra ao pé da letra e ainda mostraria o relatório — viável justamente porque o `_stop` passou a devolver o conteúdo (#17). **Rejeitada** por não exercitar o trecho final da jornada (aparecer no histórico/dashboard), que é o que a #17 pede.
- **Só sintético, sem aparelho:** a #17 ficaria tecnicamente pronta e **factualmente não demonstrada** — o risco que a issue existe para eliminar.

**Consequências:** o `CLAUDE.md` passa a apontar para esta ADR, para que a regra e a exceção não se contradigam em leituras futuras. A exceção é **de desenvolvimento**, não de produto: qualquer captação de terceiro, ou qualquer uso fora do ambiente local, volta a cair na regra geral e exige nova decisão. Relaciona ADR-0024, 0025, 0026 e [Medical/72](Medical/72_Consent_and_Data_Subject_Rights.md).

---

## ADR-0029 — Design system: tokens semânticos, dois temas e sotaque por papel
**Status:** Aceita (2026-07-21)
**Contexto:** A **#18** pede identidade visual por papel, acessibilidade básica e consistência. O que existia era um `theme.ts` com cores literais que cada tela consumia à mão, e a divergência já era visível: três tamanhos de fonte diferentes para o mesmo nível de título, e **três redações distintas** do aviso não-clínico — que é regra rígida de posicionamento ([Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md)), não texto de UI.
**Decisão:**
- **Tokens semânticos** (`text`, `surface`, `accent`…), nunca hex em tela, resolvidos em tempo de execução por `useTheme()`. É o que permite dois temas sem duplicar tela.
- **Tema claro e escuro seguindo o sistema.** As cores de destaque **mudam entre os temas**: o turquesa que rende 10:1 sobre o fundo escuro cai para ~1,8:1 sobre branco, ilegível como texto. Cada tema tem seu par `accentX` (preenchimento) e `accentXText` (texto).
- **Sotaque por papel sobre base comum:** mesma tipografia, espaçamento e componentes; muda a cor de destaque (`useRoleAccent()`), derivada do papel de quem está logado. Um sistema só para manter.
- **Fontes do sistema, sem `expo-font`.** Fonte customizada é dependência **nativa**, e a #17 mostrou o custo disso: quebra no aparelho até recompilar o app, e o build local pode simplesmente não funcionar. Identidade vem de escala, peso e ritmo.
- **Contraste verificado por script** (`npm run check:contrast`), rodando **no CI**. "AA razoável" deixa de ser opinião.
- **Aviso não-clínico vira componente** (`<Disclaimer>`), com as redações centralizadas: não pode divergir nem sumir de uma tela por descuido.
- **Seletor de tema no app** (Sistema / Claro / Escuro), com **Sistema como padrão**. Motivo concreto: o `userInterfaceStyle` do Expo é resolvido em **tempo de build** e, no Android, exige `expo-system-ui` — outra dependência nativa. O `app.json` estava com `"light"`, o que **travava o app em claro no aparelho** por mais que o sistema mudasse (comprovado por teste no dispositivo). A config foi corrigida para `"automatic"`, mas só vale no próximo build; o seletor é **puro JavaScript** e funciona em qualquer build já instalado. A preferência persiste (secure-store no mobile, `localStorage` no web — aceitável aqui, ao contrário de token, que é proibido guardar assim).
**Alternativas:** identidades bem distintas por papel (dobraria variações a manter); só tema escuro (menor escopo, mas o claro é expectativa básica hoje); fonte customizada (rejeitada pelo custo nativo acima); depender só do `userInterfaceStyle` (deixaria o tema escuro inalcançável no aparelho até um rebuild que hoje está bloqueado).
**Consequências:** um bug real de acessibilidade foi encontrado e corrigido — botões secundários pintavam texto escuro sobre fundo escuro (**1,42:1**, ilegível); agora a variante decide fundo e texto **juntos**, tornando o erro impossível. Bordas de controle passaram a exigir 3:1 (WCAG 1.4.11). Toda tela consome tokens, então mudar a paleta é mudança de um arquivo.

---

## ADR-0030 — Armazenamento de dados de pesquisa (corpus separado, raw + janelas, versionado)
**Status:** Aceita (2026-07-21)
**Contexto:** A Fase 2 (Análise & Ciência, [Documentation/13](Documentation/13_Analysis_Phase_Work_Breakdown.md), decisão de kickoff **D1**) precisa **reprocessar** o sinal, **comparar engines** e **treinar/validar** detectores. Isso colide com a arquitetura de produção, que por decisão explícita **não persiste o raw** (ADR-0025) e guarda apenas o `Result` cifrado (ADR-0026). **[FATO]** features derivadas não bastam para ciência: sem o sinal bruto (ou ao menos as janelas), não há como reexecutar um pipeline diferente sobre o mesmo dado. Reabre Q-TEC-04 e revisita ADR-0005/0025/0026.
**Decisão:**
- **Corpus de pesquisa fisicamente separado do banco de produção** — versionado, cifrado, alimentado **exclusivamente** por dados **sintéticos** e pela **autocaptação do desenvolvedor** (ADR-0028). **Nunca** recebe dado de terceiro sem novo protocolo e base legal. Não altera ADR-0025, que continua regendo produção (lá, raw segue não persistido).
- **Escopo do dado guardado:** **raw completo (512 Hz) + janelas/épocas + features**, para permitir qualquer reprocessamento. Raw vive só no corpus de pesquisa.
- **Substrato físico:** **arquivos Parquet content-addressed** (em disco/objeto) para raw e janelas; **Postgres apenas como índice/metadados** (sessão, device, montagem, condição experimental, ponteiros de arquivo). Timescale e tabela particionada foram consideradas **prematuras** para o N pequeno atual.
- **Versionamento e reprodutibilidade (mínimo aceitável):** todo resultado deve amarrar **(a) commit Git do código, (b) identificador imutável do dataset (versão DVC), (c) versão do modelo gerado e (d) hiperparâmetros de treinamento.** Ferramenta: **Git + DVC** para datasets e artefatos de modelo.
**Alternativas consideradas:**
- *Guardar só janelas+features (sem raw):* mais leve e menos sensível, mas **impede** trocar o pré-processamento (filtro/notch/epoching) — justamente o que a ciência precisa variar. Rejeitada.
- *Timescale desde já:* bom para série temporal em escala, **overkill** para N=1 exploratório; adia sem ganho. Reavaliar quando houver volume real.
- *Reusar o banco de produção com flag:* arriscaria misturar dado de pesquisa com o gate do ADR-0026 e a residência LGPD. Rejeitada por acoplamento.
**Consequências:** nasce a frente **N4** (engenharia de dados) com Parquet + DVC; qualquer `Result` de pesquisa passa a carregar a tétrade de proveniência (commit/dataset/modelo/hiperparâmetros). O corpus de pesquisa **não** é servido ao app. Mantém intactas as regras rígidas do `CLAUDE.md` (sintético/autocaptação; sem terceiros). Relaciona ADR-0005, 0007, 0025, 0026, 0028.

---

## ADR-0031 — Veredito de qualidade de sinal: score contínuo + rejeição por limiar grosseiro
**Status:** Aceita (2026-07-21)
**Contexto:** Decisão de kickoff **D2** ([Documentation/13](Documentation/13_Analysis_Phase_Work_Breakdown.md)) e Q-TEC-06. Hoje o `WaveEegEngine` reporta **métricas objetivas sem veredito** (`signal_std`, `mains_power`, `mains_power_ratio`) porque nenhum limiar defensável havia sido definido — e inventar limiar seria desonestidade científica. O piloto de 2026-07-18 mostrou **contaminação de 60 Hz massiva** (potência ~26 000 a ~53 000), o que dá um teto grosseiro óbvio de inutilizabilidade.
**Decisão:**
- **Qualidade é um `score` contínuo 0..1** anexado ao `Result` (não um booleano), derivado das métricas objetivas (`mains_power_ratio`, faixa de amplitude, % de amostras com `poor_signal`). Preserva o dado para auditoria e a honestidade visual (ADR-0027).
- **Rejeição só acima de um limiar grosseiro** (janela claramente inutilizável, ex.: 60 Hz dominante) — descarte conservador, não "limpeza" que arrisca artefato residual (coerente com [DataScience/30](DataScience/30_EEG_Signal_Processing_Strategy.md) §E3).
- **Limiares iniciais são provisórios**, derivados do piloto, e **iterados** conforme a Exp. A (distribuição formal de qualidade) — versionados com `engine_version`.
**Alternativas consideradas:**
- *Gate booleano rígido (usável/não-usável):* simples, mas **joga fora informação** e esconde a incerteza; incompatível com a honestidade científica da fase. Rejeitada.
- *Bloquear até a Exp. A dar a distribuição formal:* mais puro, mas **trava o cronograma** sem necessidade — o teto do 60 Hz já é acionável. Rejeitada em favor de "provisório + iterar".
**Consequências:** o campo `quality` do `AnalysisEngine` ganha semântica (score + flag de rejeição) sem quebrar o contrato; a UX de "sinal ruim" passa a ter base numérica. Fecha Q-TEC-06 como **encaminhada** (limiar provisório; refino pela Exp. A). Relaciona ADR-0017, 0027 e DataScience/30/31.

---

## ADR-0032 — Definições operacionais de evento: contrastes de estado + baseline pessoal (sem "anomalia")
**Status:** Aceita (2026-07-21)
**Contexto:** Decisão de kickoff **D3** e Q-CLN-03. [DataScience/30](DataScience/30_EEG_Signal_Processing_Strategy.md) §E6 alerta que "pico/estabilização/anomalia" **não têm definição operacional** — sem isso, um detector "mede ruído com nome bonito". Além disso, no enquadramento **não-clínico** ([Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md)), o termo **"anomalia" é perigoso** (soa clínico/diagnóstico).
**Decisão:**
- **Vocabulário de evento restrito ao defensável:** (1) **contrastes de estado** medíveis (ex.: alfa olhos-fechados vs abertos; repouso vs carga) e (2) **desvios de um baseline pessoal** expressos em **N desvios-padrão** de uma feature específica. **Abandona-se o termo "anomalia"** nos textos, UI e código.
- **Cold-start:** enquanto não há histórico do usuário, usar **baseline populacional provisório** derivado dos dados de treinamento + literatura; o **baseline individual** é construído progressivamente a partir das sessões do próprio usuário. Alertas/classificações carregam **menor confiança** até atingir um volume mínimo de observações. **[RECOMENDAÇÃO/RÍGIDA]** deixar **explícito ao usuário o que é particular dele e o que é populacional** — transparência é requisito, não enfeite.
- **Ordem:** as definições de evento ficam **atrás do Catálogo de Features (N2)** — sem catálogo formal, não há feature sobre a qual definir evento.
**Alternativas consideradas:**
- *Manter "anomalia":* cômodo, mas **fura a fronteira não-clínica** e a regra do `CLAUDE.md`. Rejeitada.
- *Só baseline populacional (sem personalização):* simples, mas ignora a variabilidade individual do EEG e degrada a utilidade. Rejeitada em favor do híbrido com cold-start.
- *Só baseline individual desde a 1ª sessão:* impossível no cold-start; geraria eventos sem base. Rejeitada.
**Consequências:** o §E6 do DataScience/30 será reescrito sem "anomalia"; o Catálogo de Features (N2) precede os detectores; o `Result`/UI passam a distinguir sinal **populacional vs pessoal** e a expor **nível de confiança**. Fecha Q-CLN-03. Relaciona DataScience/30, Medical/71 e Q-AI-01 (dados para baseline).

---

## ADR-0033 — Modelo de sinal multicanal / device-agnóstico (forward-proofing sem novos drivers)
**Status:** Aceita (2026-07-21)
**Contexto:** [Documentation/13](Documentation/13_Analysis_Phase_Work_Breakdown.md) (portabilidade de hardware) aponta que conexão/ingestão (`DeviceReader`) e análise (`AnalysisEngine`) já estão desacopladas, **mas** a ciência/DSP embute a suposição de **canal único (FP1)**. Subir para multicanal (ex.: Muse 2, 4 canais — *confirmar no datasheet ao decidir*) muda a **forma do dado** de `amostras[]` (1D) para `canais × amostras` (2D). **[FATO]** é refactor contido, não rewrite — as abstrações existem. Objetivo declarado pelo fundador: **não é desacoplar totalmente ciência de hardware (impossível)**, e sim projetar ciência+arquitetura para que, quando o equipamento evoluir, **otimizar o que já existe e "plugar" novas features** seja fácil.
**Decisão (aplicar durante N3/N4, enquanto já se mexe no engine):**
- **Generalizar o tipo interno de amostra para quadro multicanal** (`canais × amostras` + `fs` + `rótulos/montagem` + `device`), com o NeuroSky preenchendo **N=1**. Barato agora, caro de retrofitar depois.
- **Gravar `device` e `montagem/canais` no `Result`** (junto de `engine_version`) — comparabilidade e rastreabilidade entre aparelhos.
- **`DeviceReader` retorna quadros, não escalares**; **qualidade normalizada 0..1** (mapear o indicador nativo de cada aparelho) — casa com ADR-0031.
- **Features aditivas e plugáveis:** novas features (inclusive espaciais, quando houver >1 canal) entram **sem quebrar** o `Result` existente; a interface `AnalysisEngine` não muda.
- **[FATO/limite explícito]** a **montagem** (FP1 vs TP9/AF7/AF8/TP10) muda o que é mensurável e a estratégia de artefato — e com >1 canal **ICA passa a ser possível** (indisponível hoje, DataScience/30 §2). Essa parte **re-deriva-se por aparelho**; **nenhuma abstração de código a remove**.
**Alternativas consideradas:**
- *Deixar 1D e só refatorar quando/se o Muse 2 entrar:* adia custo, mas **retrofitar o tipo de dado** (Result, storage, engine) depois é caro e arriscado. Rejeitada.
- *Implementar já drivers multicanais:* desperdício — não há aparelho decidido; violaria o escopo enxuto (ADR-0003). Rejeitada; mantém-se **pronto para N canais sem drivers novos**.
**Consequências:** N3 generaliza o modelo de dado (N=1 hoje); `Result` passa a carregar `device`+`montagem`; o design fica **pronto para multicanal** sem implementar hardware novo. **Não** decide adotar o Muse 2 (decisão futura, com datasheet). Relaciona ADR-0017, 0025, 0031 e Documentation/13.

---

## ADR-0034 — Incorporar eSense (Attention/Meditation) como métrica exploratória rotulada
**Status:** Aceita (2026-07-25)
**Contexto:** O NeuroSky expõe as métricas **eSense** (*Attention* e *Meditation*, 0–100), já decodificadas pelo parser (`packages/wave-eeg/thinkgear.py`). Até aqui a orientação era **não** usá-las ([DataScience/30](DataScience/30_EEG_Signal_Processing_Strategy.md) §2: "caixa-preta; no máximo referência exploratória") e extrair apenas features próprias e transparentes (Catálogo N2). O fundador decidiu **reconsiderar**: como o produto é **não-clínico e não-diagnóstico** ([Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md)) e o médico é quem arbitra, faz sentido **aproveitar** o eSense como mais um sinal exploratório em vez de descartá-lo.

**[FATO — honestidade que a decisão não apaga]** eSense é um **algoritmo proprietário e fechado** da NeuroSky, **sem validação científica independente**. "Métrica válida" é alegação do fabricante, **não** fato estabelecido. Os experimentos deste estudo (B/C) medem features **transparentes**, não o eSense.

**Decisão:** **Incorporar `attention` e `meditation`** ao pipeline como **métricas exploratórias, sempre rotuladas** como *"proprietária do fabricante, não validada"*, **ao lado** (nunca no lugar) das features transparentes do Catálogo N2. Guarda-corpos (rígidos):
1. **Rótulo obrigatório** de proprietária/não-validada/exploratória onde quer que apareça (UI, relatórios, `Result`).
2. **Nunca** base de claim, nem apresentada como diagnóstica ou como "medida de atenção" sem a ressalva — coerente com os guarda-corpos de comunicação de [Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md) §6.
3. **Camada primária continua sendo as features transparentes** (interpretáveis/XAI para o médico); o eSense é complemento, não fundamento.
4. Entra na **tétrade de proveniência** e no versionamento como qualquer feature; se um dia houver dado rotulado, pode ser **comparado** às features próprias (validação interna), não assumido.

**Alternativas consideradas:** (a) **manter excluído** — mais puro, mas descarta um sinal já disponível e gratuito num produto que não fecha diagnóstico; (b) **usar eSense como métrica principal** — rejeitada: é caixa-preta, mataria a explicabilidade que o médico precisa e a honestidade do produto.

**Consequências:** o `capture` passará a registrar `attention`/`meditation` (hoje grava só raw+poor_signal); o `AnalysisEngine`/N3 e o Catálogo ([DataScience/32](DataScience/32_Feature_Catalog.md)) ganham uma seção eSense marcada **proprietária/cautela**; a UI (N6) deve exibir o rótulo. **Refina** [DataScience/30](DataScience/30_EEG_Signal_Processing_Strategy.md) §2 (de "no máximo exploratória" para "exploratória, incorporada e rotulada"). Relaciona Medical/71, ADR-0030 (proveniência), ADR-0032 (evento) e o Catálogo N2.

---

## ADR-0035 — Camada de IA de linguagem: sumário determinístico primeiro, narrativa-LLM aterrada depois; RAG fora de escopo
**Status:** Aceita (2026-07-26)
**Contexto:** O N5 produz **relatórios longitudinais determinísticos** (níveis, extremos, tendências por feature — `wave_eeg.longitudinal`). Surge como **comunicá-los em linguagem** ao médico/paciente, e se um **RAG** sobre literatura faria sentido. Distinção-chave: um **LLM não lê o sinal cru de EEG**; onde ele ajuda é a **camada de linguagem** sobre os números que o motor determinístico já produziu.

**[FATO] O risco vive na linguagem, não nos números.** Uma claim clínica alucinada, ou uma citação de literatura errada em conteúdo de saúde, é **passivo regulatório** ([Medical/71](Medical/71_Intended_Use_and_Regulatory_Positioning.md)). Por isso a base tem de ser **determinística e auditável**, e qualquer LLM entra **aterrado** nela.

**Decisão:**
1. **Começar determinístico:** a comunicação em linguagem nasce como **sumário por template** sobre o relatório determinístico (**N5-c**) — risco de alucinação **zero**, cada número **rastreável**. É a forma legível do relatório.
2. **Narrativa por LLM é upgrade de fluência, posterior (N6):** um **sumarizador aterrado** — entra o relatório determinístico, sai prosa **estritamente derivada dele**; **proibido interpretar clinicamente**; disclaimer **não-diagnóstico** carimbado; higiene anti prompt-injection. É **"tradutor", nunca "analista"**; nunca base de claim.
3. **RAG / contextualização contra literatura: FORA DE ESCOPO.** Maior risco (citação/alucinação em saúde) e menor urgência. Se um dia reentrar, exige **ADR próprio** e corpus curado com disciplina de citação.

**Alternativas consideradas:** (a) **começar com LLM direto** — rejeitada: sem a base determinística confiável, a prosa vira risco; (b) **RAG já no N5/N6** — rejeitada: risco regulatório desproporcional à urgência; (c) **nenhuma camada de linguagem** — rejeitada: o relatório numérico sozinho é pouco acessível ao leitor final.
**Consequências:** **N5 ganha N5-c** (sumário por template, sem LLM); **N6 ganha o item "narrativa-LLM aterrada"** com os guarda-corpos acima; **RAG sai do roadmap** (candidato futuro, gated por ADR). Relaciona **ADR-0009** (o LLM é modelo pronto, sem treino nosso), Medical/71 e o N5.

## ADR-0036 — Persona inicial: acompanhamento de bem-estar (estresse/relaxamento), não-clínico
**Status:** Aceita (2026-07-26)
**Contexto:** A fase **Produto & UX** ([Documentation/14](Documentation/14_Product_UX_Phase_Work_Breakdown.md)) exige uma persona para dar linguagem "didática" à UI — e a **Q-PRD-01** (P0) estava aberta. Restrições: posicionamento **não-clínico** nesta fase (Medical/71, ADR-0012); o que o sinal **honestamente sustenta** (H-SIG-01 🟡 — tendências de estado, com o **alfa** replicável no Exp. B como âncora); o dyad já construído (paciente capta em casa → profissional revisa tendências/relatório via CareLink).

**[FATO] A persona de agora é de bem-estar; a visão clínica (CDS, Fases 4–6) é futura.** Escolher a persona não pode contradizer nem o não-clínico de hoje nem o caminho clínico de amanhã.

**Decisão:**
1. **Persona primária = adulto em acompanhamento de bem-estar (gestão de estresse/relaxamento)**, acompanhando as próprias tendências de estado ao longo do tempo, com um profissional revisando. Alavanca o achado mais defensável (alfa em repouso/olhos fechados). **Nada de claim clínica** (bem-estar, tendências, exploratório).
2. **Enquadramento do acompanhante = "profissional de bem-estar"** (psicólogo/terapeuta/coach) **na linguagem/UI** — não "médico". **O papel `doctor` no modelo de dados permanece** (autorização, CareLink, auditoria): a visão de longo prazo (CDS clínico) fica intacta; muda só a **cópia**, não a arquitetura.
3. **Contexto de uso:** autocaptação em casa + revisão **assíncrona** do profissional pelo relatório longitudinal/narrativa (o que já está construído).

**Alternativas consideradas:** (a) **foco & meditação** — mais motivador, mas apoia-se mais no eSense (proprietário/rotulado) e menos no achado defensável; fica como extensão futura da persona, não a âncora. (b) **autoconhecimento/quantified-self genérico** — rejeitada como primária: persona vaga, papel do profissional fraco, difícil ser "didático para alguém". (c) **renomear o papel `doctor` no modelo** — rejeitada: acoplaria a cópia de produto à arquitetura e complicaria a visão clínica futura.

**Consequências:** resolve **Q-PRD-01** ([04_Open_Questions](04_Open_Questions.md)); a linguagem didática (P1) e o onboarding (P4) miram esta persona; textos usam "profissional de bem-estar"; o listing da Play Store (P5) segue o mesmo enquadramento não-clínico. **Q-PRD-02** (modelo de negócio) e **Q-REG-03** (on-ramp de bem-estar) permanecem, agora informadas por esta persona. Relaciona Medical/71 e ADR-0012.

## ADR-0037 — Anotações contextuais de sessão: nota livre cifrada, por sessão, visível ao profissional via CareLink (PUX-D1)
**Status:** Aceita (2026-07-26)
**Contexto:** A fase **Produto & UX** vai construir a **P2** (o "pop-up de contexto"): a [Visão](00_Project_Vision.md) previa que o paciente adicione **contexto a um momento** para correlacionar com o sinal — nunca implementado (não há tabela de anotação). **PUX-D1** ([Documentation/14](Documentation/14_Product_UX_Phase_Work_Breakdown.md)) pede o modelo. Persona = bem-estar/estresse (ADR-0036). A **v1 é manual** (o disparo por evento/desvio Nσ depende de baseline maduro — ADR-0032 — e fica para v2, sem o termo "anomalia").

**[FATO] O padrão de dado sensível do titular já existe.** O `Result` cifra em repouso (ADR-0026), audita acesso por titular (`ResultAccessEvent`) e a leitura pelo profissional exige **CareLink ativo** (ADR-0024). A anotação **espelha** isso em vez de inventar um caminho novo.

**Decisão:**
1. **Modelo `SessionAnnotation`:** **uma nota por `capture_session`** (`session_id` único, editável = upsert), com `patient_user_id` redundante (exclusão/portabilidade em massa) e `CASCADE` na exclusão de sessão/usuário — como o `Result`.
2. **Formato v1 = nota de texto livre** (tamanho limitado). **Tags estruturadas ficam para v2** — exigem decidir um vocabulário controlado, que não deve bloquear a v1.
3. **Cifrada em repouso** (Fernet, o mesmo `MetricsCipher` do `Result`): contexto autorrelatado é **dado pessoal**. Só ids/timestamps ficam em claro.
4. **Quem escreve:** apenas o **titular**, na própria sessão. O profissional **nunca** autora contexto do paciente (é autorrelato).
5. **Quem lê + auditoria:** o titular lê a própria; o profissional lê via **CareLink ativo**, e a leitura é **auditada** numa tabela dedicada **`annotation_access_events`** (espelho do `ResultAccessEvent`) — trilha LGPD **precisa**, sem confundir "leu suas notas" com "leu seus resultados".
6. **Visibilidade = ao profissional via CareLink** (como o `Result`). **Não** há "privada por padrão / opt-in por nota" nesta versão: esvaziaria o valor de correlação, e o compartilhamento já é governado pelo CareLink (ADR-0024) + consentimento (ADR-0026).
7. **Direitos do titular:** a nota entra no **export** (portabilidade) e é apagada pela **exclusão** (erasure), junto com os `Result`.

**Alternativas consideradas:** (a) **tags estruturadas já na v1** — adiada (exige vocabulário); (b) **privada por padrão, opt-in por nota** — rejeitada (esvazia a correlação; compartilhamento já governado por CareLink+consentimento); (c) **reusar `ResultAccessEvent`** para auditar as notas — preterida (misturaria "leu notas" com "leu resultados" na trilha); (d) **texto em claro** — rejeitada (dado pessoal; cifra como o `Result`); (e) **múltiplas notas por sessão (log)** — adiada (a v1 é "o contexto daquela sessão" = uma coisa, editável).

**Consequências:** nova **migration 0008** (`session_annotations` + `annotation_access_events`); um `AnnotationService` no padrão do `ResultService`; rotas do titular (`PUT/GET/DELETE /sessions/{id}/annotation`) e do profissional (`GET /patients/{id}/sessions/{id}/annotation`, CareLink + auditada); export/erasure estendidos. **P2-b** traz a UI (captura manual no fim da sessão + edição no histórico; leitura rotulada "autorrelato" e read-only para o profissional). Relaciona ADR-0026, ADR-0024, ADR-0032 (evento = v2) e Medical/72.

### Emenda à ADR-0037 (2026-08-10) — a **existência** de nota é metadado da lista, e não é leitura
**Status:** Proposta (2026-08-10) — vira Aceita no merge. Complementa a ADR-0037; não altera nada do que ela decidiu.

**Contexto:** o design marca um selo "autorrelato" nas linhas da timeline (`Design/round1/sessoes.html`, três linhas) e um contador no resumo do período (*"Sessões com autorrelato — 3"*). O porte deixou os dois de fora com uma razão registrada no próprio componente: saber quais sessões têm nota exigiria **uma consulta de anotação por sessão**, e a única rota existente é por sessão (`GET /sessions/{id}/annotation`). Fica então a pergunta que a ADR-0037 não respondeu: dizer que uma sessão **tem** nota é o mesmo que ler a nota?

**Decisão:**
1. **Não é leitura.** A trilha `annotation_access_events` registra quem **leu a nota** de alguém. Marcar que uma sessão tem autorrelato não entrega texto nenhum, e registrá-lo como `READ` encheria a trilha de acessos que não aconteceram — **uma trilha inflada é uma trilha que ninguém consegue auditar**, e o valor dela para o titular vem justamente de ser pequena e verdadeira.
2. **A existência é visível a quem tem vínculo ativo**, como o resto da lista. Esconder sairia **pior para o titular**: sem o selo, o profissional abriria sessão por sessão à procura da nota, gerando **mais** leitura auditada — o oposto do que a ocultação pretenderia proteger.
3. **Existência ≠ conteúdo.** `has_annotation` é booleano; nada é decifrado para produzi-lo (a consulta lê só `session_id`). Ler a nota continua exigindo a rota própria, com CareLink e auditoria — esta emenda **não** cria caminho novo para o texto.
4. **Uma consulta para a lista inteira**, filtrada também por titular: um id de sessão de outra pessoa que entrasse na lista por engano não poderia responder "sim".

**Alternativas consideradas:** (a) **auditar a lista como leitura de nota** — rejeitada (item 1): tornaria a trilha ruído e puniria a tela por informar corretamente; (b) **expor o selo só ao titular** — rejeitada (item 2), com a ressalva de que hoje **nenhuma tela do profissional o renderiza**: o contrato fica pronto para o cartão "Notas de contexto" que `painel-profissional.html` desenha; (c) **contar as notas no resumo pelo servidor** — desnecessária: com o booleano na lista, a contagem é do cliente e não custa consulta nenhuma.

**Consequências:** `has_annotation` em cada item de `/me/results` e `/patients/{id}/results`; o selo volta ao `SessionRow` e a quinta linha ao resumo do período. Nenhuma migration, nenhum dado novo guardado. Relaciona ADR-0037, ADR-0024 e ADR-0027 (o selo **não** tem valência: diz que há autorrelato, não que a sessão foi melhor).

### Emenda à ADR-0037 (2026-08-14) — **contagem** por vínculo é metadado da lista, e não deixa trilha
**Status:** Proposta (2026-08-14) — vira Aceita no merge. Complementa a ADR-0037 e a emenda de 2026-08-10; não altera nada do que elas decidiram.

**Contexto:** o mockup `inicio-profissional.html` põe `.stat`s em cada cartão de pessoa — quantas sessões, quantos autorrelatos. O porte deixou os cartões **sem número nenhum**, com a razão registrada no próprio componente: obter isso exigiria chamar `/patients/{id}/results` para cada vinculado ao abrir a lista, e `ResultService.listar` **decifra e audita** — encheria a trilha de acessos que ninguém pediu. A emenda de 2026-08-10 já resolveu o caso vizinho (a **existência** de nota numa sessão que se está vendo). Falta a pergunta seguinte: **contar** as sessões de alguém é observar essa pessoa?

**Decisão:**
1. **Contagem é metadado, não conteúdo.** `COUNT(*)` de `results` e de `session_annotations` por titular não decifra nada — nenhuma métrica, nenhuma banda, nenhum texto sai do banco. O caminho é próprio (`CareService`), **não** passa pelo `ResultService.listar`.
2. **Não gera evento de acesso.** A trilha existe para proteger o **conteúdo**; registrar "abriu a lista" a cada visita a tornaria ruído, e uma trilha inflada é uma trilha que ninguém audita — é o mesmo argumento do item 1 da emenda de 2026-08-10.
3. **O limite é a contagem.** Qualquer valor **derivado do sinal** — alfa médio, composição, qualidade, a linha de tendência que o mockup desenha no cartão — **continua fora** da lista e só existe no painel, pela rota auditada. Decisão do fundador em 2026-08-13, e o limite é a parte que importa: cartão conta, cartão não mede.
4. **Só para vínculo `active`.** Convite pendente não concede acesso a nada (ADR-0024) e o cartão pendente não recebe contagem.

**O que se abre mão, explicitamente:** com a contagem sem trilha, o profissional pode observar o **ritmo de uso** de todos os seus vinculados — "14 sessões em 30 dias", "2 autorrelatos" — quantas vezes quiser, sem deixar registro. Frequência de uso é um padrão de comportamento, e até aqui **nenhuma** observação sobre um titular acontecia sem rastro. A alternativa (b) preservaria essa propriedade; foi preterida porque o custo recai sobre a utilidade da própria trilha. O titular continua podendo **revogar** o vínculo a qualquer momento, com efeito imediato, e isso encerra a observação.

**Alternativas consideradas:** (a) **cartões sem número, como hoje** — preterida pelo fundador: o mockup os desenha e a lista fica sem o que distingue uma pessoa da outra; (b) **auditar a contagem com uma ação própria (`COUNTED`)** — preterida: preserva "toda observação deixa rastro", mas exige valor novo no enum (migration) e faz a trilha crescer a cada abertura da lista, que era a objeção original; (c) **derivar a contagem no cliente, pedindo os results de cada um** — rejeitada: é exatamente o que a decisão evita, com o agravante de decifrar e auditar; (d) **incluir alfa médio no cartão, como o mockup** — rejeitada (item 3): é valor do sinal.

**Consequências:** `session_count` e `annotation_count` em cada `CareLinkResponse` **ativo**; um método de contagem no `CareService` sem decifrar e sem auditar; o docstring do `doctor/index` deixa de dizer que não há números e passa a dizer **qual é o limite**. Nenhuma migration, nenhum dado novo guardado. Relaciona ADR-0037 e sua emenda de 2026-08-10, ADR-0024 (vínculo ativo), ADR-0022 (minimização) e ADR-0027 (contagem não tem valência: número de sessões não é nota de desempenho).

### Emenda à ADR-0037 (2026-08-22) — com a lista paginada, a trilha registra **uma leitura por página**
**Status:** Proposta (2026-08-22) — vira Aceita no merge. Complementa a ADR-0037 e suas emendas de 2026-08-10 e 2026-08-14; não altera nada do que elas decidiram.

**Contexto:** a paginação do histórico do titular e da lista "Todas as sessões" do painel do profissional entra agora (`Documentation/15`). Hoje `ResultService.listar` ([services/results.py:142](services/api/app/services/results.py:142)) emite **um evento por chamada**, com `count=len(results)` — "o ator X leu N resultados do titular Y às T". Paginar transforma uma chamada em várias, e a pergunta é o que a trilha passa a dizer. **[FATO] apurado antes de decidir:** paginar **não reduz** o que é decifrado nem o que é auditado. A tela de histórico já faz duas chamadas — a lista e o relatório longitudinal ([api/results.py:211](services/api/app/api/results.py:211)) —, e o relatório **já lê e já audita a janela inteira**, porque os agregados precisam do período todo. O ganho da paginação é **payload e renderização**, não minimização; o argumento de privacidade não se aplica aqui e não deve ser usado para justificá-la.

**Decisão:**
1. **Um evento por página, `count` = itens daquela página.** O contrato não muda de forma — nenhuma coluna nova, nenhum valor de enum novo, nenhuma migration. Muda só a granularidade: três páginas de dez viram três eventos de `count=10` no lugar de um de `count=30`.
2. **O evento não guarda o número da página.** A trilha registra o que foi **decifrado**, não por qual controle da tela; `offset` é detalhe de transporte e não é dado do titular.
3. **O relatório longitudinal segue auditando a janela inteira.** As duas trilhas coexistem e contam coisas diferentes: uma diz quanto da lista foi aberto, a outra que os agregados do período foram calculados. Nenhuma das duas é derivável da outra.
4. **Nenhuma página escapa da trilha.** Não há "só a primeira audita": toda chamada que decifra deixa evento, que é a propriedade que a ADR-0037 existe para garantir.

**O que se abre mão, explicitamente:** a trilha fica mais **granular e mais volumosa** — folhear é indistinguível de várias visitas, e reconstruir "quantas vezes o profissional abriu o histórico" passa a exigir agrupar eventos por proximidade de tempo, coisa que hoje sai de graça. Aceita-se porque o custo é de legibilidade forense e não de proteção: nenhuma leitura deixa de ser registrada, e o `count` continua fiel ao que saiu do banco em claro. **Hoje nada no produto exibe essa trilha** — varridas as rotas em `services/api/app/api/` e as telas em `apps/wave-app/app/`, não há endpoint nem tela que a mostre ao titular —, então o ruído não chega a ninguém pela UI. **Se um dia houver essa tela**, a granularidade volta à mesa: é ela que decidirá se a tela agrupa por visita ao exibir.

**Alternativas consideradas:** (a) **um evento por visita** — preterida: exigiria inventar uma noção de "visita" que não existe no modelo (janela de tempo? identificador de leitura?), e o `count` deixaria de refletir o que foi de fato decifrado, que é a única coisa que a trilha sabe medir com honestidade; (b) **só a primeira página audita** — rejeitada: as páginas seguintes decifram dado de titular sem rastro, exatamente o que a ADR-0037 impede; (c) **não paginar** — preterida pelo fundador em 2026-08-16, junto com o paliativo de cliente.

**Consequências:** `limit`/`offset` e `total` em `GET /me/results` e `GET /patients/{patient_id}/results`, **ausentes = comportamento de hoje** (a janela inteira), pelo mesmo princípio do `?days=N`; **ordenação estável obrigatória** — o desempate por `id` deixa de ser refinamento e vira correção, porque o `now()` do Postgres é por transação e sessões gravadas na mesma transação compartilham `created_at`, o que faria páginas repetirem e pularem linhas; filtro `with_annotation` sobre o metadado que a emenda de 2026-08-10 já liberou. Nenhuma migration. Relaciona ADR-0037 e suas duas emendas, ADR-0022 (minimização — que aqui **não** é o motivo) e ADR-0027 (os agregados continuam sobre o período inteiro: lista paginada com resumo que seguisse a página faria a tela afirmar o que não é verdade).

## ADR-0038 — Casca do app e navegação: shell responsivo próprio (sidebar web / drawer mobile), sem dependência nativa nova; superfície por plataforma e gate do simulador (P6)
**Status:** Proposta (2026-07-28) — vira Aceita no merge.
**Contexto:** As frentes de **conteúdo** da fase Produto & UX (P1–P4: camada didática, anotações, cockpit, captação guiada) estão concluídas. Falta a **casca**: hoje a navegação é uma `Stack` empilhada com "voltar" ([apps/wave-app/app/_layout.tsx](apps/wave-app/app/_layout.tsx)), header por tela, sem navegação lateral; ícones/splash são os **placeholders default do Expo**. Pedido do fundador (2026-07-27): restyle moderno — **header persistente**, **sidebar no web / drawer + hambúrguer no mobile**, e **identidade**. É frente **cross-cutting**, ortogonal ao conteúdo (não retrabalha P1–P4), registrada em [Documentation/14](Documentation/14_Product_UX_Phase_Work_Breakdown.md). **Adendo (2026-07-28):** o produto **web não deve fingir captar** (o simulador só faz sentido em dev/teste, pois no web não há acesso ao aparelho); e o cenário "celular capta → navegador assiste ao vivo" é desejável mas **não existe** hoje (o gateway `/stream` é 1:1, sem fan-out — [services/api/app/api/stream.py](services/api/app/api/stream.py)), sendo feature de backend à parte.

**[FATO] Cautela com dependência nativa.** `expo-font` foi evitado (#17) porque dep nativa exige recompilar o app; o dev-client já carrega o módulo SPP e o `expo-speech` (ADR/P4-d). Uma biblioteca de drawer (`@react-navigation/drawer` + `react-native-reanimated` + `react-native-gesture-handler`, via `expo-router/drawer`) somaria **3 módulos nativos**.

**Decisão:**
1. **Casca própria, sem dependência nativa nova.** Um `AppShell` (componente de layout) embrulha as telas via Expo Router (`Slot`/layout de grupo), com **header persistente** e navegação lateral, construído com o design system (Pressables + `Animated` **built-in**) — **sem** `@react-navigation/drawer`, `reanimated` ou `gesture-handler`.
2. **Responsivo por largura** (`useWindowDimensions`): **sidebar fixa** em telas largas (web/tablet, ~≥768 dp) e **drawer deslizante + hambúrguer** em telas estreitas (mobile). Um único conjunto de itens de navegação, derivado do papel.
3. **Header persistente:** marca/wordmark, título da seção atual, alternador de tema e menu de perfil/sair; substitui os headers da `Stack` (`headerShown` desligado / migração para `Slot` + header próprio).
4. **Guarda por papel preservada:** a lógica de roteamento por papel de `_layout.tsx` continua; itens e rotas por papel; a casca **não** afrouxa o isolamento paciente/médico.
5. **Superfície por plataforma:** navegação e telas refletem o que cada plataforma **consegue** (Architecture/22, capability por plataforma). No **web** (sem aparelho), a captação **não** aparece como função do produto — mostra histórico/tendências/relatório/cockpit/anotações e sinaliza que a captação é no app do celular.
6. **Gate do simulador:** a captação **simulada** deixa de aparecer no build de produção; fica atrás de flag de dev (`__DEV__` ou `EXPO_PUBLIC_ENABLE_SIMULATOR`) para preservar smoke/teste sem hardware. Não se apaga (útil em dev) nem se envia ao usuário final.
7. **Identidade gerada dos tokens:** wordmark/logo, splash e adaptive icon derivados das cores existentes (turquesa paciente / azul médico), substituindo os placeholders default do Expo; **trocáveis** por design profissional depois.
8. **Fora de escopo (frentes próprias):** **espectador ao vivo** (tempo real cross-device no navegador) = **ADR próprio** perto da P5 (exige fan-out no gateway, endpoint de assinatura, autorização CareLink/LGPD e barramento na nuvem, ex.: Redis); **deploy** = P5 (reabre ADR-0005).

**Alternativas consideradas:** (a) **biblioteca de drawer** (`expo-router/drawer`) — preterida: +3 deps nativas e rebuild do dev-client, contra a cautela histórica (#17); a casca custom cobre o caso com `Animated` built-in. (b) **Manter a `Stack` empilhada** — rejeitada: é o que o restyle quer substituir (sem header persistente nem navegação lateral). (c) **Apagar o simulador agora** — rejeitada: perde o caminho de smoke/teste no web; o gate resolve sem perder utilidade. (d) **Incluir o espectador ao vivo na P6** — rejeitada: é backend+auth+LGPD, ortogonal ao shell, infla a frente. (e) **Adiar a identidade** — preterida: os placeholders do Expo enfraquecem o produto; identidade simples derivada dos tokens é barata e trocável.

**Consequências:** novo `AppShell` + itens de navegação por papel; `app/_layout.tsx` migra da `Stack` para `Slot`/layout com a casca (guarda por papel mantida); **sem** novas deps nativas. P6 em fatias: **P6-a** casca responsiva (shell + navegação); **P6-b** superfície por plataforma + gate do simulador; **P6-c** identidade (wordmark/splash/app icon). `EXPO_PUBLIC_ENABLE_SIMULATOR` (ou `__DEV__`) passa a gatear a captação simulada — documentar no README do app e no setup de verificação. **Não** toca o conteúdo das telas (P1–P4) nem o modelo de dados; papel `doctor` intacto (ADR-0036). Relaciona Architecture/22, ADR-0027 (honestidade visual), ADR-0005 (edge vs nuvem, P5) e o futuro ADR do espectador ao vivo.

## ADR-0039 — Espectador ao vivo: fan-out do gateway + assinatura SSE (cookie); titular e profissional via CareLink auditado
**Status:** Proposta (2026-07-28) — vira Aceita no merge.
**Contexto:** A [Visão](00_Project_Vision.md) e um pedido do fundador: com o **celular captando** (app), ver os dados e a captação **em tempo real no navegador**. Hoje é impossível — o gateway `/stream` é **1:1**: as features/eSense de cada janela voltam **só ao socket que capta** ([services/api/app/services/streaming.py](services/api/app/services/streaming.py), `_samples`), sem fan-out. O web **não capta** (superfície por plataforma, ADR-0038/P6-b) mas **pode assistir** — capability por plataforma coerente: **mobile capta, web assiste**. Frente própria, com ADR próprio, como decidido em ADR-0038.

**[FATO] O padrão de leitura sensível do titular pelo profissional já existe.** CareLink `active` (ADR-0024) + consentimento (ADR-0026) + auditoria dedicada (`ResultAccessEvent`/`AnnotationAccessEvent`). O espectador profissional **espelha** isso em vez de inventar caminho novo.

**Decisão:**
1. **Fan-out no gateway:** ao produzir features/eSense de uma janela, o gateway **publica** num **barramento ao vivo por `session_id`**. Interface `LiveBus` com implementação **in-process (asyncio)** agora; **Redis pub/sub** quando houver nuvem multi-instância (amarra com **PUX-D2/ADR-0005**, P5). Publica-se **o mesmo** que já vai ao capturador — features transparentes + eSense rotulado `proprietary` — e **nunca o raw** (ADR-0025/0027/0034). Seam limpo: a camada de socket ([app/api/stream.py](services/api/app/api/stream.py)) publica `resposta["features"]/["esense"]` após cada `handle`, sem inchar a máquina de estados.
2. **Registro de sessão ativa:** descobrir a sessão ao vivo do paciente via `CaptureSession` status `ACTIVE` (+ presença no bus). O espectador assina por `patient_id` (resolve a sessão ativa) ou `session_id`.
3. **Assinatura via SSE (Bearer + fetch):** endpoint **read-only Server-Sent Events**, autenticado pelo **Bearer** que o app já emite (sem token na URL — ADR-0021/0025). Emite eventos `features`/`esense` ao vivo e, no fim, `closed` (com ponteiro ao `Result` persistido) ou `ended`. **Web-first**: o cliente lê o corpo via **`fetch` + `ReadableStream`** com o header `Authorization`. Espectar no **mobile** é extensão futura (o `fetch` do RN não expõe o corpo em stream).

   **[EMENDA 2026-07-29 — mecanismo de auth: Bearer, não cookie.]** A decisão original dizia "cookie httpOnly", mas na implementação (fatia de backend) verificou-se que o **único cookie do sistema é o refresh**, escopado em `/auth` — o app autentica por **Bearer** (access token em memória). Logo o endpoint usa o Bearer, e o cliente web lê via **fetch-SSE** com `Authorization` (o `EventSource` nativo não seta header). **A intenção do ADR se mantém** — SSE só-leitura, **sem token na URL**, reusando a auth do app; muda só o transporte do token (header em vez de cookie). As decisões de **privacidade/autorização não mudam** (titular; profissional via CareLink; auditoria).
4. **Autorização — titular:** assina a **própria** sessão ativa (autenticado como paciente; **sem** CareLink — é dado do próprio dono).
5. **Autorização — profissional:** assina via `require_active_care_link` + papel `DOCTOR`, **auditado** numa trilha dedicada **`live_view_access_events`** (espelho do `ResultAccessEvent`). **CareLink basta** — mesmo governo dos Result/anotações (ADR-0024/0026); **sem opt-in extra** para tempo real (decisão do fundador). A trilha registra quem assistiu, de quem, quando.
6. **Só features/eSense, nunca raw; sem veredito** (ADR-0027): o espectador vê **exatamente** o que o capturador vê; eSense sempre rotulado (ADR-0034).

**Alternativas consideradas:** (a) **WebSocket** para o espectador — preterido: bidirecional é peso desnecessário para um fluxo só-de-leitura; SSE+cookie é mais simples no web e evita token na URL. (b) **Redis já** — adiado: in-process cobre single-instance/dev; a troca vem com a nuvem (P5), atrás da interface `LiveBus`. (c) **Opt-in extra do paciente para tempo real** — preterido: CareLink+consentimento já governam a leitura do profissional e a auditoria dá a trilha (reabrível se a percepção de "presença ao vivo" pedir). (d) **Só titular, ou só profissional, na v1** — preterido: os dois valores (as 2 telas do dono; o acompanhamento remoto) são próximos e o bus/assinatura servem ambos. (e) **Persistir o stream para replay** — fora de escopo: o que persiste é o `Result` no fim (ADR-0025); o ao vivo é efêmero.

**Consequências:** novo módulo de **fan-out** (`LiveBus` in-process) + publicação no gateway; **registro de sessão ativa**; endpoints **SSE** do titular (ex.: `GET /me/live`) e do profissional (ex.: `GET /patients/{id}/live`, CareLink + auditado); nova trilha **`live_view_access_events`** (migration). App **web**: UI de "assistir ao vivo" (do titular em outra tela; do profissional na tela do paciente), consumindo SSE — **sem** DSP no cliente, honestidade visual. **Não** altera o caminho de captação nem o `Result`. Fatias: **backend** (bus + registro + SSE + auth + auditoria + migration) → **UI web do titular** → **UI web do profissional**. Relaciona ADR-0024, ADR-0026, ADR-0025, ADR-0027, ADR-0034, ADR-0005 (Redis/nuvem, P5) e Medical/72.

## ADR-0040 — Transporte de captação no iOS: BLE (GATT) via `react-native-ble-plx`, sem SDK proprietário
**Status:** Aceita (2026-07-30, PR #99).
**Emenda (2026-07-30, decisão #3 → auto-descoberta):** em vez de **fixar** o UUID da característica de dados numa constante, o `connection.ios.ts` faz **auto-descoberta em runtime** — ao conectar, assina **todas** as características `notify` e deixa o `ThinkGearParser` eleger a de dados (a primeira cujo fluxo **fecha pacotes ThinkGear**), descartando as outras. Motivo (levantado pelo fundador): os UUIDs GATT são do **modelo** MindWave Mobile 2 (firmware), não do aparelho específico — mas fixá-los é desnecessário e menos robusto que descobrir. O **ID do dispositivo** (instância) segue vindo do **scan + seleção do usuário**, como no Android; nada específico de um aparelho vai ao código. A tela de diagnóstico (fatia 2) permanece como **rede de segurança/confirmação**, não passo obrigatório.
**Contexto:** O app é Expo/React Native. A captação hoje é **Android-only**: [apps/wave-app/src/device/connection.ts](apps/wave-app/src/device/connection.ts) fala **SPP (Bluetooth Classic)** via `react-native-bluetooth-classic` e declara `supported = Platform.OS === "android"`; o iOS e o web caem em "captura indisponível" ([connection.web.ts](apps/wave-app/src/device/connection.web.ts)). Pedido do fundador (2026-07-30): **o app precisa funcionar no iOS** — ele vai testar em iPhone na próxima leva de testes em grupo.

**[FATO] iOS é viável por BLE, sem MFi.** O MindWave Mobile 2 é **dual-mode**: SPP (Classic) para PC/Mac/Android e **BLE/GATT para iOS**, **sem exigir MFi/External Accessory** ([Architecture/21](Architecture/21_NeuroSky_Integration_and_Capture.md) §2.1; [04_Open_Questions](04_Open_Questions.md) #87). A hipótese antiga de bloqueio por MFi já estava **derrubada** nos docs. O contrato de captação já foi desenhado para isto: `DeviceConnection.transport` prevê `"ble"` e o `ThinkGearParser` ([thinkgear.ts](apps/wave-app/src/device/thinkgear.ts)) é **agnóstico de transporte** (só consome bytes) — reusável tal como está.

**[FATO] Há duas vias reais no iOS, não equivalentes.** (A) **SDK proprietário da NeuroSky** — `NskAlgoSdk` + `MWMDevice` (framework binário; exige **chave de licença**, visto no plugin de referência `flutter_mindwave_mobile_2`); embrulha o BLE, mas calcula **banda no aparelho** e é dependência proprietária (**risco R-07**). (B) **CoreBluetooth cru** via `react-native-ble-plx` (MIT, cross-platform), assinando a característica GATT de *notify* que transmite os pacotes ThinkGear; o **UUID de serviço/característica não é documentado publicamente** — descobre-se **enumerando o aparelho físico**.

**Decisão** (caminho **B**, escolha do fundador):
1. **`react-native-ble-plx` como transporte iOS**, atrás do **mesmo** contrato `DeviceConnection`, num `connection.ios.ts` (resolução por plataforma do Metro, como já é `.web.ts`). **Sem** SDK proprietário e **sem** chave de licença (evita R-07).
2. **Raw → servidor, como no Android.** O cliente só **decodifica protocolo** (reusa `ThinkGearParser`) e envia o **raw** ao `AnalysisEngine`; **nenhuma DSP no cliente** (ADR-0025/0027). Se a característica só entregar banda já processada (estilo SDK), **não** se usa — só o raw honra a regra. eSense repassado rotulado (ADR-0034), igual ao Android.
3. **UUIDs descobertos no aparelho.** Como o GATT não é documentado, a fatia de habilitação inclui um **diagnóstico BLE** (scan + lista de serviços/características/propriedades) para **ler os UUIDs do headset** físico; travados numa constante depois. Enquanto não travados, `connection.ios.ts` fica **atrás de flag/experimental**.
4. **Config nativa iOS:** `Info.plist` `NSBluetoothAlwaysUsageDescription`; a lib entra via **config plugin** do Expo. É **módulo nativo novo** → exige **EAS dev-client** — o app **já** exige dev-client (`react-native-bluetooth-classic` + `expo-speech`), então é **incremental**, não um novo tipo de custo. **Sem** MFi/External Accessory.
5. **`supported` no iOS** passa a `true` quando o transporte BLE estiver implementado (`Platform.OS === "ios" || "android"`); **web permanece `none`** (ADR-0038/P6-b: web não capta).
6. **Não testável em CI nem no ambiente do dev** (sem build iOS / sem device). A **validação é o build EAS no iPhone do fundador**; até lá é código-no-escuro, iterado pelos instrumentos que já existem (`badChecksums`/`packetsParsed` do parser, iguais ao caminho Android).

**Alternativas consideradas:** (a) **SDK proprietário NeuroSky (caminho A)** — preterido: dependência proprietária/licenciada (R-07), calcula banda no device (fricção com o `AnalysisEngine`), custo/procura de licença; fica de **reserva** se B não conectar. (b) **Bluetooth Classic/SPP no iOS** — rejeitado: o MindWave não é MFi por essa via e apps de terceiros no iOS não abrem SPP sem External Accessory. (c) **Web Bluetooth / capturar no web** — fora de escopo: já decidido que o **web não capta** (ADR-0038/P6-b). (d) **Aguardar UUID/SDK documentado antes de codar** — preterido: os UUIDs se obtêm no aparelho; instrumentar e iterar é mais rápido que esperar doc inexistente.

**Consequências:** nova dependência nativa **`react-native-ble-plx`** + config plugin; novo `connection.ios.ts` implementando `DeviceConnection` (scan BLE → connect → subscribe *notify* → `paraBytes` → `ThinkGearParser` → handlers, espelhando o Android). **Fecha a parte de transporte mobile** que a **ADR-0006** mantinha aberta (o stack já é RN/Expo de fato); informa **Q-TEC-03/Q-TEC-05**. Fatias: **(1)** este ADR (docs-only); **(2)** dependência + config iOS + **diagnóstico BLE de UUID** (build para o fundador ler os UUIDs do headset); **(3)** `connection.ios.ts` com os UUIDs travados + `supported` no iOS. Após validado, o iOS deixa de ser questão aberta quanto à captação; a **não-captação** (auth/histórico/tendências/relatório/cockpit/anotações/espectador ao vivo) já rodaria no iOS se buildado. **Não** toca Android, web, modelo de dados nem o `Result`. Relaciona ADR-0006, ADR-0025 (raw não persistido), ADR-0027 (sem veredito), ADR-0034 (eSense rotulado), ADR-0038 (superfície por plataforma), [Architecture/21](Architecture/21_NeuroSky_Integration_and_Capture.md) §2.1 e Q-TEC-03/05.

## ADR-0041 — Cadastro de profissional: sem verificação de credencial (KYC/CRM) nesta fase; a fronteira de confiança é o consentimento (CareLink)
**Status:** Proposta (2026-08-04) — vira Aceita no merge.
**Contexto:** No teste em grupo (2026-08-04) levantou-se se **qualquer pessoa** deveria poder se cadastrar como "médico"/profissional, e cogitou-se **validar CRM por foto** (estilo validação de RG usada por bancos). O fundador pediu a avaliação de impacto **LGPD** + regras do projeto e os argumentos caso seja inadequado.

**[FATO] O posicionamento já reposicionou isto.** Pela **ADR-0036**, na fase atual o produto é **não-clínico/não-diagnóstico** (Medical/71); o acompanhante é **"profissional de bem-estar"** na UI, **não** "médico" — o papel `doctor` sobrevive só no **modelo de dados** para uma visão clínica futura.

**Decisão:**
1. **Sem KYC/validação de credencial (CRM) nesta fase.** Não coletar foto de documento nem biometria/face-match no cadastro.
2. **A fronteira de confiança é o consentimento** (consent-first/CareLink, ADR-0024/0026): o profissional só acessa dados de quem **o convidou e autorizou**, e o titular **revoga** quando quiser (efeito imediato), com **auditoria** (ResultAccessEvent/AnnotationAccessEvent/LiveViewAccessEvent). O risco de cadastro aberto é de **apresentação** (chamar-se "médico"), **não de acesso** — e a UI já diz "profissional de bem-estar" (ADR-0036), sem alegar médico verificado.
3. **Atrito leve opcional, sem dado sensível** (se/quando desejável): onboarding do profissional por **convite/código** e/ou **atestação declarada + termos**. Não construir agora sem necessidade.
4. **Validação real de credencial fica para a fase clínica futura**, onde é necessária e onde se faz **KYC + cruzamento com o registro do CFM/CRM + DPIA** direito (base legal, minimização, retenção, anti-fraude). Reabre com **Q-REG-03** (on-ramp) e a persona clínica.

**Argumentos (por que não agora):**
- (a) Validar CRM e apresentar como médico verificado = **claim clínica**, proibida na fase (Medical/71) e contra ADR-0036.
- (b) **LGPD:** foto de documento é **dado pessoal**; face-match é **dado pessoal sensível** (Art. 5º, II) → exige base legal específica, minimização, DPIA e guarda segura — desproporcional para um app de bem-estar exploratório e contra a postura atual (**sem dado real de pessoa em dev**; consent-first).
- (c) **Foto não valida nada** (forjável); validação real é KYC completo (provedor terceiro, cruzamento CFM, prova de vida) — custo e compliance contínuos.
- (d) A salvaguarda que **importa** (acesso a dado sensível) **já existe**: CareLink + consentimento + auditoria.

**Itens correlatos DEFERIDOS (registrados aqui para não se perderem):**
- **"Esqueci minha senha"** e **verificação de e-mail (código de confirmação)** dependem de **envio de e-mail** (provedor SMTP) + endpoints + segurança (TTL de token, rate limit e **anti-enumeração** de usuário). Entram junto do **P5/infra**. **Não telar sem função** no produto (UI morta engana o teste e fere a honestidade); **desenhar** no processo de design (Fable) e **fiar** quando o backend existir.
- **Exigir e-mail verificado** é **decisão de política** (muda o fluxo de cadastro; atrito leve que conversa com este ADR). Decidir de propósito perto do P5, com Q-REG-03.

**Alternativas consideradas:** (a) **KYC/CRM por foto agora** — rejeitado (a/b/c acima). (b) **Cadastro de profissional só por convite/código** — preterido para agora (atrito extra sem necessidade; reabrível como item 3). (c) **Bloquear o auto-cadastro de `doctor`** — desnecessário: o CareLink já governa o acesso, e a persona atual é bem-estar.

**Consequências:** **nenhuma mudança de código agora** — o cadastro segue como está (mais as validações de UX do lote de correções). A cópia mantém "profissional de bem-estar" (ADR-0036). Os fluxos de e-mail (reset/verificação) ficam **no radar do P5/infra**, com a decisão de exigir verificação em aberto. Relaciona ADR-0036, ADR-0024, ADR-0026, Medical/71 e Q-REG-03.

## ADR-0042 — Dependências nativas do porte do design "Maré": `react-native-svg` + `react-native-reanimated`, sem Skia
**Status:** Proposta (2026-08-06) — vira Aceita no merge.
**Contexto:** O round 1 de design (**"Maré"**, 12 telas HTML autocontidas em [Design/round1/](Design/round1/), versionado no PR #106) é o **contrato visual** da próxima frente: portar aquelas telas para o app RN (`apps/wave-app`, Expo Router), começando por **login** e pelo **herói** (estado ao vivo). A revisão de regras dos mockups saiu **limpa** (não-clínico, eSense rotulado, bandas categóricas, "profissional de bem-estar") — o que sobra a decidir é **como desenhá-los**, não o quê.

**[FATO] O sistema de cor já está no app.** `apps/wave-app/src/theme/tokens.ts` e o `:root` dos mockups usam **os mesmos hexes** (`#0B1220`, `#151E32`, `#4FD1C5`, `#0F7A70`, `#7AA2F7`, `#2A5BC7`, `#F5F7FA`, `#0F1726`). O porte **não recolore** o app; falta vocabulário (`surface-3`, `accent-soft`, `line-2`, sombra), não paleta.

**[FATO] O desenho é SVG; a animação é canvas.** As 12 telas somam **7 a 28 `<svg>` cada** (ícones 24×24 *stroke*, figura da cabeça-constelação, anéis e medidores) e **0 a 2 `<canvas>`** — este último só para o *WaveField* decorativo. Hoje o app desenha tudo com `View` (o `Logo` são barras sobre um ladrilho; o `TrendChart` são segmentos posicionados): serve para uma marca, **não** para um sistema de ícones.

**[FATO] Skia não é uma dependência, são três.** `@shopify/react-native-skia` **2.x** declara peers obrigatórios **`react-native-reanimated`** e **`react-native-worklets`**; a linha **1.x** (peer `reanimated >=2`) trava em `react-native <0.78` e o app está em **0.86** — não há versão de Skia utilizável aqui sem Reanimated. E o **Reanimated 4** já exige o `react-native-worklets` como runtime (peer `0.10.x–0.11.x`), então o worklets **não é escolha separada**: vem com o Reanimated.

**[FATO] Os três são versionados pelo próprio Expo SDK 57** (`expo/bundledNativeModules.json`): `react-native-svg@15.15.4`, `react-native-reanimated@4.5.0`, `react-native-worklets@0.10.0` — instalação por `npx expo install`, sem resolução manual de versão.

**[FATO] O custo do dev-client já foi pago.** O app **já** exige EAS dev-client (`react-native-bluetooth-classic`, `react-native-ble-plx`, `expo-speech`) e **já** tem um build EAS pendente para validar a captação iOS (ADR-0040). Módulo nativo novo aqui é **incremental num rebuild que já está no caminho**, não um custo novo — que é justamente o que a cautela da **ADR-0038** pesava.

**Decisão** (escolha do fundador, 2026-08-06, após ver o custo real de cada via):
1. **Adotar `react-native-svg`.** Ícones, figuras (cabeça-constelação) e medidores do design passam a ser SVG de verdade, com implementação web pelo react-native-web. Os **gradientes** dos mockups saem do `LinearGradient`/`RadialGradient` **de dentro do SVG** — portanto **não** se adota `expo-linear-gradient`: uma dependência, não duas.
2. **Adotar `react-native-reanimated` 4** (+ `react-native-worklets`, seu runtime obrigatório). Motivo: as animações do design (o *WaveField*, transições de view, halos) rodam na **UI thread** em vez de disputar a thread JS com o stream de EEG — que é exatamente a tela onde o app mais anima e mais processa ao mesmo tempo.
3. **NÃO adotar `@shopify/react-native-skia` nesta rodada.** O *WaveField* é **decorativo** e precisa degradar para estático sob *reduced motion* de qualquer forma; um `Path` SVG animado por Reanimated entrega o efeito sem o binário do Skia nem o **CanvasKit WASM (~7 MB)** no bundle web. Reabrível por **emenda** se a onda ficar visivelmente pobre no aparelho real.
4. **Relação com a ADR-0038 — refinada, não revogada.** A ADR-0038 preteriu `@react-navigation/drawer` + reanimated + gesture-handler porque **um problema resolvível sem módulo nativo** não justificava três. Aqui a necessidade é outra (o contrato visual **é** vetorial) e o custo mudou (dev-client e build EAS já pendentes). **A casca continua própria** (`AppShell` + `Slot`): adotar Reanimated **não** reabre a troca por biblioteca de navegação — isso seria decisão nova.
5. **Toda animação respeita *reduced motion*** (`AccessibilityInfo.isReduceMotionEnabled`) e nenhuma delas carrega informação: movimento é ornamento, o dado continua legível parado (ADR-0027).
6. **Nada disso toca a análise.** SVG e Reanimated são camada de desenho; o app segue **só consumindo** features do `AnalysisEngine`, **sem DSP no cliente**, com `engine_version` gravada no resultado.

**Alternativas consideradas:** (a) **Só `react-native-svg`, onda com `Animated` built-in** — preterido pelo fundador: mantém a ADR-0038 intacta com 1 módulo, mas anima na thread JS, arriscando engasgo justamente na tela ao vivo. (b) **Skia + Reanimated + worklets** — preterido depois de exposto o custo: 4 pacotes, binário maior, `WaveField.web.tsx` de fallback e emenda à ADR-0038, tudo por um efeito **decorativo**. (c) **Nenhuma dependência nova** (ícones em `View`/texto) — rejeitado: fidelidade baixa e um set de ícones insustentável à mão. (d) **`expo-linear-gradient`** — desnecessário: o SVG já traz gradientes. (e) **Rasterizar os ícones como PNG** — rejeitado: não acompanha tema nem escala, e multiplica assets.

**Consequências:** duas dependências nativas novas (`react-native-svg`, `react-native-reanimated`) mais o runtime `react-native-worklets`, instaladas por **`npx expo install`** (o `npm install --legacy-peer-deps` **poda o lockfile** — gotcha vivido no PR #100); Reanimated exige seu **plugin de Babel**, então `babel.config.js` entra no diff da primeira fatia. **Rebuild do dev-client** necessário para testar no aparelho — some no build EAS que a ADR-0040 já pede. O bundle web cresce (ambas têm implementação web; `npm run build:web` vira gate da fatia). **Não** altera API, banco, modelo de dados, o `AnalysisEngine` nem a arquitetura de navegação. Abre a frente de **porte do design** (login → herói → demais telas), com os gates de sempre: `typecheck`, `check:contrast`, `check_forbidden_terms.sh` e smoke web. Relaciona ADR-0038 (cautela com dep nativa e casca própria), ADR-0027 (honestidade visual), ADR-0040 (build EAS pendente), ADR-0036 e ADR-0041 (cópia e controles sem função), e [Design/round1/README.md](Design/round1/README.md).

## ADR-0043 — Mensagem opcional no convite de vínculo: texto livre **cifrado**, limitado, **imutável** e sempre exibido como **citação atribuída**
**Status:** Proposta (2026-08-09) — vira Aceita no merge.
**Contexto:** O round 1 de design prevê, em duas telas, um recado do solicitante junto do convite: [Design/round1/convidar.html](Design/round1/convidar.html) tem o campo *"Mensagem (opcional)"* com o hint *"A pessoa vê essa mensagem junto do convite, com o seu nome"*, e [Design/round1/convites.html](Design/round1/convites.html) exibe a frase **entre aspas** no cartão do convite recebido. O `POST /care-links` de hoje aceita **só o e-mail** (ADR-0024). Esta é a fatia 3 da trilha de backend (P9). O convite é o momento em que uma pessoa decide entregar acesso aos próprios dados — dar contexto a essa decisão é justamente o que reduz aceite no escuro.

**[FATO] É dado pessoal novo, em texto livre, escrito por alguém sobre outra pessoa.** Diferente de tudo que `care_links` guarda hoje (ids, estado, carimbos de tempo). O exemplo do mockup é inócuo ("rotina de relaxamento"), mas o campo é livre: nada impede *"acompanhar seu quadro de insônia"*. Pela **ADR-0037**, a anotação do titular é cifrada em repouso por ser dado dele; seria incoerente cifrar o que a pessoa escreve sobre a própria sessão e deixar em claro o que um profissional escreve **sobre ela**.

**[FATO] A anti-enumeração da ADR-0024 já decide o destino da mensagem sem conta.** `CareService.solicitar` devolve `None` quando o e-mail não tem conta, e a rota responde **202 uniforme** de qualquer jeito. Logo, sem conta **nada é gravado** e a mensagem desaparece com o convite — não há caixa de entrada onde ela espere.

**[FATO] Reconvidar não cria linha nova.** Com vínculo vivo, `solicitar` devolve o existente **sem alterar nada**. Sem decisão explícita, isso já significa que a mensagem não é reescrita — e é a propriedade certa: quem lê um pedido e vai decidir sobre ele não pode ter o texto trocado por baixo.

**Decisão:**
1. **Campo `message` opcional** no `POST /care-links` e no `CareLinkResponse`, nos **dois sentidos** (médico→paciente e paciente→médico). Recusar por papel seria regra artificial: é o mesmo endpoint, e o mockup só desenhou o lado do profissional por ser o caso comum.
2. **Cifrada em repouso**, mesmo padrão e mesma primitiva da anotação (Fernet, `security/crypto.py`) — coluna `invite_message_encrypted` (binária, nula quando não há recado). O preço é não poder consultar por conteúdo, coisa que **não queremos poder fazer**.
3. **Teto de 500 caracteres, e o teto é decisão de produto, não de validação.** Quanto maior o campo, mais ele convida a virar prontuário; 500 cabe as três/quatro frases do design (o exemplo tem ~120) e não cabe um histórico. Poda antes de medir (`min_length` do Pydantic conta espaço em branco: `"   "` passaria) e vazio depois da poda vira **ausência**, não string vazia.
4. **Imutável depois de criada.** Não há endpoint para editar a mensagem, e reconvidar não a sobrescreve. Um pedido que a pessoa já leu não muda de texto enquanto ela decide.
5. **Só as duas partes leem**, e só enquanto o vínculo está vivo: `listar_do_usuario` já filtra por participação e exclui terminais (`revoked`/`declined`), então a mensagem some da vista junto com o convite que a carregava.
6. **Sempre exibida como citação atribuída** — aspas, com o nome de quem escreveu, como no mockup — e **nunca** como texto do sistema. Duas razões: (a) *sem claim clínica* (Medical/71) governa o que **nós** afirmamos; não cabe censurar o que um profissional escreve para o paciente dele, mas cabe garantir que ninguém confunda a frase com conteúdo do WaveAI; (b) **convite com texto de terceiro é vetor clássico de phishing** — então **texto puro, sem autolink e sem renderização de markup**. Em `<Text>` do RN não há interpretação de HTML e o autolink é *opt-in*: a decisão é **não ligar**.
7. **A UI continua sem poder afirmar entrega.** A resposta segue uniforme (ADR-0024); "enviamos sua mensagem para fulano" é tão proibido quanto "enviamos o convite" — a cópia de [convidar.html](Design/round1/convidar.html) não é portável ao pé da letra.

**Alternativas consideradas:** (a) **Guardar em claro** — rejeitado: é o único texto livre sobre uma pessoa no banco e o padrão cifrado já existe pronto (ADR-0037); o ganho seria só poder buscar, que não queremos. (b) **Sem limite / limite grande (2–5 mil)** — rejeitado: transforma o recado em espaço de anamnese, exatamente o que o enquadramento não-clínico evita. (c) **Permitir editar/reenviar com texto novo** — preterido: quebra a estabilidade do pedido que a pessoa está avaliando; se um dia for preciso, o caminho honesto é **cancelar e convidar de novo** (linha nova, novo ciclo de consentimento), não mutar a antiga. (d) **Só do profissional para o paciente** — rejeitado (item 1). (e) **Apagar a mensagem ao recusar/revogar** — preterido: o vínculo terminal já sai de todas as listagens (item 5), e apagar seletivamente destruiria a linha de auditoria sem ganho real; o erasure do titular continua sendo o caminho para remoção.

**Consequências:** uma coluna nova em `care_links` + **migration Alembic** (o container do compose não roda `alembic` no boot — subir com `--build` e aplicar `upgrade head`). Nenhuma mudança no `AnalysisEngine`, no `wave_eeg`, no modelo de `Result` nem no fluxo de consentimento; o estado do vínculo e quem pode o quê ficam **exatamente** como a ADR-0024 deixou. A fase A de front carrega os itens 6 e 7 como requisito das telas `app/doctor/invite.tsx` e `app/patient/invites.tsx`. Relaciona ADR-0024 (vínculo e anti-enumeração), ADR-0026 (cifragem em repouso), ADR-0037 (anotação cifrada como precedente), ADR-0027 (honestidade visual), ADR-0036 e Medical/71 (posicionamento não-clínico).

## ADR-0044 — Base dos fluxos por e-mail: interface `EmailSender` (console em dev, **fail-closed** em produção) e **token opaco de uso único** com propósito
**Status:** Proposta (2026-08-09) — vira Aceita no merge.
**Contexto:** Fatia 4 da trilha de backend (P9). As fatias 5 (verificação de e-mail + rate limit no cadastro) e 6 (recuperação de senha) precisam de duas coisas que o produto **não tem**: um jeito de mandar e-mail e um token de uso único. A **ADR-0041** já registrara os dois fluxos como deferidos "por dependência de envio de e-mail", e o fundador decidiu (2026-08-09) que **conta não verificada não entra** — o que faz o envio deixar de ser conveniência e virar caminho crítico. O provedor real de e-mail continua sendo item do **P5**; esta ADR decide a **fronteira** que permite construir as fatias 5 e 6 agora e trocar só o adapter depois.

**[FATO] Esta é a única fatia da trilha sem consumidor nos mockups.** Não há painel em `Design/round1/` que consuma "EmailSender": os consumidores são as fatias 5 e 6. Por isso o recorte é deliberadamente **mínimo** — só o que aquelas duas precisam —, para não entregar API que ninguém chama.

**[FATO] O mecanismo pedido já existe no repo, com outro nome.** O `RefreshToken` (ADR-0021) guarda **apenas o `token_hash`** (SHA-256 hex, `String(64)`, único e indexado), com `expires_at` e `used_at`, e o próprio `security/tokens.py` documenta *por que SHA-256 e não Argon2*: o token já é aleatório de alta entropia, não há dicionário a forçar, e a busca precisa ser determinística. O token de uso único é o mesmo mecanismo com outro propósito.

**[FATO] O rate limit de hoje é por processo.** O `SlidingWindowRateLimiter` (ADR-0023) é *in-memory*, com `TODO(#19)` para Redis. Com N réplicas, o limite efetivo é **N × limite**.

**Decisão:**
1. **`EmailSender` como `Protocol`**, com um `send(to, subject, body)` genérico. O adapter **não conhece a cópia do produto**: os textos das fatias 5 e 6 nascem junto delas, do lado da API. Trocar console por provedor real (P5) não deve tocar em texto nenhum.
2. **`ConsoleEmailSender` só em `development`.** Ele imprime destinatário e token — é literalmente a função dele em dev. Um adapter de produção loga **id do usuário e propósito, nunca o endereço nem o token**.
3. **Fail-closed em produção:** fora de `development`, sem provedor configurado, **a app não sobe** — mesmo padrão do `jwt_secret` e da chave Fernet (ADR-0023/0026). Cair no console em produção seria o pior dos mundos: token **em claro no log** e, como a fatia 5 bloqueia login sem verificação, **ninguém entra**, silenciosamente. Melhor falhar no boot que no primeiro cadastro.
4. **Token opaco de 48 bytes em link, não código de 6 dígitos.** Um código de 6 dígitos tem espaço de 10⁶ e **só** é seguro com rate limit apertado — exatamente a nossa peça fraca (limiter por processo, [FATO] acima). Um token opaco não é forçável nem sem rate limit nenhum.
5. **O link aponta para o app web; sem deep link nativo nesta fase.** Quem está no celular toca no link e verifica no navegador — provar posse de um endereço não precisa acontecer dentro do app, e *universal links* dependem do domínio e da configuração de loja que só existem no **P5**. Fica registrado como item do P5.
6. **Uma tabela `single_use_tokens` com coluna `purpose`** (`email_verification` | `password_reset`), não duas tabelas: a mecânica é idêntica e duplicá-la duplicaria o teste. O `purpose` compra uma propriedade real — **um token de verificação não funciona como reset de senha** — e ela vira teste.
7. **TTL por propósito: verificação 24 h, reset de senha 30 min.** A assimetria é proposital. Verificação a pessoa abre quando lê o e-mail. Reset é **vetor de tomada de conta**: janela curta é a defesa contra caixa comprometida ou aberta em máquina compartilhada.
8. **Emitir supersede o anterior.** Um token novo para o mesmo par (usuário, propósito) invalida os que ainda valiam — sem isso, "reenviar verificação" deixaria N tokens vivos por conta. A emissão aproveita para apagar os **expirados** daquele usuário: limpeza oportunista em vez de mais um job.
9. **Guardar só o hash.** O valor em claro existe no e-mail e na memória do processo que o gerou, nunca no banco — como o refresh (ADR-0021).

**Alternativas consideradas:** (a) **Código curto de 6 dígitos** — preterido pelo item 4; é a escolha natural quando existe rate limit distribuído, e pode ser reaberto **depois do Redis** (#19) se a fricção do link incomodar. (b) **Duas tabelas** (uma por fluxo) — rejeitado (item 6). (c) **TTL único para os dois fluxos** — rejeitado: trata um vetor de tomada de conta como se fosse um passo de cadastro. (d) **Console como fallback em produção** — rejeitado (item 3); é a falha silenciosa mais cara possível dado que login fica bloqueado sem verificação. (e) **Deep link nativo agora** — preterido (item 5): custo de domínio/loja que só o P5 paga. (f) **Reaproveitar a tabela `refresh_tokens`** com um campo de tipo — rejeitado: são ciclos de vida e semânticas de revogação diferentes (família/rotação vs. uso único), e misturá-los estragaria a leitura de segurança dos dois.

**Consequências:** tabela nova + **migration**; `security/tokens.py` ganha helpers **opacos genéricos** (`generate_opaque_token`/`hash_opaque_token`) e os do refresh viram casca fina sobre eles — sem mudança de comportamento, mas sem duas cópias do mesmo SHA-256. Configuração nova (TTLs, remetente, seleção de adapter). **Nenhum endpoint, nenhuma tela e nenhum texto de e-mail entram nesta fatia** — nascem nas fatias 5 e 6, com os fluxos que os usam. **Ressalva honesta:** o argumento *anti-flood* que motivou exigir verificação vale, hoje, na medida de um processo só — o limite efetivo é N × limite até o Redis (#19, P5). A **expiração de contas não verificadas** (consequência (c) da decisão do fundador) **não** é decidida aqui: é decisão de *quando e como varrer*, e cabe na fatia 5. Relaciona ADR-0021 (token opaco + só hash), ADR-0023 (fail-closed e rate limit), ADR-0026 (chave por ambiente), ADR-0024 (anti-enumeração, que as fatias 5 e 6 terão de honrar nos endpoints) e ADR-0041 (que deferira estes fluxos).

### Emenda à ADR-0044 (2026-08-09) — o design **já especificava** os dois fluxos: código de 6 dígitos, 10 minutos, tentativas e cooldown
**Status:** Proposta (2026-08-09) — vira Aceita no merge. Emenda os itens **4, 5 e 7** da ADR-0044; o resto segue valendo.

**Por que emendar:** a ADR-0044 afirma, como `[FATO]`, que a fatia 4 era *"a única fatia da trilha sem consumidor nos mockups"*. **É falso, e o erro é meu (Claude).** O round 1 especifica os dois fluxos, em *views* dentro de telas já existentes:
- **`Design/round1/criar-conta.html:413`** — "Verifique seu e-mail", **passo 2 de 3**: **código de 6 dígitos**, *"vale por 10 minutos"*, "Reenviar código" com **contagem regressiva**, e "Usar outro e-mail".
- **`Design/round1/login.html:416`** — recuperação em 3 passos: *"Enviaremos um **link e um código** de 6 dígitos válidos por 10 minutos"*, e-mail **mascarado** (`vo•••@exemplo.com.br`), digitação do código, nova senha.

A decisão original (link com token opaco, 24 h / 30 min) foi tomada sobre esse fato errado. **Erro de método:** afirmei ausência sem enumerar — olhei a lista de arquivos, não achei "verificar-email.html" e concluí que não existia; mas **cada tela do round 1 carrega várias *views* no mesmo HTML**. É a mesma falha da varredura de glifos (P8-b): curar onde olhar em vez de varrer o conjunto. Regra que fica: *"não há mockup para isto"* só se afirma depois de varrer o **conteúdo** dos 12 arquivos.

**A objeção técnica original também estava mal ancorada.** Argumentei que 6 dígitos (10⁶) "só é seguro com rate limit apertado, e o nosso é por processo". A defesa correta de um código **não é o limiter em memória** — é um **contador de tentativas na própria linha do token**, que é estado de banco e portanto vale igual com N réplicas. Com TTL curto + tentativas por token + cooldown de reenvio, o código de 6 dígitos é o desenho padrão e é seguro. E o TTL longo que defendi pressupunha um fluxo que o design não tem: ali a verificação acontece **com a pessoa na tela**, no meio do cadastro.

**Decisão (emenda):**
1. **(emenda o item 4)** O segredo é um **código numérico de 6 dígitos**, digitável, como o design mostra. Guardado **hasheado**, como o token opaco.
2. **(emenda o item 5)** O **token opaco não morre**: a recuperação de senha (fatia 6) pede *"link e código"*, e o link é o token opaco. A linha passa a carregar **as duas formas do mesmo segredo** — verificação usa só o código; recuperação usa os dois. Nenhuma das duas colunas fica sem consumidor.
3. **(emenda o item 7)** **TTL de 10 minutos para os dois propósitos**, como o design diz. A assimetria 24 h/30 min some: com a verificação acontecendo na própria tela, o prazo longo não tinha função, e o curto já era o certo.
4. **Contador de tentativas por token** (`attempts`): esgotado o limite, o token **queima**. É a defesa real contra adivinhação de 6 dígitos, e ela é distribuída por construção (mora no banco, não na memória do processo).
5. **Cooldown de reenvio** por par (usuário, propósito), derivado do `created_at` do último token vivo — também estado de banco. O protótipo mostra 42 s; adotamos **60 s**, número redondo (o valor do mockup é de demonstração).

**Consequências:** `single_use_tokens` ganha `code_hash` e `attempts`; a configuração troca os dois TTLs por um só. O que a ADR-0044 decidiu e **continua de pé**: guardar só hash, uma tabela com `purpose`, propósito trocado não vale (nem queima), emitir supersede, limpeza oportunista, `EmailSender` com console em dev e **fail-closed** fora dele. A ressalva do rate limit por processo (#19) também continua — mas ela deixa de ser o que sustenta a segurança do código, que agora se apoia no contador de tentativas.

### Segunda emenda à ADR-0044 (2026-08-09) — semântica da recuperação de senha: derruba sessões e **vale como prova de posse**
**Status:** Proposta (2026-08-09) — vira Aceita no merge. Complementa a ADR-0044 e sua primeira emenda; não altera nada do que elas decidiram.

**Contexto:** fatia 6 da trilha (P9), a que fecha os fluxos por e-mail. A mecânica já estava toda decidida — token com duas formas (código digitável + valor opaco para o link), TTL de 10 min, tentativas por token, cooldown, respostas uniformes. É **aqui** que o valor opaco ganha seu consumidor: `Design/round1/login.html:416` pede *"link e um código"* na mesma tela. O que falta decidir é a **semântica** do ato, não o mecanismo.

**Decisão:**
1. **Redefinir a senha marca o e-mail como verificado.** É a mesma prova: quem digitou o código que chegou ao endereço demonstrou controlar o endereço. Sem isto haveria um beco sem saída **criado por nós**: com o gate ligado, uma pessoa não verificada que recupera a senha continuaria sem entrar — recuperaria o acesso e bateria na mesma porta. Não afrouxa nada: o caminho exige exatamente o que a verificação exige.
2. **Redefinir a senha revoga todas as sessões**, como o `change_password` já faz — e aqui o motivo é mais forte: recuperar senha é o gesto de quem perdeu o controle da conta, e sessão antiga sobrevivendo anularia o gesto. **Diferença do `change_password`:** lá quem trocou recebe um par novo na hora (não é expulso do próprio aparelho); aqui **não se emite sessão** — a pessoa não está autenticada e o design a manda de volta para o login (*"Senha atualizada · Entre com a sua nova senha"*).
3. **A senha nova precisa ser diferente da atual** — e só isso. O mockup escreve *"uma senha que você ainda não usou por aqui"*, o que exigiria **guardar histórico de hashes**: dado pessoal novo, com custo permanente, para um ganho pequeno. Recusar a igual à atual sai de graça (o hash vigente está ali). **A cópia da tela muda para "diferente da senha atual"** na fase A: quando o mockup promete mais do que o produto faz, muda-se a promessa — não se finge (ADR-0027, mesma postura da honestidade visual).

**Alternativas consideradas:** (a) **Não verificar o e-mail no reset** — rejeitado (item 1: cria bloqueio sem saída). (b) **Emitir sessão ao final do reset** — preterido: contraria o desenho da tela e daria sessão a quem acabou de provar posse do e-mail, mas não da senha antiga; mandar para o login é mais conservador e é o que o design pede. (c) **Histórico de senhas** — preterido (item 3); reabre se algum dia houver requisito externo que o exija.

**Consequências:** duas rotas novas (`/auth/forgot-password`, `/auth/reset-password`), ambas com resposta **uniforme** (ADR-0024) e rate limit por IP; nenhuma tabela nova, nenhuma migration — a fatia 4 já criou tudo. **Fora do escopo, registrado:** o mockup mostra um medidor com **três** requisitos de senha (≥8 caracteres, uma letra, um número) e a API exige só o comprimento; casar isso mexe **também** no cadastro e invalidaria toda senha de fixture do repo (as de teste não têm dígito), então é decisão própria, de outra fatia.

## ADR-0045 — Compartilhamento ao vivo é **ato do titular, por sessão**: interruptor que nasce desligado e corta na hora
**Status:** Proposta (2026-08-09) — vira Aceita no merge. **Complementa a ADR-0039** (espectador ao vivo); não revoga nada dela.

**Contexto:** desde o porte do design (P7) havia um ponto aberto: o round 1 afirma, em **quatro** telas, que o titular liga e desliga o compartilhamento ao vivo — e isso **não existia**. Hoje quem decide assistir é o profissional, via CareLink ativo, com auditoria (ADR-0039); o titular não tem voz na decisão. O fundador decidiu (2026-08-09) **construir o controle**.

**[FATO] O design é unânime e específico sobre a semântica:**
- `Design/round1/convidar.html:318` — "Acompanhar ao vivo **só se ela ligar** esse aceite separado, **sessão a sessão**";
- `Design/round1/convites.html:268` e `:301` — "O acompanhamento ao vivo é um **aceite separado**";
- `Design/round1/painel-profissional.html:410` — "Disponível porque Ana ativou o compartilhamento ao vivo — **ela pode desligar isso a qualquer momento**";
- `Design/round1/perfil.html:351` — "um aceite separado, que você **liga e desliga na própria sessão**".

**[FATO] O design promete o controle e não o desenha.** `estado-ao-vivo.html` — a tela onde o interruptor viveria — não tem `switch`, `toggle`, `checkbox` nem `aria-pressed`; seus cartões são onda, qualidade, eSense, bandas, sessão guiada e nota. A **UI do controle é nossa**, na linguagem "Maré" já portada (balde "telas que faltam").

**Decisão:**
1. **O compartilhamento é por sessão e nasce DESLIGADO.** É o que as quatro telas afirmam. **Consequência aceita:** quem quiser compartilhar sempre terá de ligar a cada sessão. Um "lembrar minha escolha" **enfraqueceria a promessa** — "sessão a sessão" deixaria de ser verdade —, então fica fora; se o atrito incomodar no uso real, que seja decisão informada e não atalho.
2. **Um interruptor só, não um por profissional.** O CareLink já decide **quem**; o interruptor decide **se**. Consequência: com dois profissionais vinculados, ligar libera para os dois. Uma matriz por profissional é UI que o design nunca mostrou e que, com uma ou duas pessoas vinculadas, é mais ruído que controle.
3. **Três portas, e nenhuma some.** Assistir ao vivo exige **CareLink ativo** (ADR-0024) **+** o titular ter ligado **nesta sessão** (esta ADR) **+** o profissional abrir deliberadamente, com auditoria (ADR-0039). O controle novo **soma**; não substitui nenhuma das outras.
4. **O corte mora no `LiveBus`, não em cada gerador SSE.** O barramento passa a distinguir a fila do **titular** da fila do **espectador** e só entrega ao espectador quando a sessão está compartilhada. Um ponto de estrangulamento único é o que dá para provar correto e testar — a regra espalhada por cada endpoint é a que apodrece.
5. **Desligar corta na hora.** Alternar publica um evento de controle **apenas para os espectadores**; ao receber `shared: false`, o stream do profissional **encerra**. O stream do titular não é afetado — é o dado dele.
6. **A verdade é o banco, não a memória.** `capture_sessions.live_sharing_enabled` é a fonte; quem publica a janela lê o estado da sessão que já tem em mãos. O barramento **não guarda espelho** do estado — assim um reinício da API não deixa o produto compartilhando (ou bloqueando) por engano.
7. **Cada liga/desliga é registrado** (`live_share_events`), não só o estado final. Duas colunas guardariam apenas onde parou; se houver disputa ("desliguei às 9h14"), quem responde é o **histórico**. É a mesma postura de auditoria da ADR-0037/0039, aqui registrando o ato do **titular sobre o próprio dado**.
8. **O profissional sabe que não está compartilhado.** O evento `status` do SSE leva `shared`, e o painel **não oferece** "Acompanhar ao vivo" quando não há compartilhamento — em vez de oferecer e falhar (ADR-0027: a tela não afirma o que não é verdade). Não vaza nada: quem recebe já tem vínculo ativo.

**Alternativas consideradas:** (a) **Preferência de conta ("sempre compartilhar")** — rejeitada (item 1). (b) **Um interruptor por profissional** — preterida (item 2); reabre se o número de vínculos por titular crescer. (c) **Filtrar em cada endpoint SSE** em vez de no barramento — rejeitada (item 4). (d) **Espelhar o estado de compartilhamento na memória do barramento** — rejeitada (item 6): um reinício deixaria o espelho vazio com o banco dizendo "ligado", e o produto passaria a bloquear (ou, num desenho pior, a liberar) sem que ninguém tivesse decidido. (e) **Recusar a conexão do espectador com 403 quando não compartilhado** — preterida: abrir o stream e dizer `shared: false` deixa a tela reagir no instante em que o titular liga, sem reconexão.

**Consequências:** coluna nova em `capture_sessions`, tabela `live_share_events` e **migration**; `LiveBus.publish` passa a receber se a sessão está compartilhada, e `subscribe` passa a distinguir titular de espectador; rota `PUT /me/sessions/{id}/live-sharing`. **Mudança de comportamento:** um profissional com CareLink ativo **deixa de ver** a captação ao vivo até o titular ligar o interruptor — por isso backend e UI entram **no mesmo PR** (decisão do fundador), para o produto não passar por um estado em que o controle existe sem o meio de acioná-lo. Nada disso toca o `AnalysisEngine`, o `wave_eeg`, o raw (que segue não trafegando, ADR-0025) nem o consentimento de guarda (ADR-0026) — são eixos independentes: guardar resultado e assistir ao vivo são decisões diferentes. Relaciona ADR-0039, ADR-0024, ADR-0027 e Medical/72.

### Terceira emenda à ADR-0044 (2026-08-10) — **troca do e-mail da conta**: quem prova posse é o endereço novo
**Status:** Proposta (2026-08-10) — vira Aceita no merge. Complementa a ADR-0044 e suas duas emendas; não altera nada do que elas decidiram.

**Contexto:** a conta tinha como editar nome e senha, e **não** o e-mail — que é justamente o identificador de login e o canal de recuperação. O mockup já especifica o fluxo: `Design/round1/perfil.html:293`, no campo de e-mail (marcado `readonly`), diz *"Para trocar o e-mail, confirmaremos o novo endereço com um código."* Ou seja, o design decidiu **código** (não link) e confirmação no endereço **novo** — mas **não desenha a tela do fluxo**, como já acontecera com o interruptor da ADR-0045. A mecânica de segredo por e-mail já existe inteira desde a ADR-0044; o que falta decidir é a semântica do ato.

**Decisão:**
1. **Quem prova posse é o endereço NOVO.** O código vai para lá, e a troca só acontece quando ele volta digitado. O endereço antigo já provou o que tinha a provar; o risco de uma troca é ir parar numa caixa que a pessoa não controla — digitada errado ou digitada por um invasor.
2. **A troca pendente é o token.** `single_use_tokens` ganha `new_email` e o propósito `email_change`. Alternativa rejeitada: um `pending_email` em `users` — ele apodreceria sozinho quando o token expirasse, e obrigaria a manter duas linhas em acordo. Prazo, uso único, tentativas e supersede já são do token; a troca pendente tem exatamente esse ciclo de vida.
3. **Exige a senha atual**, como o `POST /auth/password`. Mais do que lá: trocar o e-mail move o canal de recuperação e leva a conta junto. Um access token vazado não pode bastar.
4. **O endereço ATUAL é avisado** de que a troca foi pedida, e o aviso **não** repete o endereço de destino. É o único sinal que chega a quem está perdendo a conta; e se quem pediu foi um invasor, não faz sentido a vítima receber pronto o endereço dele — nem entregar o destino a terceiros caso a caixa antiga esteja comprometida. O aviso sai **independentemente** de o destino estar livre: se dependesse disso, a presença do aviso viraria o oráculo que o item 5 evita.
5. **Resposta uniforme (ADR-0024).** Pedir a troca para um endereço que já tem conta responde **igual** a pedir para um livre — senão qualquer pessoa logada teria um oráculo de "este e-mail tem WaveAI?", a mesma brecha que o `409` do cadastro tinha antes da P9-e. No caso ocupado **nenhum token é emitido** e quem é avisado é a **dona do endereço**, por e-mail.
6. **A disponibilidade é conferida DUAS vezes** — no pedido e na confirmação. Entre as duas há até 10 minutos, tempo de alguém cadastrar o endereço. Na confirmação a recusa é específica (`409`), e isso não vaza nada: só chega ali quem controla a caixa, e o token só foi emitido porque o endereço estava livre.
7. **A troca NÃO derruba as sessões** — diferente de trocar ou redefinir a senha. A credencial não mudou, e quem chegou até aqui precisou dela; derrubar não atrapalharia um invasor que sabe a senha, só expulsaria o titular do próprio aparelho.
8. **Confirmar renova a marca de verificação.** Quem digitou o código que chegou ao endereço novo provou controlá-lo; pedir uma segunda verificação depois disso seria cobrar a mesma prova duas vezes — e, com o gate ligado, deixaria a pessoa do lado de fora com o endereço que ela acabou de provar.
9. **Pedir o próprio endereço é recusado com mensagem clara** (`400`), não com a resposta uniforme: a pessoa conhece o próprio e-mail, então aqui não há nada a proteger — e mandá-la esperar um código que não vem seria mentir por omissão.

**Alternativas consideradas:** (a) **Confirmar no endereço antigo** — rejeitada (item 1): não protege contra o erro mais comum, que é digitar errado o destino. (b) **Link em vez de código** — rejeitada: o design pede código, e quem pede a troca está logado, na tela onde vai digitá-lo; um link só ampliaria a superfície. (c) **`pending_email` em `users`** — rejeitada (item 2). (d) **Responder `409` quando o endereço já tem conta** — rejeitada (item 5). (e) **Derrubar as sessões** — rejeitada (item 7). (f) **Exigir também confirmação no endereço antigo (dupla confirmação)** — preterida: dobraria o atrito de um fluxo raro para proteger contra um cenário em que o atacante já tem sessão **e** senha; o aviso do item 4 cobre a detecção, e a resposta a esse cenário é trocar a senha.

**Consequências:** coluna `new_email` e valor de enum novos em `single_use_tokens`, com **migration** (o `downgrade` não remove o rótulo do enum — o Postgres não sabe fazer isso sem recriar o tipo); rotas `POST /auth/email` e `POST /auth/email/confirm`; três corpos de e-mail novos. Cooldown, TTL, contagem de tentativas e supersede são os mesmos da ADR-0044 — inclusive o cooldown é o que impede usar a rota para inundar a caixa de um terceiro. **A tela fica de fora desta fatia**: o design promete o fluxo e não o desenha, então ela nasce como as do balde "telas que faltam". Nada disso toca `AnalysisEngine`, `wave_eeg`, consentimento (ADR-0026) ou vínculos — `care_links` guarda id, nunca e-mail, então trocar de endereço não desfaz acompanhamento nenhum. Relaciona ADR-0044 (e emendas), ADR-0024, ADR-0023 e ADR-0041 (cadastro sem KYC: provar posse de um endereço não é identificar a pessoa).

## ADR-0046 — Cópia dos dados no celular: **share sheet do sistema**, não e-mail
**Status:** Proposta (2026-08-11) — vira Aceita no merge.

**Contexto:** a portabilidade (Medical/72) já existe no servidor desde a ADR-0026 — `GET /me/results/export` devolve tudo em JSON aberto — e o **navegador** já entrega o arquivo (download direto, `dataExport.web.ts`). No **nativo** não havia entrega: `dataExport.ts` levantava erro e a tela escondia o botão, porque salvar ou compartilhar arquivo no iOS/Android exige dependência nativa. Na prática, quem usa o app pelo celular não exercia um direito que o servidor já garante.

**[FATO] O design pede outra coisa.** `Design/round1/consentimento.html:357` diz: *"Pedir uma cópia dos resultados — **Enviamos um arquivo com suas sessões e notas para o seu e-mail**."* Não é download nem compartilhamento: é anexo de e-mail.

**Decisão:**
1. **A entrega é por share sheet do sistema**, com `expo-file-system` + `expo-sharing`. A pessoa escolhe o destino (Arquivos, nuvem, o e-mail dela se quiser); nós não escolhemos por ela.
2. **NÃO enviamos por e-mail**, contrariando o mockup. Quatro razões, e a primeira basta: (a) ciframos a nota de contexto em repouso (ADR-0037) e auditamos cada leitura — mandar o conjunto em claro por infraestrutura de terceiros desfaz por e-mail o cuidado que temos no banco; (b) o anexo vira **artefato durável de exfiltração**: quem tomar a caixa de entrada leva tudo, para sempre, sem tocar na nossa trilha; (c) o `EmailSender` (ADR-0044) é texto puro — anexo depende do provedor real do P5; (d) a LGPD exige **entregar** os dados, não entregá-los por e-mail. **A cópia da tela muda para descrever o que o produto faz** — quando o mockup promete o que não devemos cumprir, muda-se a promessa (mesma postura da 2ª emenda à ADR-0044).
3. **Duas dependências novas, custo de build zero.** São módulos do próprio SDK do Expo, e o app **já** embarca dois módulos nativos de BLE e já exige build EAS (ADR-0040): não estamos abrindo uma porta nova, estamos usando uma que já está aberta.
4. **O arquivo nasce e morre no armazenamento privado do app.** Escrito em `Paths.cache`, apagado no `finally` — inclusive quando a pessoa cancela. Nunca vai para galeria ou pasta pública, e dado do titular não fica esquecido no aparelho por causa nossa.
5. **Sem share sheet, sem botão.** `Sharing.isAvailableAsync()` decide; falso ⇒ a tela não oferece, em vez de oferecer algo que falha (mesma postura do `capturaDisponivel()` e do ADR-0027).
6. **Nenhuma rota nova, nenhum dado novo, nenhuma migration.** É o mesmo `GET /me/results/export`, sem recorte de período (portabilidade é tudo), e a trilha continua gravando `EXPORTED` — o caminho nativo não cria um jeito de sair sem registro.
7. **A confirmação na tela não afirma entrega.** O share sheet resolve igual se a pessoa concluir ou cancelar; dizer "salvo" seria afirmar o que não sabemos (ADR-0027).

**Alternativas consideradas:** (a) **e-mail com anexo**, como o mockup — rejeitada (item 2); (b) **manter só o web** — rejeitada: deixa o direito de portabilidade sem caminho prático para quem usa o celular, que é o alvo do produto; (c) **`expo-mail-composer`** (abrir o cliente de e-mail com o anexo já montado) — preterida: é o mesmo destino de risco do item 2, só que iniciado pela pessoa; se ela quiser, o próprio share sheet oferece o app de e-mail dela; (d) **escrever em `Paths.document`** em vez de `cache` — rejeitada (item 4): guardaria uma cópia integral dos dados no aparelho por tempo indeterminado.

**Consequências:** `expo-file-system` e `expo-sharing` no `package.json` (o `expo-sharing` entra também como config plugin no `app.json`); `dataExport.ts` deixa de ser um stub; a tela de consentimento passa a consultar a capability e a usar cópia por plataforma. **O caminho nativo só pode ser validado num build EAS** — no web e no Expo Go ele não roda —, então esta fatia entra **sem verificação do gesto real**, junto da validação de BLE que já está pendente (ADR-0040). Relaciona ADR-0026 (o que existe para exportar), ADR-0037 (por que não por e-mail), ADR-0038 (capability por plataforma), ADR-0040 (o app já é build próprio) e Medical/72.

## ADR-0047 — Exclusão de conta: apaga tudo do titular **na hora**, e a trilha de leitura de terceiros sobrevive **pseudonimizada**
**Status:** Proposta (2026-08-23) — vira Aceita no merge.

**Contexto:** a exclusão da conta **não existe** (varridos `excluir conta`, `delete_account`, `apagar conta`, `encerrar conta` no repo inteiro: zero ocorrências). Com o cadastro aberto ao público e o app indo para a Play Store, ela deixa de ser conveniência: é exigência da loja para app com login, e é o direito de eliminação da LGPD. A Política de Privacidade publicada em 2026-08-23 **diz explicitamente que o botão não existe** — dizer a verdade foi o certo, e esta ADR é o que faz o parágrafo sumir.

**[FATO] apurado antes de decidir:** **todas** as chaves estrangeiras para `users.id` são `ondelete="CASCADE"` — inclusive as tabelas de auditoria, e **nos dois lados**. No lado do titular isso é o desejado: a conta some e leva a própria trilha. No lado do **ator** é um buraco: hoje, apagar a conta de um profissional apagaria todo evento em que ele foi o ator, **inclusive na trilha de outras pessoas**. Quem é auditado apagaria a própria auditoria, e o titular perderia a evidência de quem leu os dados dele — o oposto do que a **ADR-0037** existe para garantir.

**Decisão:**
1. **Exclusão imediata e definitiva.** Confirmou, apagou. Sem carência, sem conta "desativada": é o que a tela consegue prometer com honestidade, é o que menos guarda dado de quem pediu para sair, e casa com o `DELETE /me/results`, que já é imediato. Carência exigiria estado novo e uma varredura agendada — máquina que a operação ainda não tem, e prometer prazo sem quem o cumpra seria afirmar o que não é verdade (ADR-0027).
2. **Confirmação por senha.** A rota exige a senha atual. É ação irreversível: provar que é a pessoa, e não alguém num aparelho destravado, é o mínimo. Reaproveita a verificação que o login já faz; erro devolve a mesma resposta genérica de credencial inválida.
3. **A trilha de leitura de terceiros sobrevive, pseudonimizada.** Nas três trilhas de **leitura** — `result_access_events`, `annotation_access_events`, `live_view_access_events` — o `actor_user_id` passa a ser **anulável**, com `ON DELETE SET NULL`, e ganha um `actor_pseudonym`. Ao excluir uma conta, gera-se **um** identificador aleatório para ela e ele é gravado nas linhas em que essa conta foi ator **na trilha de outra pessoa**; o vínculo com o usuário é desfeito. A trilha do titular continua dizendo *quando*, *quantos* e *que era o mesmo ator*, sem dizer *quem*.
4. **`care_link_events` segue o vínculo, e não é pseudonimizado.** Ele já cascateia de `care_links` ([models/care_link.py:132](services/api/app/models/care_link.py:132)): quando uma das partes some, o vínculo some e sua história vai junto. Vínculo com uma parte a menos não é vínculo, e preservar a história de um acordo que não existe mais não serve ao titular restante. `live_share_events` não entra porque **não tem ator**: só o titular liga e desliga ([models/live_share.py:31](services/api/app/models/live_share.py:31)).

**O que se abre mão, explicitamente:** (a) **não há volta.** Quem clicar por engano perde tudo, e nenhum suporte poderá restaurar — é o preço de não guardar dado de quem pediu para sair, e a tela tem de dizer isso antes, não depois. (b) O titular que ficar **não saberá mais quem** foi o profissional que leu seus dados, se aquela conta for excluída: sobra "uma conta encerrada", com datas e contagens. Preserva-se a evidência de **que houve leitura**, não a identificação de quem a fez — e entre perder a evidência inteira e perder o nome, perder o nome é o dano menor para quem ficou. (c) O pseudônimo é gerado **na exclusão**, então duas contas diferentes nunca colidem, mas também não há como reconciliar uma conta encerrada com registros fora dessas tabelas — o que é o ponto.

**Alternativas consideradas:** (a) **manter o CASCADE em tudo** — preterida: é o buraco descrito no [FATO]; (b) **impedir a exclusão enquanto houver vínculo ativo** — rejeitada: não resolve os eventos passados e cria um caminho em que a pessoa não consegue exercer um direito por causa de um vínculo que ela talvez nem lembre; (c) **anonimizar a conta em vez de apagar** (manter a linha com dados nulos) — preterida: eliminação é o direito pedido, e uma linha remanescente com id estável continua sendo um identificador; (d) **30 dias de carência** — preterida pelo fundador em 2026-08-23, pelo motivo do item 1.

**Consequências:** rota `DELETE /me` exigindo senha; `AccountService` com a exclusão em uma transação (pseudonimizar, depois apagar o usuário — nesta ordem, senão o CASCADE leva as linhas antes de elas serem preservadas); **migration** tornando `actor_user_id` anulável e trocando o CASCADE por `SET NULL` nas três trilhas de leitura, mais a coluna `actor_pseudonym`; a leitura dessas trilhas passa a tratar ator nulo. A tela do perfil ganha a ação, com senha e aviso de irreversibilidade, em fatia própria. O parágrafo "a exclusão da conta ainda não tem botão" **sai da Política de Privacidade** quando a tela entrar — e não antes, porque até lá ele é verdade. Relaciona ADR-0037 e suas emendas (a trilha que esta decisão protege), ADR-0026 (consentimento e direitos), ADR-0027 (não prometer o que não se cumpre), ADR-0024 (a rota é autenticada e não vira oráculo) e Medical/72 §3.

## ADR-0048 — Aceite dos Termos: **caixa explícita no cadastro**, versão e data guardadas; sem gate retroativo
**Status:** Proposta (2026-08-23) — vira Aceita no merge.

**Contexto:** os Termos de Uso e a Política de Privacidade passaram a existir em 2026-08-23, publicados em rota pública e linkados no cadastro. O que **não** existe é prova de que alguém os aceitou: a tela diz "ao criar a conta, você concorda com…", e isso é aceite implícito. Com cadastro aberto ao público e app na Play Store, guardar **o que** e **quando** a pessoa aceitou deixa de ser detalhe. O produto já tem o padrão pronto para isto: o **consentimento** (ADR-0026) guarda `consent_version` + `consent_given_at` e recusa versão desatualizada com 409.

**Decisão:**
1. **Caixa explícita no cadastro**, obrigatória. Marcar é um ato; ler a frase não é. O botão de criar conta só age com a caixa marcada.
2. **`accepted_terms_version` + `accepted_terms_at` no usuário**, espelhando o consentimento. O app manda a versão que **exibiu**; se não bater com a vigente no servidor, a API recusa com **409**, como o consentimento já faz — aceitar um texto que mudou desde que a tela abriu não é aceite informado.
3. **O backend é a fonte da verdade da versão vigente**, num módulo próprio (`app/legal.py`), no mesmo espírito do `app/consent.py`. Duplica o número que também vive no app — a mesma duplicação que o termo de consentimento já tem, e pela mesma razão: o cliente informa o que mostrou, o servidor decide se aceita.
4. **Guardamos a versão dos Termos, uma só.** A Política de Privacidade é parte deles por referência — o próprio texto diz isso —, então um número responde pelos dois e evita dois campos que podem divergir sem que ninguém perceba.
5. **Sem gate retroativo nesta fatia.** Contas anteriores ficam com o campo **nulo**, e ninguém é interrompido ao entrar. A coluna é anulável de propósito: nulo significa "não temos registro", que é a verdade, e não "recusou".

**O que se abre mão, explicitamente:** a Política publicada promete que, mudando de forma material, *"avisaremos no aplicativo"* — e esta fatia **não constrói esse aviso**. Enquanto as únicas contas anteriores forem as de teste e a do próprio fundador, o custo é zero; deixa de ser zero no dia em que houver gente de fora e os Termos mudarem. Fica registrado como lacuna no `Documentation/15`, e não como algo resolvido. Também se abre mão de saber o que os titulares atuais aceitaram: nulo é nulo, e **não** será preenchido por suposição — inventar um aceite que ninguém deu seria pior que não ter registro.

**Alternativas consideradas:** (a) **aceite implícito, só a coluna** — preterida: registra a data sem registrar um ato, e é o que já existia de fato; (b) **gate para contas antigas e para toda troca de versão** — preterida pelo fundador em 2026-08-23 por tamanho: exige tela de bloqueio, rota própria e o risco de trancar alguém fora; entra quando houver usuário de fora; (c) **dois campos, um para Termos e outro para Política** — preterida pelo item 4; (d) **backfill das contas existentes como se tivessem aceitado** — rejeitada: seria fabricar consentimento.

**Consequências:** duas colunas anuláveis em `users` + **migration**; `app/legal.py` com `TERMS_VERSION`; `RegisterRequest` ganha o campo e a rota passa a devolver **409** para versão desatualizada — sem tocar a resposta **uniforme** de e-mail já cadastrado, que continua sendo 202 (ADR-0024: a recusa aqui é sobre o texto, nunca sobre o endereço); caixa nova na tela de cadastro. Não altera consentimento, papéis, vínculos nem o `AnalysisEngine`. Relaciona ADR-0026 (o padrão copiado), ADR-0041 (cadastro sem KYC — provar aceite não é identificar ninguém), ADR-0024 (anti-enumeração), ADR-0027 (a tela não pode dizer que registrou o que não registrou) e ADR-0047.

## ADR-0049 — Hospedagem: **serviços gerenciados gratuitos que escalam a zero**, em São Paulo, com **uma instância só**; sem servidor próprio
**Status:** Proposta (2026-08-23) — vira Aceita no merge.

**Contexto:** com o cadastro aberto ao público e o app indo para a Play Store, o produto precisa de um endereço que responda **sempre** — a loja exige a Política de Privacidade numa URL pública acessível sem login, e um app cujo backend está fora do ar é reprovado na revisão. Até aqui o WaveAI só rodou em `docker compose` local. A intenção inicial do fundador era ligar a nuvem **apenas em eventos**, o que colide de frente com publicar na loja. O crédito disponível é **Azure for Students, US$ 100 por 12 meses** — cerca de **US$ 8/mês**, que não paga um par API + banco gerenciado ligado o mês inteiro, e que **expira**: um app publicado não pode depender de uma data de validade. O uso real desta fase é de **uma a duas pessoas simultâneas**.

**[FATO] apurado antes de decidir (2026-08-23):**
- **Oracle Cloud Always Free**, o candidato óbvio (Ampere = arm64, rodaria nossos `python:3.11-slim` sem tocar nas imagens), **cortou o Always Free A1 de 4 OCPU/24GB para 2 OCPU/12GB em 15/06/2026 sem anúncio** — usuários descobriram quando as instâncias foram desligadas. Pior para nós: a política de **reclamação por ociosidade** recupera instâncias com CPU, rede e memória abaixo de 20% no percentil 95 durante 7 dias. Com uma ou duas pessoas usando, **o nosso perfil é o perfil ocioso**: a Oracle nos desligaria justamente por sermos pequenos.
- **Cloudflare Tunnel com hostname estável exige domínio próprio com DNS gerenciado pela Cloudflare.** O *quick tunnel* (`trycloudflare.com`) dispensa domínio, mas a URL muda a cada reinício — inútil numa ficha de loja.
- O **fan-out ao vivo é em memória do processo**: o WebSocket `/stream` recebe e os SSE `/me/live` e `/patients/{id}/live` distribuem. O **rate limiter também é em memória** ([api/deps.py:35](services/api/app/api/deps.py:35), ADR-0023). Ambos só estão corretos com **um processo**.
- O container da API **não roda `alembic` no boot**: migrar é passo explícito, e continuará sendo.

**Decisão:**
1. **Produção são três serviços gerenciados gratuitos, todos em região brasileira**, e não um servidor nosso: **Cloudflare Pages** para o estático (site web e as rotas `/legal/*`), **Google Cloud Run** em `southamerica-east1` para a API e a Analysis, **Neon** em `sa-east-1` para o Postgres. Ser pequeno deixa de ser um risco de desligamento e passa a ser o caso de uso: escalar a zero é o modelo desses serviços, não um castigo. Custo recorrente: **R$ 0** mais o domínio.
2. **O estático é a camada que nunca dorme.** A Política e os Termos ficam no Pages, servidos de CDN, sem cold start e **sem depender da API**. Se o backend cair, a URL exigida pela loja continua no ar. É a única parte do sistema com esse requisito, e ela é a mais barata de garantir.
3. **`max-instances = 1` na API — correção, não economia.** Com duas instâncias, o produtor do WebSocket e o espectador do SSE caem em processos diferentes e o profissional **não vê nada, sem erro e sem log óbvio** (ADR-0039 e ADR-0045 deixariam de valer na prática). A mesma trava mantém o limite de 5 tentativas/60s do login honesto. A dívida do Redis ([deps.py:35](services/api/app/api/deps.py:35)) segue **adiada com justificativa**, não esquecida: ela volta a ser bloqueante no dia em que precisarmos de uma segunda instância.
4. **A migração é passo do pipeline, nunca do boot.** Um job dedicado roda `alembic upgrade head` entre construir a imagem e publicar a revisão. Migrar no boot seria pior mesmo hoje, e insustentável amanhã: duas instâncias subiriam a mesma migração ao mesmo tempo.
5. **Domínio próprio: `waveai.tec.br`, registrado no Registro.br**, com DNS delegado à Cloudflare. Decidido e registrado pelo fundador em 2026-08-23. Um endereço `*.a.run.app` numa ficha de loja não passa credibilidade, e o `.tec.br` custa por volta de R$ 40/ano **estáveis** — diferente dos genéricos promocionais, cujo primeiro ano barato esconde renovação dez vezes maior. Delegar o DNS à Cloudflare também deixa a porta aberta para proxy ou túnel no futuro sem trocar de fornecedor. **Cuidado operacional:** o Registro.br só considera o domínio publicado quando pelo menos dois servidores de nome respondem por ele — trocar a delegação e não configurar a zona deixa o domínio em processamento, sem erro visível.
6. **O Raspberry Pi 5 fica fora de produção.** Ele existe, tem 8GB, e a proposta anterior era usá-lo como base 24/7 — foi **preterida**. O armazenamento é **microSD**: Postgres nele sofre escrita aleatória constante de WAL, o cartão morre em meses e o modo de falha é **corrupção silenciosa**, não erro limpo. Somado a CGNAT, DDNS, certificado e backup — operação que teríamos de construir e manter — o Pi custaria mais trabalho que a nuvem gratuita e entregaria menos garantia. Ele segue útil como **ambiente de ensaio local**, onde corromper um cartão não custa nada.
7. **A Azure Students não é um segundo nó ativo.** Ela fica reservada para **carga de evento** e como plano B de desastre (imagem pronta, restauração de backup). Dois backends ativos com dois bancos significam **dado do titular dividido em dois lugares** sem replicação — e o titular não tem como saber em qual deles está o histórico dele. O banco é **um só**.
8. **Segredos só por ambiente, e o CI não guarda chave.** As variáveis vão na configuração do serviço; o GitHub Actions autentica por **OIDC / Workload Identity Federation**, sem chave de conta de serviço no repositório. Nada de segredo em `compose`, `Dockerfile` ou workflow.
9. **A região é escolha explícita, e a Política vai dizer onde os dados ficam.** `southamerica-east1` e `sa-east-1` mantêm dado derivado de EEG em território brasileiro. Não é o padrão desses provedores: é configuração que precisa ser conferida a cada serviço criado, e que a Política tem de declarar.

**O que se abre mão, explicitamente:** (a) **cold start.** Depois de ociosidade, a primeira requisição paga alguns segundos no Cloud Run e centenas de milissegundos no Neon. O revisor da loja verá um primeiro carregamento lento, não um app fora do ar — mas é lentidão real, e a UI não deve fingir instantaneidade que não tem (ADR-0027). (b) **O free tier não é teto rígido**: se algo estourar, cobra. Mitigado por `max-instances=1`, alerta de orçamento e limite de gasto — nunca eliminado. O Pi tinha a virtude oposta, de não conseguir gerar fatura surpresa, e ela está sendo trocada por menos trabalho de operação. (c) **Uma instância é zero redundância**: qualquer deploy tem janela de indisponibilidade e qualquer falha derruba tudo — aceitável para uma a duas pessoas, inaceitável no dia em que não for. (d) **0,5GB de banco** no plano gratuito do Neon; `Result` é pequeno, mas isso é um teto que ninguém está vigiando ainda. (e) **Dependemos de três fornecedores gratuitos que podem mudar as regras sem aviso** — a própria Oracle, no [FATO] acima, é a prova de que isso acontece. O que nos protege é o `docker compose` continuar funcionando: nada nesta decisão pode virar dependência de API proprietária que impeça sair.

**Alternativas consideradas:** (a) **Oracle Cloud Always Free** — rejeitada pelo [FATO]: corte sem aviso e reclamação por ociosidade, que é exatamente o nosso perfil; (b) **Raspberry Pi 5 sempre no ar + Cloudflare Tunnel** — preterida pelo item 6 (microSD, CGNAT, certificado, backup e nenhuma garantia em troca); (c) **Azure ligada 24/7** — preterida: US$ 8/mês não pagam o baseline e o crédito expira em 12 meses, deixando o app publicado sem backend; (d) **acender a nuvem só em eventos** — rejeitada: é incompatível com app publicado, e foi o que originou esta ADR; (e) **Supabase** no lugar do Neon — preterida: pausa projetos após cerca de uma semana sem atividade, e uma semana sem atividade é precisamente o que ocorre entre eventos; (f) **Watchtower** para atualização contínua — rejeitada: ele faz `pull` e reinicia, sem ordenar migração, sem health-gate e sem rollback, o que com Alembic significa código novo contra schema velho; (g) **orquestrador (k3s, Swarm)** — rejeitada: sem réplicas — que o item 3 proíbe — ele só acrescenta uma camada de falha e consumo de memória; (h) **Tailscale Funnel** para dispensar o domínio — preterida: o nome do tailnet é aleatório e domínio próprio configura uso comercial, fora do plano gratuito.

**O que esta ADR NÃO verificou, e precisa ser medido antes de valer como promessa:** o **timeout máximo de requisição** do Cloud Run comparado à duração real de uma sessão de captação; quanto o SSE de [api/live.py:12](services/api/app/api/live.py:12) — que segura a conexão do banco durante toda a transmissão — consome de CU-hora do Neon e se impede o autosuspend; se o GCP ainda exige cartão para verificação; e o preço atual da Azure. Nenhum desses números foi medido: são hipóteses até a fatia de deploy medir baseline de latência, tamanho de imagem, tempo de build e de boot.

**Consequências:** o `infra/` ganha um caminho de produção separado do `docker compose` de desenvolvimento, que **continua sendo o ambiente local** e a garantia de portabilidade; workflow de deploy no GitHub Actions com build, job de migração, publicação e rollback por healthcheck; o cabeçalho de IP do cliente ([deps.py:268](services/api/app/api/deps.py:268)) passa a vir de um proxy à frente e precisa de fatia própria, senão o limite por IP ou vira global ou continua falsificável; a Política de Privacidade passa a declarar **onde os dados ficam** e some o pressuposto de servidor próprio. Não altera o `AnalysisEngine`, o modelo de dados, papéis nem qualquer fluxo de produto. Relaciona ADR-0023 (rate limiter em memória, cuja dívida o item 3 congela), ADR-0025 (raw não persiste, o que mantém o banco pequeno), ADR-0039 e ADR-0045 (o ao vivo que o item 3 protege), ADR-0027 (não prometer disponibilidade nem velocidade que não temos) e Medical/72 (onde o dado do titular reside).

