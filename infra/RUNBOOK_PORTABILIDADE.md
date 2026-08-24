# Runbook de portabilidade — subir o WaveAI em outra nuvem

**Para que serve:** o backend vive na **Azure Container Apps** com crédito Azure
for Students, que **expira**. Quando o crédito acaba, a Azure desabilita a
assinatura e descomissiona os recursos (emenda à ADR-0049 de 2026-08-23). Este
documento existe para que essa data seja um transtorno de uma tarde, e não uma
crise — runbook escrito sob pressão é runbook errado.

**Estado deste documento (2026-08-23):** o inventário e os invariantes abaixo
foram **extraídos do código e conferidos**, com arquivo e linha. O
**procedimento** ainda **não foi executado nenhuma vez** — nem na Azure, nem em
outro lugar. Trate os passos como plano revisável, não como receita testada, até
que a primeira execução real o corrija.

---

## 1. O que sobrevive à queda de qualquer nuvem

Três coisas ficam **fora** do provedor de container, de propósito. São elas que
transformam "a nuvem caiu" em indisponibilidade em vez de perda:

| O quê | Onde vive | Por quê |
|---|---|---|
| **Os dados** | Neon (Postgres gerenciado) | Decisão 3 da emenda: pôr o banco dentro da assinatura faria a expiração destruir dado de titular. É **proibido** movê-lo para dentro do provedor de container. |
| **O domínio e o site** | Cloudflare (DNS + Pages) | `https://waveai.tec.br` e as páginas legais não dependem da API para responder. A URL que a Play Store exige continua no ar mesmo com o backend fora. |
| **O código e as imagens** | GitHub | Nada de configuração vive só num painel: o que o serviço precisa está versionado aqui. |

Se o provedor de container sumir amanhã, perde-se **o serviço**, não o dado, não
o endereço e não a configuração.

---

## 2. O contrato mínimo — o que qualquer nuvem precisa cumprir

Dois containers HTTP sem estado, uma conexão de saída para o Postgres, e um
executor de tarefa agendada. Nada além disso.

### Imagens e portas

| Serviço | Contexto de build | Base | Porta | Comando |
|---|---|---|---|---|
| API | `services/api` | `python:3.11-slim` | **8000** | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| Analysis | `services/analysis` | `python:3.11-slim` | **8001** | `uvicorn app.main:app --host 0.0.0.0 --port 8001` |

Multi-arquitetura: as bases oficiais cobrem amd64 e arm64, então nenhuma decisão
de CPU do provedor obriga a mudar imagem.

### Variáveis da API (prefixo `WAVEAI_API_`)

**Sem estas duas o serviço recusa-se a funcionar, de propósito** — é fail-closed,
não descuido:

| Variável | Regra | Onde é validada |
|---|---|---|
| `JWT_SECRET` | mínimo **32 bytes**; gerar com `openssl rand -hex 32` | [config.py:194](../services/api/app/config.py:194) |
| `RESULT_ENCRYPTION_KEY` | chave **Fernet válida**; `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | [config.py:205](../services/api/app/config.py:205) |

> **Estes dois segredos NÃO se recriam à toa.** Trocar `RESULT_ENCRYPTION_KEY`
> torna ilegível todo `Result` já cifrado — os dados continuam lá e ninguém mais
> os lê. Numa migração, os segredos **viajam**; não se geram de novo. Gerar
> novos só faz sentido em ambiente novo e vazio.

Obrigatórias na prática, ainda que tenham default de desenvolvimento:

| Variável | Valor em produção | Nota |
|---|---|---|
| `APP_ENV` | `production` | Qualquer valor ≠ `development` já liga o cookie `Secure` ([config.py:190](../services/api/app/config.py:190)) |
| `DATABASE_URL` | string do Neon, driver `postgresql+psycopg://` | O default aponta para localhost |
| `ANALYSIS_URL` | endereço interno do serviço Analysis | Default `http://localhost:8001` |
| `CORS_ORIGINS` | `https://waveai.tec.br` | **Obrigatória** desde a emenda de 2026-08-23: app e API em hosts diferentes. Curinga é proibido com credenciais |
| `EMAIL_LINK_BASE_URL` | `https://waveai.tec.br` | Base dos links de verificação e recuperação |
| `EMAIL_FROM` | remetente real | O default é `@waveai.local`, que não existe |
| `AUDIT_PSEUDONYM_RETENTION_DAYS` | `365` | Aumentar sem mudar a Política seria guardar além do prometido |

Analysis usa prefixo `WAVEAI_ANALYSIS_` e hoje só precisa de `APP_ENV`.

**Nunca em arquivo versionado.** Segredos entram pelo mecanismo de ambiente do
provedor. O `.gitignore` da raiz cobre `.env` e `.env.*`, exceto os `.example`.

### Comandos que a plataforma precisa saber executar

