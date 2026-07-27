# 14 · Fase Produto & UX — Plano de Trabalho — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo — fonte das issues da fase de Produto & UX |
| Data | 2026-07-26 |
| Documentos relacionados | [13_Analysis_Phase_Work_Breakdown](13_Analysis_Phase_Work_Breakdown.md), [06_Master_Roadmap](../06_Master_Roadmap.md), [Medical/71](../Medical/71_Intended_Use_and_Regulatory_Positioning.md), [05_Decisions](../05_Decisions.md), [00_Project_Vision](../00_Project_Vision.md), [01_Project_Objectives](../01_Project_Objectives.md) |

## Contexto e objetivo
A fase **Análise & Ciência** (N1–N6, [doc 13](13_Analysis_Phase_Work_Breakdown.md)) está **concluída**: o servidor produz features do Catálogo, qualidade (ADR-0031), baseline pessoal (ADR-0032), relatórios longitudinais (N5), narrativa-LLM aterrada (ADR-0035) e o eSense ao vivo validado no NeuroSky **real** (N6-c). O motor tem base científica honesta e as saídas existem.

O foco agora muda das **saídas** para a **experiência**: transformar o que o motor já produz num **produto didático e interativo que ajude de verdade o médico e o paciente** — sem inventar nada novo sobre o sinal. Só **depois** de o produto estar bom vem o **deploy** (nuvem + APK + Play Store).

**[OPINIÃO]** A ciência já disse o que o sinal sustenta (H-SIG-01 🟡: tendências/insights de bem-estar, não claim clínica). O risco desta fase não é técnico — é de **produto**: o usuário entende o que vê? confia? volta? O trabalho é tornar o honesto também **compreensível e útil**.

## Princípios da fase (não violar)
- **Não-clínico / não-diagnóstico** (Medical/71). Nenhuma claim clínica em UI, textos, onboarding ou store listing. Termos ok: bem-estar, tendências, estados mentais, exploratório.
- **Honestidade visual** (ADR-0027): eixos rotulados, sem veredito inventado, sem cor de "bom/ruim" onde não há valência. O eSense sempre rotulado proprietário/não-validado (ADR-0034); a `reliability` do Catálogo N2 é matéria-prima da didática.
- **Termo "anomalia" PROIBIDO** em código/testes (ADR-0032; guard de CI). Evento = *contraste de estado + desvio Nσ*; na UI, "evento de interesse"/"desvio", nunca "anomalia".
- **Análise atrás do `AnalysisEngine`** — a UI **consome**, não calcula DSP. Nada de ciência nova espalhada na app/API.
- **Sem dado real de terceiros** (LGPD); testes/CI 100% sintéticos; autocaptação do dev nos termos da ADR-0028.
- **UI por papel**: paciente e médico têm jornadas distintas; o médico arbitra (human-in-the-loop).

## Frentes (milestones — criar milestone "Fase · Produto & UX" no GitHub)
Ordem definida com o fundador (2026-07-26): começar por **P1**; anotações (**P2**) na versão **manual por sessão**; **deploy (P5) por último**.

### P1 — Camada didática *(primeira frente)*
Tornar compreensível o que já existe, **persona-agnóstico** e de baixo risco.
- Explicações in-context ("o que é isso?") nos termos exibidos: bandas (alfa/beta/…), eSense, qualidade de sinal, desvio/baseline — reusando `reliability`, unidade e interpretação do **Catálogo de Features N2** e os disclaimers existentes.
- Componente de dica/glossário reutilizável (acessível, contrastado — gate `check:contrast`), aplicado nas telas ao vivo, histórico e relatório.
- Entregável: usuário consegue **ler** um número sem saber DSP, sem que a UI afirme mais do que o dado sustenta.

