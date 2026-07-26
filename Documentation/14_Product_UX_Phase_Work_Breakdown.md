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

### P2 — Anotações contextuais (o "pop-up de contexto") — v1 manual
Retoma a ideia da Visão ([00_Project_Vision](../00_Project_Vision.md)), adiada no esqueleto.
- **v1 = manual por sessão:** o paciente adiciona uma **nota de contexto** à sessão (o que estava fazendo/sentindo). Novo modelo de dados (`annotation`/nota ligada à `CaptureSession`), cifrado como o `Result`; migration própria; auditoria de leitura pelo médico como nos `Result`.
- O médico vê a anotação **ao lado do sinal/relatório** — correlação contexto × sinal, marcada **[HIPÓTESE]** (o valor com canal único ainda não está demonstrado).
- **Gancho futuro (v2, fora do escopo agora):** disparo por **evento de interesse** (desvio Nσ, ADR-0032). Depende do **baseline pessoal amadurecer** (hoje "insuficiente" até ~20 sessões), então não dispara de verdade ainda — preparar o encaixe, não prometer o comportamento.

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
- **PUX-D1 — Modelo de anotação de contexto.** Forma do dado (campos livres vs estruturados), cifragem, vínculo com `CaptureSession`, e regra de leitura pelo médico (auditada, como os `Result`). → ADR próprio antes do P2.
- **PUX-D2 — Deploy edge vs nuvem (reabre [ADR-0005](../05_Decisions.md)).** Onde roda o Analysis em produção; residência de dados. → antes do P5.
- **PUX-D3 — Persona/claim de produto (Q-PRD-01, P0 aberta).** Público-alvo inicial molda a linguagem didática (P1/P4) e o listing (P5). Pode-se começar P1 persona-agnóstico, mas **fechar antes de P4/P5**.

## Perguntas em aberto desta fase
- **Q-PRD-01** (P0) — público-alvo/persona inicial. *Aberta.*
- Q-PRD-02 — modelo de negócio (B2C/B2B/B2B2C).
- Q-TEC-04 / **ADR-0005** — edge vs nuvem (reabre no P5).
- Q-ETH-01 — CEP/base legal se algum dia envolver terceiros (não neste escopo).

## Como levar ao Claude Code
Mesmo fluxo: **uma issue por PR**, **plano antes de codar**, **testes como contrato** (sintéticos), **ADR para cada decisão** (PUX-D1 antes do P2; PUX-D2 antes do P5). Gates do app: `npm run typecheck` + `npm run check:contrast`; guard `check_forbidden_terms.sh` sempre. Guia em [12_Claude_Code_Guide](12_Claude_Code_Guide.md).