```bash
# Migração — passo do pipeline, NUNCA no boot do container
cd services/api && alembic upgrade head

# Expurgo — tarefa agendada (a Política promete até 12 meses)
cd services/api && python -m scripts.purge_audit_trail
```

---

## 3. Invariantes — o que não pode mudar de lugar sem quebrar

1. **Uma réplica no máximo.** O fan-out ao vivo e o rate limiter vivem na memória
   do processo. Com duas réplicas, o profissional deixa de ver a transmissão do
   paciente **sem erro e sem log** (decisão 3 da ADR-0049).
2. **App e API sob o mesmo domínio registrável** — `waveai.tec.br` e
   `api.waveai.tec.br`. O refresh token é cookie `SameSite=Lax`
   ([auth.py:159](../services/api/app/api/auth.py:159)): em sites diferentes o
   navegador não o envia e **o login no web para de funcionar**. Endereços
   gratuitos de provedor (`*.azurecontainerapps.io`, `*.run.app`) servem para
   conferir um deploy, nunca como endereço de produção.
3. **Migração é passo do pipeline, não do boot.** Migrar no boot faria duas
   instâncias rodarem a mesma migração ao mesmo tempo no dia em que houver duas.
4. **O expurgo precisa de alguém que o chame.** Sem agendador, a Política promete
   um prazo que ninguém cumpre.

---

## 4. Procedimento de migração

Ordem pensada para que **nada fique fora do ar antes de o substituto responder**.
Cada passo tem um critério de pronto; não avance sem ele.

**1. Construir as imagens no novo registro.**
Mesmos Dockerfiles, sem alteração.
*Pronto quando:* as duas imagens existem no registro do novo provedor.

**2. Criar os dois serviços, com uma réplica no máximo.**
Analysis primeiro (a API depende dele), depois a API.
*Pronto quando:* `/health` responde 200 nos dois, pelos endereços internos do
provedor.

**3. Levar os segredos, não gerar novos.**
`JWT_SECRET` e `RESULT_ENCRYPTION_KEY` são copiados do ambiente antigo. Ver o
aviso da seção 2.
*Pronto quando:* a API sobe sem erro de validação de configuração.

**4. Apontar para o mesmo banco Neon.**
Nenhuma migração de dados: o banco não se move.
*Pronto quando:* `alembic current` no novo ambiente mostra a mesma revisão do
antigo.

**5. Rodar `alembic upgrade head`.**
Normalmente não haverá nada a aplicar — é conferência, não mudança.

**6. Conferir pelo endereço provisório do provedor**, antes de mexer no DNS.
Login **não vai funcionar** aqui, e isso é esperado: o cookie depende do domínio
(invariante 2). O que se confere neste passo é `/health`, uma rota autenticada
por cabeçalho e a conexão com o banco.

**7. Reapontar `api.waveai.tec.br` no DNS da Cloudflare** para o novo endereço.
*Pronto quando:* `https://api.waveai.tec.br/health` responde 200 com certificado
válido.

**8. Conferir o login de verdade**, no navegador, em `https://waveai.tec.br`.
Este é o teste que os passos anteriores não conseguem fazer.

**9. Reagendar o expurgo** no agendador do novo provedor.
*Pronto quando:* uma execução manual imprime o total e o corte, com código de
saída 0.

**10. Só então desligar o ambiente antigo.**

**Se algo falhar depois do passo 7**, o retorno é reapontar o DNS para o
endereço antigo — por isso o passo 10 é o último. Mantenha o ambiente anterior de
pé por pelo menos um ciclo completo de uso.

---

## 5. Ensaiar sem derrubar nada

O procedimento inteiro pode ser exercitado até o passo 6 **sem tocar no DNS** e
sem afetar quem estiver usando: o novo ambiente sobe, conecta no mesmo banco e
responde pelo endereço provisório. O único cuidado é **não rodar migração
destrutiva** durante o ensaio — as duas pontas compartilham o banco.

Ensaiar isso uma vez, com calma, antes de precisar, é o que separa este
documento de um plano imaginário.

---

## 6. O que ainda NÃO existe

Registrado aqui porque quem seguir este runbook vai esbarrar:

- **Provedor de e-mail real.** [`build_email_sender`](../services/api/app/services/email.py:75)
  só conhece o console, e **levanta erro fora de `development`**. A API sobe, mas
  toda rota que envia e-mail falha: **cadastro, verificação, recuperação de senha
  e convite**. Com `email_verification_required=True`, isso significa que
  **ninguém consegue criar conta em produção**. A decisão já foi tomada — conta
  Gmail corporativa com chave de API, como terceira implementação do mesmo
  `Protocol`, por emenda à ADR-0044 — mas **não foi implementada**.
- **Agendador do expurgo.** O comando existe e é testado; ninguém o chama.
- **Índice em `pseudonymized_at`.** Irrelevante no volume atual; num banco grande,
  o `DELETE` do expurgo faria varredura sequencial.
