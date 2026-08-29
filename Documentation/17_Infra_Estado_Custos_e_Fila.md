# Infraestrutura: estado, custos e fila de trabalho

Sucessor operacional do `15_UI_Fine_Comb_Work_Breakdown.md`, aberto em 2026-08-26,
quando o WaveAI passou a existir em produção. Guarda o que **está medido**, o que
**custa**, o que **falta** e como **desligar e religar** sem perder nada.

> Regra deste documento: número aqui é número **medido**, com a data. Onde for
> estimativa ou hipótese, está dito com todas as letras.

---

## 1. O que está no ar (medido em 2026-08-26)

| Componente | Onde | Estado |
|---|---|---|
| Site e documentos legais | Cloudflare Pages, `waveai.tec.br` | 200 em 584 ms |
| API | Azure Container Apps, `api.waveai.tec.br` | 200 em 317 ms |
| Analysis | Container Apps, ingress **interno** | alcançável só pela API |
| Banco | Neon (`sa-east-1`) | migrations até `0018` |
| E-mail | SMTP do Gmail, senha de app | validado ponta a ponta |
| Deploy | GitHub Actions, OIDC | build → migração → apps |
| Expurgo | job cron diário, 04:00 UTC | **4 execuções, todas `Succeeded`** (26–29/08) |

**Cadastro e login reais foram exercitados pelo fundador em 2026-08-26** — é o
único teste que prova o cookie `SameSite=Lax` viajando entre `waveai.tec.br` e
`api.waveai.tec.br`, e ele passou.

### Desempenho medido

| Medida | Valor | Observação |
|---|---|---|
| Resposta quente | **154–317 ms** | três medições |
| **Cold start** | **~24,5 s** | após 12 min ocioso; a 2ª requisição já veio em 173 ms |
| Cold start (2ª medição, 2026-08-29) | **23,0 s** | `/health` após três dias sem deploy — confirma que os 24 s não foram um azar isolado |
| Primeira resposta após deploy | 21,0 s | imagem nova em nó frio |
| Migração no pipeline | ~35 s | |
| Imagem da API (GHCR) | 245 MB | |
| Imagem da Analysis (GHCR) | 378 MB | |

**Sobre os 24 segundos — DECOMPOSTO em 2026-08-29 (fatia D fechada).** A hipótese
inicial era que o cold start "normal" seria menor que o do deploy; a medição
desmentiu (deu igual ou pior). Os `ContainerAppSystemLogs_CL` mais a medição
local do boot decompuseram o tempo, e **nenhuma das duas causas que dava para
atacar é o gargalo**:

| Fase | O que é | Medido |
|---|---|---|
| Alocação de nó | Azure escala de zero: `AssigningReplica` → começar o pull | **~9–14 s** |
| Pull da imagem | GHCR → nó (78 MB comprimidos, não os 245 MB) | **~4 s** (3,4–5,1 s em 5 amostras) |
| Start + boot da app | contêiner sobe, `uvicorn` importa a app | **~2 s** (bate com o boot local isolado) |

**O grosso é a plataforma alocando o nó** ao escalar de zero — mais a latência do
KEDA e o intervalo do StartUp probe. É **inerente ao scale-to-zero do Container
Apps no plano de consumo**, o preço da arquitetura custo-zero-em-repouso
(ADR-0049), e **não controlamos** sem `min-replicas ≥ 1` — que o orçamento proíbe
(100 h de instância ativa/mês, o mês tem 730). Encolher a imagem raspa 1–2 s do
pull de 4 s: marginal. Detalhe na fatia **D** da §4.

*A terceira hipótese antiga, "o Neon acordando"* (autossuspende após 5 min),
também está descartada — `/health` não abre conexão e a app não tem gancho de
inicialização que o faça.

**Divergência não explicada:** as imagens construídas na máquina do dev deram
362 MB e 817 MB, contra 245 MB e 378 MB no CI. Hipótese é cache de camadas
inflando o `docker image ls` local. **Valem os números do CI**, porque é aquela
imagem que roda.

---

## 2. Custos — a pergunta respondida

**Resumo: não há custo fixo. Recurso parado não consome crédito.**

