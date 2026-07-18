# 10 · Workflow de Git (GitHub Flow) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo |
| Data | 2026-07-18 |
| Remoto | https://github.com/WaveAI-Company/WaveAi-Company.git |
| Decisões | ADR-0014 (monorepo), ADR-0015 (GitHub Flow) |

Convenção de trabalho com Git para o time (2–5 pessoas). Modelo escolhido: **GitHub Flow** — simples, com `main` sempre implantável e branches curtas por trabalho, integradas via Pull Request com CI verde.

---

## 1. Princípios
- **`main` é sempre estável** e protegida (sem push direto; só via PR).
- **Uma branch curta por tarefa**, criada a partir da `main` atualizada.
- **Pull Request** para revisão + **CI obrigatório** antes do merge.
- Commits pequenos e descritivos (**Conventional Commits**).
- Dados de pessoas **nunca** entram no Git (ver `.gitignore`; LGPD).

## 2. Convenção de nomes de branch
`<tipo>/<descrição-curta-em-kebab>` — ex.:
- `feat/thinkgear-parser`
- `fix/checksum-resync`
- `docs/git-workflow`
- `chore/ci-pytest`
- `spike/eeg-capture`
Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `spike`.

## 3. Conventional Commits
`<tipo>(escopo opcional): resumo no imperativo`
```
feat(eeg): parser incremental do protocolo ThinkGear
fix(analysis): corrige integração da banda alfa na PSD
docs(adr): registra ADR-0013 (captação de sinal)
test(reader): cobre remontagem de pacotes fragmentados
```

## 4. Primeira conexão do repositório local ao remoto
> Cenário A — o remoto está **vazio** (sem commits):
```bash
cd <pasta-do-projeto-WaveAI>
git init
git branch -M main
git add .
git commit -m "chore: estrutura inicial (docs Fase 0 + spike de captação)"
git remote add origin https://github.com/WaveAI-Company/WaveAi-Company.git
git push -u origin main
```
> Cenário B — o remoto **já tem conteúdo** (ex.: README criado no GitHub):
```bash
cd <pasta-do-projeto-WaveAI>
git init
git remote add origin https://github.com/WaveAI-Company/WaveAi-Company.git
git fetch origin
git checkout -b main --track origin/main   # ou: git pull origin main --allow-unrelated-histories
git add . && git commit -m "chore: estrutura inicial (docs Fase 0 + spike de captação)"
git push -u origin main
```
> **[RECOMENDAÇÃO]** Depois, no GitHub: Settings → Branches → **proteger `main`** (exigir PR + CI verde).

## 5. Ciclo de trabalho diário
```bash
git checkout main && git pull                 # partir do main atualizado
git checkout -b feat/minha-tarefa             # branch curta
# ... editar, rodar testes localmente (pytest -q) ...
git add -p && git commit -m "feat: ..."       # commits pequenos
git push -u origin feat/minha-tarefa
# abrir Pull Request no GitHub -> revisão + CI -> merge (squash) -> apagar a branch
```

## 6. Pull Request — checklist mínimo
- [ ] Testes passam localmente e no CI.
- [ ] Escopo pequeno e coeso.
- [ ] Documentação/ADR atualizados quando a mudança é relevante.
- [ ] Sem dados sensíveis/segredos no diff.

## 7. Relação com a documentação
Mudanças estruturais entram como **RFC** (pasta `RFC/`) antes de virarem **ADR** ([05_Decisions](../05_Decisions.md)). Ver convenções em [08_AI_Instructions](../08_AI_Instructions.md).
