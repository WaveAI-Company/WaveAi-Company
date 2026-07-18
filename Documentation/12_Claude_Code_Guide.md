# 12 · Como usar o Claude Code no WaveAI — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo |
| Data | 2026-07-18 |
| Documentos relacionados | [11_MVP_Work_Breakdown](11_MVP_Work_Breakdown.md), [10_Git_Workflow](10_Git_Workflow.md), [../CLAUDE.md](../CLAUDE.md) |

Guia para transformar as **issues** do [doc 11](11_MVP_Work_Breakdown.md) em código com o Claude Code, mantendo tudo segmentado no GitHub.

---

## 1. Modelo mental
Trate o Claude Code como um **dev júnior/pleno muito rápido**: excelente executor quando a tarefa está **bem especificada e pequena**, e que precisa de **revisão** e de **testes como contrato**. Você e este projeto (docs) são o **arquiteto**; o Claude Code **implementa**. Ele **não** decide produto/claim clínica — isso vive nos docs.

## 2. O arquivo `CLAUDE.md` (contexto automático)
O Claude Code lê o `CLAUDE.md` da raiz automaticamente a cada sessão. Já criamos um (../CLAUDE.md) com: o que é o WaveAI, a fase atual, o layout do monorepo, as convenções e as **regras rígidas** (análise plugável, sem claim clínica, sem dado real, segredos fora do Git). **Mantenha-o atualizado** — é a memória do repositório.

## 3. O loop por issue (repita para cada uma)
1. **Escolha 1 issue** do doc 11 (respeite a ordem/dependências). Uma issue = uma sessão.
2. Na raiz do repo, abra o Claude Code (`claude`) numa **branch nova**: `git checkout -b feat/<área>-<slug>`.
3. **Cole o corpo da issue** (escopo + critérios de aceite + testes). Referencie arquivos/docs com `@` (ex.: `@Documentation/11_MVP_Work_Breakdown.md`, `@Architecture/22_MVP_Platform_Architecture.md`).
4. **Peça um plano primeiro** ("me mostre o plano antes de codar"). Revise; ajuste; só então aprove a implementação.
5. Deixe-o **implementar + escrever testes**. Exija que rode os testes e mostre-os passando.
6. **Revise o diff** você mesmo. Peça correções pontuais. Rode a app/os testes localmente.
7. **Commit** (Conventional Commits) → `push` → **abra o PR** (`Closes #n`) → CI verde → merge (squash) → apague a branch.

## 4. Boas práticas específicas
- **Tarefas pequenas**: se a issue crescer, quebre-a. PRs pequenos são revisáveis e seguros.
- **Testes = aceite**: transforme cada critério de aceite em teste. "Feito" = teste passa.
- **Dê contexto, não só a ordem**: aponte o doc/ADR relevante e as restrições no início da sessão.
- **Não deixe inventar decisão**: se faltar definição (ex.: um parâmetro clínico), o certo é **parar e perguntar/registrar em [04_Open_Questions](../04_Open_Questions.md)**, não "chutar".
- **Segredos**: nunca peça para commitar `.env`/chaves; use variáveis de ambiente (o `.gitignore` já cobre).
- **Verifique de verdade**: rode a UI, tire print, rode os testes — não confie só no "parece pronto".

## 5. Escolha de modelo
Use um modelo **mais robusto** (ex.: Opus) para issues **arquiteturais/ambíguas** (auth, streaming, integração do dispositivo) e um modelo mais leve para tarefas **mecânicas** (CRUD, telas simples, ajustes). Vale medir: se o modelo leve erra muito numa área, suba o modelo.

## 6. Divisão saudável de trabalho (Claude Desktop × Claude Code)
- **Aqui (Claude Desktop / este projeto):** decisões, arquitetura, especificação de issues, revisão de abordagem, ADRs e documentação.
- **Claude Code (no repo):** implementação das issues, testes, PRs.
Quando uma issue revelar uma **decisão** nova (ex.: escolher biblioteca X), traga de volta para cá, registre um ADR e então volte a codar. Isso mantém a coerência (o princípio "não implementar o que não está especificado").

## 7. Checklist antes de abrir o PR
- [ ] Critérios de aceite viram testes e passam.
- [ ] CI verde; lint ok.
- [ ] Diff pequeno e coeso; sem segredos/dados reais.
- [ ] Docs/ADR atualizados se a mudança foi relevante.
- [ ] `main` continua funcional após o merge.

## 8. Erros comuns a evitar
Pedir "faça o app inteiro" numa sessão (quebre em issues); aceitar código sem teste; deixar o modelo decidir claim/produto; commitar `.env`; PR gigante impossível de revisar.