| Item | Cobra parado? | Detalhe |
|---|---|---|
| Container Apps (Consumption) | **Não** | Escalado a zero, **nenhuma** cobrança de compute |
| Cota gratuita mensal | — | 180.000 vCPU-s, 360.000 GiB-s, 2 milhões de requisições, **por mês** |
| Log Analytics do ambiente | Praticamente não | Ingestão de log tem 5 GB/dia grátis; nosso volume é ordens de grandeza menor |
| Registro de imagens | **Não** | Está no GHCR, gratuito — foi por isso que se evitou o Azure Container Registry, que custaria ~US$ 5/mês |
| Banco | **Não** | Neon, fora da Azure, plano gratuito |
| Cron do expurgo | Desprezível | 0,25 vCPU por poucos segundos/dia — cerca de 225 vCPU-s por mês, contra 180.000 gratuitos |

**Portanto:** deixar tudo de pé sem uso **não gasta o crédito**. Não é preciso
desligar nada para economizar.

**O que de fato encerra o serviço é a DATA.** O crédito Azure for Students
expira **no fim de 2026**, e nesse momento a assinatura é desabilitada e os
recursos, descomissionados — independentemente de saldo. Renovar (sendo
estudante) ou migrar é tarefa de **novembro de 2026**.

### Conferir o gasto real

Pelo portal: **Cost Management + Billing → Cost analysis**, filtrando por
`rg-waveai-prod`. É a fonte que vale.

Pela linha de comando (não testado nesta assinatura; contas Students às vezes
restringem a API de consumo):

```bash
az consumption usage list --start-date 2026-08-01 --end-date 2026-08-31 -o table
```

---

## 3. Desligar e religar

Como não há custo parado, isto **não é necessário para economizar**. Serve para
outra coisa: encerrar o serviço de propósito, ou recomeçar depois de um problema.

### Nível 1 — parar de atender, sem apagar nada

```bash
az containerapp update -n ca-waveai-api -g rg-waveai-prod --min-replicas 0 --max-replicas 0
az containerapp update -n ca-waveai-analysis -g rg-waveai-prod --min-replicas 0 --max-replicas 0
```

Religar:

```bash
az containerapp update -n ca-waveai-api -g rg-waveai-prod --min-replicas 0 --max-replicas 1
az containerapp update -n ca-waveai-analysis -g rg-waveai-prod --min-replicas 0 --max-replicas 1
```

> `--max-replicas 1` na volta, **nunca mais que isso**: o fan-out ao vivo e o
> rate limiter vivem na memória do processo (decisão 3 da ADR-0049).

Preserva domínio, certificado, segredos e dados. O site e os documentos legais
continuam no ar, porque estão no Cloudflare Pages e não dependem da API.

### Nível 2 — suspender só o expurgo

```bash
az containerapp job update -n caj-waveai-purge -g rg-waveai-prod --trigger-type Manual
```

Religar:

```bash
az containerapp job update -n caj-waveai-purge -g rg-waveai-prod --trigger-type Schedule --cron-expression "0 4 * * *"
```

> **Cuidado que não é técnico:** enquanto o cron estiver desligado, a Política de
> Privacidade publicada promete um prazo que ninguém cumpre (ADR-0027 e emenda à
> ADR-0047). Aceitável por horas, não por semanas.

### Nível 3 — apagar tudo

```bash
az group delete -n rg-waveai-prod --yes --no-wait
```

Recriar: `bash infra/azure/provision.sh`, depois
`bash infra/azure/vincular-dominio.sh` e um deploy pelo GitHub Actions.

> ### ⚠️ A chave Fernet precisa ser a MESMA
>
> `WAVEAI_API_RESULT_ENCRYPTION_KEY` cifra os `Result` no banco, e **o banco
> sobrevive** ao `group delete` porque está no Neon. Recriar o ambiente com uma
> chave nova torna **ilegível todo dado já cifrado** — ele continua lá e ninguém
> mais o lê. Guarde essa chave fora da Azure.
>
> O `JWT_SECRET` pode ser novo sem drama: o efeito é derrubar as sessões ativas.

Apagar o grupo também remove o vínculo do domínio e o certificado — ambos são
refeitos pelo `vincular-dominio.sh`, o que exige os registros de DNS
continuarem existentes na Cloudflare.

---

## 4. Fila de trabalho

Ordem acordada com o fundador em 2026-08-26. O critério é **proteger quem chegar
primeiro** antes de ampliar alcance.

> **Ordem de execução, revista em 2026-08-29: começar pela B, não pela A.** A
> lista continua em ordem de prioridade *conceitual* — a A é segurança e por
> isso vem escrita primeiro. Mas a B é de poucos minutos, tem benefício
> imediato e evita que cada PR de documentação derrube a instância quente,
> inclusive os PRs desta própria fila. E a A pode **encolher** para "confirmar e
> documentar" se o teste mostrar que o IP real já chega: vale medir antes de
> dimensionar a correção.

