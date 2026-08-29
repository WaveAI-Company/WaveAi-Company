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

**Sobre os 24 segundos:** a hipótese inicial era que o cold start "normal" seria
menor que o do deploy, porque não incluiria puxar imagem nova. **A medição
desmentiu isso** — com a imagem já conhecida, deu igual ou pior. **Onde esse
tempo é gasto continua desconhecido**: pode ser pull de camada ou boot da
aplicação. Medir antes de mitigar.

*Atualização 2026-08-29:* a terceira hipótese desta lista era "o Neon acordando"
(ele autossuspende após 5 min). **Está descartada** — `/health` não abre conexão
com o banco e a app não tem nenhum gancho de inicialização que o faça. Detalhe e
varredura na fatia **D** da §4.

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

### A. IP confiável e rate limit — *segurança, prioridade conceitual*

[`client_ip`](../services/api/app/api/deps.py:308) usa o IP do **socket**. Atrás
do ingress do Container Apps, esse IP é o do proxy da Azure.

**Medido em 2026-08-26:** o limitador funciona — cinco tentativas de login
devolveram 401 e a sexta devolveu **429**. O que **não** foi medido é se o IP
observado é o do visitante ou o do proxy.

**E isso não muda a conclusão:** nos dois cenários é preciso corrigir. Se o IP é
o do proxy, o limite deixou de ser por pessoa e virou **global** — qualquer
visitante erra cinco senhas e tranca o login de todo mundo, indefinidamente. Se
passar a vir de cabeçalho sem validação, vira falsificável. A correção é a
mesma: tratar `X-Forwarded-For` **sabendo** que há um proxy confiável à frente.

**O teste que discrimina** (registrado aqui porque é fácil fazê-lo errado e
concluir nada): esgotar as cinco tentativas no computador e, **dentro dos 60
segundos**, tentar do celular em **4G — não no Wi-Fi de casa**. No Wi-Fi os dois
aparelhos saem pelo mesmo IP público, e depois de 60 s a janela expira sozinha;
nos dois casos o resultado é ambíguo e não prova nada.

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

### D. Diagnóstico do cold start — *medir antes de mitigar*

23–24,5 segundos. Manter uma réplica sempre viva **está fora do orçamento**: a
cota gratuita cobre cerca de 100 horas de instância ativa por mês, e o mês tem
730.

Também é assunto de honestidade visual: uma tela girando por meio minuto sem
dizer nada esconde o que está acontecendo (ADR-0027).

**Uma das três hipóteses caiu, e sem precisar medir.** O texto acima dizia "pode
ser pull de camada, boot do `uvicorn`, ou o Neon acordando". **O Neon está
descartado:** [`/health`](../services/api/app/main.py:78) devolve um dicionário
estático e não abre conexão, e não há `lifespan`, `on_startup` nem
`@app.on_event` em lugar nenhum de `services/api/app/` (varrido em 2026-08-29) —
nada toca o banco antes de a rota responder. Sobram o pull da imagem e o boot da
aplicação. Foi inspeção de código, não medição, mas é conclusiva para esta
pergunta.

**Pista vinda do expurgo — pista, não medição.** O job do expurgo roda a **mesma
imagem** da API e, do horário agendado até a linha do log, gastou **27,8 s
(26/08), 19,3 s (27/08), 20,5 s (28/08) e 15,1 s (29/08)** — média ~20,7 s. Ele
sobe o contêiner, importa a aplicação **e ainda conecta ao Neon**, tudo dentro de
uma janela parecida com os 23–24,5 s que a API gasta para responder um endpoint
que não toca banco. Isso reforça que o custo está no que os dois compartilham —
subir o contêiner e importar a app — e não no `uvicorn` nem nas rotas.

**O que impede isso de ser medição:** o `StartTime` das quatro execuções é
`04:00:00` exato, o que sugere ser o horário **agendado** e não o instante em que
a réplica começou a rodar; a janela inclui, então, latência de agendamento
desconhecida. E o job roda com **0,25 CPU / 0,5 GiB** contra **0,5 / 1,0 GiB** da
API ([`provision.sh`](../infra/azure/provision.sh:200)), o que muda o tempo de
boot. Serve para **ordenar hipóteses**, não para dimensionar correção.

O primeiro dia (27,8 s) é o mais lento dos quatro, o que é compatível com pull de
imagem em nó frio — mas com N=4 e sem saber o que `StartTime` mede, é leitura de
padrão, não resultado.

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