### P2 — Anotações contextuais (o "pop-up de contexto") — v1 manual *(ADR-0037)*
Retoma a ideia da Visão ([00_Project_Vision](../00_Project_Vision.md)), adiada no esqueleto.
- **v1 = manual por sessão:** o paciente adiciona uma **nota de texto livre** à sessão. Modelo `SessionAnnotation` (1 por sessão, upsert), **cifrado** como o `Result`; migration 0008; leitura pelo profissional via **CareLink** e **auditada** (`annotation_access_events`). Entra em export/erasure.
- O profissional vê a anotação **ao lado do sinal/relatório**, rotulada **"autorrelato do paciente"** e read-only — correlação contexto × sinal, marcada **[HIPÓTESE]** (valor com canal único ainda não demonstrado).
- **Split:** **P2-a** = backend (modelo + migration + serviço + rotas + testes sintéticos). **P2-b** = UI (captura no fim da sessão + edição no histórico; exibição rotulada).
- **Gancho futuro (v2, fora do escopo):** disparo por **evento de interesse** (desvio Nσ, ADR-0032). Depende do **baseline amadurecer** (~20 sessões) — preparar o encaixe, não prometer o comportamento; sem o termo "anomalia".

### P3 — Cockpit do médico
Consolidar o que ajuda o profissional a arbitrar.
- Tela navegável do paciente: **tendências longitudinais** (já no backend N5) + **narrativa rotulada** (ADR-0035) + **anotações** (P2) lado a lado com as features/qualidade.
- Sem veredito automático: o médico é a autoridade; a IA é apoio explicável.

### P4 — Captação guiada (jornada do paciente)
Reduzir o "lixo entra, lixo sai" e o abandono.
- Onboarding de captação: **como conseguir bom contato do sensor**, o que é poorSignal, e protocolos simples (olhos abertos/fechados como no Exp. B) para dar contraste de estado interpretável.
- Leitura ao vivo mais clara (o que esperar, quando confiar), reusando o gate de qualidade.

### P5 — Deploy & distribuição *(a cauda — só com produto bom)*
- **Hospedagem em nuvem** do serviço de Analysis + banco de produção — **revisita [ADR-0005](../05_Decisions.md)** (edge vs nuvem), residência de dados/LGPD, segredos por ambiente.
- **Build do APK:** sair do fluxo *managed* para **EAS build** (ou prebuild local) — o módulo SPP nativo já exige dev-client; formalizar o pipeline de build assinado.
- **Play Store:** listing com posicionamento **não-clínico** rigoroso (Medical/71), política de privacidade (LGPD), e o fluxo de consentimento real.

## Decisões de kickoff (viram ADRs antes de codar)
- **PUX-D1 — Modelo de anotação de contexto. ✅ RESOLVIDA (ADR-0037).** `SessionAnnotation` = **nota livre** (v1; tags = v2), **1 por sessão** (upsert), **cifrada** (Fernet), escrita só pelo titular, **visível ao profissional via CareLink** e auditada (`annotation_access_events`); entra em export/erasure. Split: **P2-a** (backend) → **P2-b** (UI).
- **PUX-D2 — Deploy edge vs nuvem (reabre [ADR-0005](../05_Decisions.md)).** Onde roda o Analysis em produção; residência de dados. → antes do P5.
- **PUX-D3 — Persona/claim de produto (Q-PRD-01). ✅ RESOLVIDA (ADR-0036).** Persona = **acompanhamento de bem-estar (estresse/relaxamento)**, não-clínico; acompanhante = **"profissional de bem-estar"** na UI (papel `doctor` mantido no modelo). A linguagem didática (P1/P4) e o listing (P5) miram esta persona.

## Perguntas em aberto desta fase
- **Q-PRD-01** (P0) — público-alvo/persona inicial. **✅ Resolvida (ADR-0036):** bem-estar/estresse, não-clínico; acompanhante = profissional de bem-estar.
- Q-PRD-02 — modelo de negócio (B2C/B2B/B2B2C).
- Q-TEC-04 / **ADR-0005** — edge vs nuvem (reabre no P5).
- Q-ETH-01 — CEP/base legal se algum dia envolver terceiros (não neste escopo).

## Como levar ao Claude Code
Mesmo fluxo: **uma issue por PR**, **plano antes de codar**, **testes como contrato** (sintéticos), **ADR para cada decisão** (PUX-D1 antes do P2; PUX-D2 antes do P5). Gates do app: `npm run typecheck` + `npm run check:contrast`; guard `check_forbidden_terms.sh` sempre. Guia em [12_Claude_Code_Guide](12_Claude_Code_Guide.md).