### A. IP confiável e rate limit — *CORRIGIDO e VERIFICADO em produção (2026-08-29)*

`client_ip` usava o IP do **socket**, e o uvicorn, por padrão, reescrevia
`request.client` a partir do `X-Forwarded-For` mais à esquerda — controlado por
quem chama.

**A hipótese antiga ("vira global e tranca todo mundo") estava errada.** Medido
em produção em 2026-08-29, com duas sondas que discriminam:

| Sonda | `X-Forwarded-For` | Antes do fix | Depois do fix |
|---|---|---|---|
| Variado a cada request | forjado, diferente | **7×, 0 bloqueios** | **429 no 6º** |
| Fixo | forjado, igual | 429 no 5º | 429 no 5º |

O limite chaveava pelo cabeçalho forjável → a defesa de brute-force estava
**contornável** por rotação do cabeçalho (o oposto de "global", e pior). Para
cliente honesto (sem o cabeçalho), o ingress preenche o XFF com o IP real e o
limite por-pessoa já funcionava.

**Correção (PR #190, emenda à ADR-0023):** `client_ip` lê o `X-Forwarded-For`
cru e toma o elemento a `N` posições da direita — o IP que o proxy confiável
anexa (`WAVEAI_API_TRUSTED_PROXY_HOPS`, default 1: só o ingress; a Cloudflare
não fica na frente da API).

**Verificado pós-deploy, com as duas provas que separam "1 salto" de "mais de
um":** a sonda de XFF variado passou a **bloquear no 6º** (não é mais
falsificável); e dois aparelhos em redes distintas **não** se bloquearam (o PC
travou ao esgotar, o celular em 4G não) — logo a chave é o **cliente real**, não
um IP interno constante. Se a Azure anexasse mais de um salto, o celular teria
travado junto. A suposição de um salto se confirmou.

### B. `paths-ignore` no deploy — *poucos minutos, benefício imediato*

O workflow de deploy roda em **todo** push na `main`, inclusive num PR que só
mexe em `.md`. Cada um desses cria revisão nova do Container App: a instância
quente é descartada, quem estiver usando paga o cold start (**23,0 s medidos em
2026-08-29**) e a migração roda à toa.

O filtro entra só no `deploy.yml` e cobre `**.md` e `Design/**` — as pastas
puramente documentais foram **enumeradas**, e fora dos `.md` elas contêm apenas
`Design/round1/*.html`, mockups que não entram em imagem alguma. Um push que
misture documentação e código continua fazendo o deploy inteiro.

**O `ci.yml` não recebe o filtro**, e isso é decisão, não esquecimento: seus jobs
são checks exigidos pela proteção da `main` e, num PR filtrado, o check nunca
reporta — o PR ficaria travado esperando um status que não vem. Gastar minutos de
runner é mais barato que travar a `main`.

**Efeito colateral aceito:** a imagem em produção passa a corresponder ao último
commit que tocou **código**, não ao HEAD da `main`. O `workflow_dispatch` do
workflow é a saída para forçar um deploy do HEAD.

### C. Conferir as execuções do expurgo — *CONFERIDO em 2026-08-29*

**Quatro execuções, todas `Succeeded`**, nas datas e no horário previstos:

| Execução | Início | Status |
|---|---|---|
| `caj-waveai-purge-29799600` | 2026-08-29 04:00 UTC | Succeeded |
| `caj-waveai-purge-29798160` | 2026-08-28 04:00 UTC | Succeeded |
| `caj-waveai-purge-29796720` | 2026-08-27 04:00 UTC | Succeeded |
| `caj-waveai-purge-29795280` | 2026-08-26 04:00 UTC | Succeeded |

