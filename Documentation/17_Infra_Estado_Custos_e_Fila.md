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
| Expurgo | job cron diário, 04:00 UTC | **nunca executou ainda** |

**Cadastro e login reais foram exercitados pelo fundador em 2026-08-26** — é o
único teste que prova o cookie `SameSite=Lax` viajando entre `waveai.tec.br` e
`api.waveai.tec.br`, e ele passou.

### Desempenho medido

| Medida | Valor | Observação |
|---|---|---|
| Resposta quente | **154–317 ms** | três medições |
| **Cold start** | **~24,5 s** | após 12 min ocioso; a 2ª requisição já veio em 173 ms |
| Primeira resposta após deploy | 21,0 s | imagem nova em nó frio |
| Migração no pipeline | ~35 s | |
| Imagem da API (GHCR) | 245 MB | |
| Imagem da Analysis (GHCR) | 378 MB | |

**Sobre os 24 segundos:** a hipótese inicial era que o cold start "normal" seria
menor que o do deploy, porque não incluiria puxar imagem nova. **A medição
desmentiu isso** — com a imagem já conhecida, deu igual ou pior. **Onde esse
tempo é gasto continua desconhecido**: pode ser pull de camada, boot do
`uvicorn`, ou o Neon acordando (ele autossuspende após 5 min). Medir antes de
mitigar.

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

### A. IP confiável e rate limit — *segurança, prioridade*

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

### B. Conferir a primeira execução do expurgo — *barato*

O cron nunca disparou. Depois da primeira madrugada:

```bash
az containerapp job execution list -n caj-waveai-purge -g rg-waveai-prod -o table
```

Fecha a última dívida da Política: hoje o texto público promete um prazo cuja
rotina existe, foi testada, mas **nunca executou de verdade**.

### C. Diagnóstico do cold start — *medir antes de mitigar*

24,5 segundos, causa desconhecida. Se a maior parte for o Neon acordando, a
solução é barata e não toca a Azure. Manter uma réplica sempre viva **está fora
do orçamento**: a cota gratuita cobre cerca de 100 horas de instância ativa por
mês, e o mês tem 730.

Também é assunto de honestidade visual: uma tela girando por meio minuto sem
dizer nada esconde o que está acontecendo (ADR-0027).

### D. E-mails estilizados — *pedido do fundador, 2026-08-26*

Hoje os e-mails saem em texto puro. O adapter SMTP já usa `EmailMessage`, que
suporta alternativa HTML sem trocar de biblioteca.

**A decidir antes de codar:** manter sempre a versão em texto ao lado do HTML
(cliente que não renderiza precisa continuar recebendo o código); onde a cópia
vai morar; e se o visual segue o sistema "Maré" das telas.

### E. Foto de perfil — *pedido do fundador, 2026-08-26*

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

### F. Play Store — *o alvo declarado*

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
