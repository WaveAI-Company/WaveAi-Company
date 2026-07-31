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