São exatamente as quatro madrugadas desde que o `provision.sh` criou o job (a
PR #186 foi mergeada em 26/08 00:50 UTC, antes das 04:00 daquele dia). O cron
`0 4 * * *` dispara, e a frase "nunca executou de verdade" saiu do §1.

**O `Succeeded` sozinho não provaria isso, e vale registrar por quê.** Com a
retenção em 365 dias ([`config.py:175`](../services/api/app/config.py:175), e
fixada no próprio job em
[`provision.sh:393`](../infra/azure/provision.sh:393)), uma execução **correta**
apaga zero registros — o produto tem dias de vida. E sair com código 0 sem
apagar nada é o comportamento desejado, dito com todas as letras no
[docstring do script](../services/api/scripts/purge_audit_trail.py). Um job que
tivesse subido com a imagem provisória também sairia 0. Os dois casos produzem o
mesmo `Succeeded`.

**O que separou os dois casos** foi conferir o que o job está configurado para
rodar:

```
imagem:  ghcr.io/waveai-company/waveai-api:31e93ff…   (não a provisória)
comando: python
args:    scripts/purge_audit_trail.py
```

Com a imagem certa e o comando certo, `Succeeded` passa a significar algo: o
processo **saiu com código 0**, e o único caminho para isso no script é chegar ao
fim depois do `commit`. Falha de ambiente ou de conexão sairia diferente de 0, e
a execução apareceria como `Failed`.

**E a prova direta veio depois, pelo Log Analytics** — o que dispensa a
inferência acima. Uma linha por execução, com a asserção que discrimina:

```
2026-08-29T04:00:17Z  expurgo da trilha pseudonimizada: 0 registros apagados (retenção 365 dias, corte em 2025-08-29T04:00:15…)
2026-08-28T04:00:22Z  expurgo da trilha pseudonimizada: 0 registros apagados (retenção 365 dias, corte em 2025-08-28T04:00:20…)
2026-08-27T04:00:21Z  expurgo da trilha pseudonimizada: 0 registros apagados (retenção 365 dias, corte em 2025-08-27T04:00:19…)
2026-08-26T04:00:29Z  expurgo da trilha pseudonimizada: 0 registros apagados (retenção 365 dias, corte em 2025-08-26T04:00:27…)
```

O corte cai **exatamente 365 dias** antes de cada execução. A rotina roda, lê o
prazo do ambiente e conclui. **A Política deixou de dever prazo:** o texto
público promete apagar em até 12 meses, e agora existe execução com log.

`az containerapp job logs show` não serviu para isso: ele lê a réplica **viva**,
e réplica de execução encerrada é reciclada (`No replicas found for execution`).
O log histórico está no Log Analytics — consulta em
[`infra/README.md`](../infra/README.md).

**O que continua sendo raciocínio, não medição:** a configuração conferida acima
é a **de agora**. A execução de 29/08 rodou com a imagem anterior (`b60b236`),
da mesma origem e do mesmo pipeline — mas isso não foi medido por execução.

**Achado colateral, corrigido junto:** o mesmo comando à mão revelou que
`job logs show` exige `--container`, e o bloco de diagnóstico do `deploy.yml`
não passava esse argumento. Aquele bloco só roda quando a migração falha —
nunca falhou desde que foi escrito — e o `|| true` do fim escondia o defeito por
construção. Ou seja: no dia em que a migração quebrasse, o passo que existe para
explicar a falha falharia junto, deixando um deploy abortado sem uma linha de
log. Corrigido nesta mesma fatia.

### D. Diagnóstico do cold start — *MEDIDO E FECHADO em 2026-08-29*

Cold start reproduzido e carimbado: **26,2 s** às 20:54 UTC, após ociosidade. A
decomposição saiu de duas fontes que se confirmam.

**Fonte 1 — boot da app isolado do pull (medição local).** `docker run` da imagem
da API já presente (sem pull) até `/health=200`: **~1,8 s** (2,3 s na primeira, por
warm-up do contêiner), três medições. Descarta a app como gargalo — e descarta,
por inspeção, a hipótese "Neon acordando": [`/health`](../services/api/app/main.py:78)
devolve dicionário estático, não abre conexão, e não há `lifespan`/`on_startup`/
`@app.on_event` em `services/api/app/` (varrido). Nada toca o banco antes de a
rota responder.

**Fonte 2 — `ContainerAppSystemLogs_CL` (medição em produção).** Os eventos de
ciclo de vida de três cold starts reais (17:57, 19:00 e o scale 0→1 por tráfego às
19:09) decompõem o tempo entre `AssigningReplica`, `PullingImage`/`PulledImage` e
`ContainerStarted`:

| Fase | Evento → evento | Medido |
|---|---|---|
| **Alocação de nó** | `AssigningReplica` → início do pull | **~9–14 s** |
| **Pull da imagem** | duração na mensagem de `PulledImage` | **~4 s** (3,37 / 3,92 / 4,07 / 4,74 / 5,09) |
| **Start + boot** | pull → `ContainerStarted` + probe | **~2 s** (bate com a Fonte 1) |

Duas leituras que a mensagem entrega de graça: o que se move no pull são **78 MB
comprimidos** (`Image size: 81788928 bytes`), não os 245 MB descomprimidos; e o
StartUp probe falha **uma vez** logo após o start (a app ainda não escuta) e passa
na tentativa seguinte — daí o ~1 probe de atraso.

**Conclusão:** o gargalo é a **alocação de nó pela Azure ao escalar de zero**
(~9–14 s), mais a latência do KEDA e o intervalo do probe. É **inerente ao
scale-to-zero do Container Apps no plano de consumo** — o preço da arquitetura
custo-zero-em-repouso (ADR-0049). As duas causas que dava para atacar não são o
gargalo: pull ~4 s (encolher a imagem raspa 1–2 s, marginal) e boot ~2 s.

**A única alavanca que mataria o cold start — `min-replicas ≥ 1` — o orçamento
proíbe** (100 h de instância ativa/mês contra 730 do mês). Então **não há correção
de infra a fazer aqui**, e é honesto dizer isso em vez de otimizar a imagem para
ganhar 1 s.

**O que a fatia D vira, então: honestidade visual (ADR-0027), e é fatia de UI.**
Já que o cold start não sai dentro do orçamento, a tela **não pode girar ~25 s em
silêncio** afirmando nada — precisa dizer que o serviço está acordando. Fica
registrado aqui e some da fila de infra; entra na fila de UI quando ela reabrir.

### E. E-mails estilizados — *pedido do fundador, 2026-08-26*

Hoje os e-mails saem em texto puro. O adapter SMTP já usa `EmailMessage`, que
suporta alternativa HTML sem trocar de biblioteca.

**A decidir antes de codar:** manter sempre a versão em texto ao lado do HTML
(cliente que não renderiza precisa continuar recebendo o código); onde a cópia
vai morar; e se o visual segue o sistema "Maré" das telas.

### F. Foto de perfil — *pedido do fundador, 2026-08-26*

**Não é uma fatia de UI.** Traz decisões estruturais que precisam de ADR antes de
qualquer código:

1. **Onde a imagem é guardada.** Container Apps **não tem disco persistente**, e
   o que sobe morre com a réplica. As opções reais: um serviço de blob (é
   **fornecedor novo** e, se for da Azure, cria a amarra que a emenda à ADR-0049
   proíbe), ou guardar no próprio Postgres — sem fornecedor novo, mas comendo a
   cota de **0,5 GB** do plano gratuito do Neon.
2. **Foto de rosto é dado pessoal.** A Política de Privacidade lista o que se
   coleta e teria de passar a listar isso — o que **sobe a versão do documento**
   e, pela ADR-0048, também a `TERMS_VERSION`.
3. **A exclusão de conta tem de apagar a imagem** (ADR-0047: apaga tudo do
   titular, na hora). Se ela viver fora do banco, o `CASCADE` não a alcança.
4. **Um profissional veria a foto do paciente?** Se sim, isso é leitura de dado
   do titular e cai na trilha auditada da ADR-0037.

### G. Play Store — *o alvo declarado*

Ainda não começou: conta de desenvolvedor, build Android assinado, ficha da loja,
classificação de conteúdo, teste fechado. A URL pública da Política — que a loja
exige — **já existe** e está no ar.

---

## 5. Dívidas registradas, não esquecidas

- **O aviso de mudança dos Termos não existe.** A Política 1.1 promete
  *"avisaremos no aplicativo"*; ninguém é interrompido ao entrar, e contas
  anteriores seguem com `accepted_terms_version` nulo. Preterido **por tamanho**
  na ADR-0048, não por mérito. Deixa de ser barato no dia em que houver gente de
  fora e o texto mudar.
- **Rotação da chave de cifra** (`app/security/crypto.py`): Fernet simples, sem
  caminho de rotação.
- **Redis para o rate limiter**: congelado com justificativa enquanto houver uma
  réplica só; volta a ser bloqueante na segunda.
- **SSE segura a conexão do banco** durante toda a transmissão
  (`app/api/live.py`). Com o Neon, uma conexão longa impede o autossuspend e
  consome cota. **Nunca medido em produção.**
- **Entregabilidade do e-mail**: remetente `@gmail.com` e teto de 500/dia. O
  destino natural é um provedor transacional com `waveai.tec.br` — registrado
  como alternativa preterida na emenda à ADR-0044.
- **Revisão jurídica** dos documentos legais: pendente desde que foram escritos.
- **Sem índice em `pseudonymized_at`**: irrelevante no volume atual.

---

## 6. Datas

| Quando | O quê |
|---|---|
| Madrugada seguinte a 2026-08-26 | Primeira execução do cron do expurgo — conferir |
| **Novembro de 2026** | Renovar o crédito Azure ou migrar (ver `infra/RUNBOOK_PORTABILIDADE.md`) |
| **Fim de 2026** | Crédito expira; assinatura desabilitada e recursos descomissionados |
