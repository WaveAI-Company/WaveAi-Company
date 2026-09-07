# 18 — Formulário de Segurança de Dados da Play Store (rascunho para preencher)

**O que é:** o roteiro para responder o formulário *Data safety* do Play Console, com a
resposta proposta e **a razão de cada uma**. Não é um documento de leitura: é para ficar
aberto ao lado do Console na hora de preencher.

**Estado:** rascunho. Três respostas dependem de decisão do fundador (§4) e quatro
lacunas podem travar a publicação (§5).

**Data do levantamento:** 2026-09-06, contra o código em `main`.

> **O Console é a autoridade sobre os rótulos.** Os nomes das categorias aqui
> (`Health info`, `Photos`, `App interactions`…) são os da taxonomia do Google como ela
> era conhecida no levantamento, e o Google **muda a árvore sem aviso**. Confira o texto
> de ajuda de cada item na hora; se um rótulo não bater, o que vale é o **inventário do
> §2**, que saiu do código.

---

## 1. Como o levantamento foi feito

Não copiei da Política de Privacidade. Enumerei as **colunas do banco**, uma a uma, em
`services/api/app/models/` (11 arquivos), e depois conferi contra a Política — as duas
listas batem. Também varri o app atrás do que a Política afirma **não** existir:

| O que procurei | Como | Resultado |
|---|---|---|
| Analytics, telemetria, crash reporting | `grep` por `sentry\|firebase\|analytics\|amplitude\|mixpanel\|posthog\|crashlytics` no `package.json`, `src/`, `app/` e `services/` | **nenhuma ocorrência** |
| Leitura de localização | `grep` por `getCurrentPosition\|expo-location\|Geolocation` no código do app | **nenhuma** (os únicos hits estavam em `.venv` de terceiros) |
| Endereço IP persistido | leitura das 11 tabelas | **nenhuma coluna**; o limitador de taxa guarda IP **em memória** (ADR-0023) |
| Identificador de publicidade | `grep` por `adid\|advertising\|expo-tracking` | **nenhuma ocorrência** |

---

## 2. Inventário — o que sai do aparelho, coluna a coluna

| Dado | Onde vive | Cifrado no banco? | Obrigatório? |
|---|---|---|---|
| E-mail | `users.email` | não (é chave de login) | sim |
| Senha | `users.password_hash` — **só hash**, nunca texto | hash (Argon2) | sim |
| Nome de exibição | `patient_profiles.display_name` / `doctor_profiles.display_name` | não | sim |
| Identificador da conta | `users.id` (UUID) | não | sim |
| Papel (pessoa / profissional) | `users.role` | não | sim |
| Datas de consentimento e de aceite | `consent_given_at`, `consent_version`, `accepted_terms_*` | não | sim |
| Foto de perfil | `profile_photos.image` (bytes, no Postgres) | não | **opcional** |
| Sessão de captação | `capture_sessions`: aparelho, taxa, contagem de amostras, início/fim, status | não (são metadados) | decorre do uso |
| **Medidas derivadas do EEG** | `results.metrics_encrypted` | **sim** (Fernet) | **opcional** — gate da ADR-0026 |
| Proveniência | `results.device`, `results.montage`, `results.engine_version` | não, de propósito (ADR-0033) | decorre do uso |
| Anotação de contexto | `session_annotations.note_encrypted` | **sim** | opcional |
| Recado do convite | `care_links.invite_message_encrypted` | **sim** (ADR-0043) | opcional |
| Vínculo de acompanhamento | `care_links` + `care_link_events` | não | opcional |
| Trilha de acesso | `result_access_events`, `annotation_access_events`, `live_view_access_events`, `live_share_events` | não | decorre do uso |
| Sessão de login | `refresh_tokens.token_hash` (hash), `single_use_tokens` | hash | sim |

**O sinal bruto do EEG não tem linha nesta tabela, e isso é o ponto.** Ele trafega do
aparelho para o servidor pelo WebSocket, vive **só em memória** durante a captação
(`StreamState.session_samples`) e é descartado no encerramento. Nenhuma tabela o guarda.

---

## 3. Resposta proposta, item a item

### 3.1 Perguntas gerais

| Pergunta do Console | Resposta | Por quê |
|---|---|---|
| Todos os dados são **cifrados em trânsito**? | **Sim** | Tudo é HTTPS; o stream é `wss://`. Sem TLS o token da primeira mensagem viajaria em claro, e é por isso que a ADR-0025 exige o transporte cifrado. |
| Você oferece um jeito de o usuário **pedir a exclusão**? | **Sim** | Exclusão **imediata** pelo próprio app (`DeleteAccount.tsx`, ADR-0047): apaga perfil, sessões, medidas, anotações, vínculos e a trilha de acessos aos dados dele. Não há carência nem conta desativada. **Mas falta a URL pública — ver §5.A.** |
| Há **coleta de dados de crianças**? | **Não** | A Política diz que o produto não se destina a menores de 18 anos. |

### 3.2 Tipos de dado — o que marcar

| Categoria (taxonomia do Google) | Coletado | Compartilhado | Finalidade | Obrigatório |
|---|---|---|---|---|
| Personal info → **Email address** | ✔ | ✘ | App functionality, Account management | obrigatório |
| Personal info → **Name** | ✔ | ✘ | App functionality, Account management | obrigatório |
| Personal info → **User IDs** | ✔ | ✘ | App functionality, Account management | obrigatório |
| Photos and videos → **Photos** | ✔ | ✘ | App functionality | **opcional** |
| Health and fitness → **Health info** | ✔ | ✘ | App functionality | **opcional** (ver §4.1) |
| Messages → **Other in-app messages** | ✔ | ✘ | App functionality | opcional |
| App activity → **App interactions** | ✔ | ✘ | App functionality, Fraud prevention and security | decorre do uso |

**Nada é marcado como "Shared".** Google separa *compartilhar com terceiro* de *usar um
fornecedor de infraestrutura*. Neon (banco), Azure (API), Cloudflare (web) e o SMTP do
Gmail são **operadores** que tratam dado por nossa conta — não recebem dado para uso
próprio. E o profissional de bem-estar **não é terceiro**: é outro usuário do mesmo
produto, que só enxerga o que o titular autorizou, com trilha de acesso (ADR-0039,
ADR-0045).

**Nada é marcado como "processado efemeramente".** Foi tentador marcar assim o sinal
bruto — ele nunca é gravado. Mas a isenção do Google é estreita (dado usado **só** em
memória, pelo tempo de atender a requisição em tempo real), e o nosso sinal fica
acumulado **a captação inteira**, minutos, para o relatório do fecho. Além disso o sinal
bruto e as medidas caem na **mesma categoria**, e a categoria tem uma resposta só: como
as medidas são persistidas, a resposta da categoria é "não efêmero". Marcar efêmero aqui
seria ganhar uma linha bonita no formulário e ficar em falso.

### 3.3 O que **NÃO** marcar, e por quê

| Categoria | Por que fica de fora |
|---|---|
| **Location** (aproximada ou precisa) | O app **pede** `ACCESS_FINE_LOCATION`, mas **nunca lê localização**. A permissão existe só para a varredura Bluetooth no Android 11 e anteriores, que exigiam permissão de localização para varrer (ver `garantirPermissoes()` em `src/device/connection.ts`: ela só é pedida quando `Platform.Version < 31`). O plugin do BLE já declara `neverForLocation`. **Permissão pedida não é dado coletado** — mas isso vai gerar pergunta na revisão; ver §4.3. |
| **App info and performance** (crash logs, diagnostics) | Não há nenhuma biblioteca de crash ou telemetria (§1). |
| **Device or other IDs** | O campo `capture_sessions.device` guarda `"mindwave-mobile-2"` — **modelo do sensor**, não identificador de aparelho nem da pessoa. |
| **Financial info, Contacts, Calendar, Audio, Web browsing** | Não existem no produto. |
| Senha | A árvore do Google não tem tipo para credencial, e a senha só existe como hash, para autenticar. A conta já está declarada por *Email address* + *User IDs*. |

---

## 4. Três respostas que são decisão sua

### 4.1 Declarar **"Health info"** para as medidas do EEG? — **recomendo sim**

**A tensão é real.** O `Medical/71` posiciona o produto como **não-clínico e
não-diagnóstico**, e "nenhuma claim clínica" é regra rígida. Marcar `Health info` num
formulário de loja parece andar na direção contrária.

**Por que recomendo marcar mesmo assim:** a regra do `Medical/71` proíbe **afirmar
finalidade clínica** na interface, nos textos e no marketing. O formulário de segurança
de dados não afirma finalidade: ele classifica **a natureza do dado**. Potência por
banda de um sinal captado da testa de uma pessoa é, factualmente, medida fisiológica.
Dizer isso ao Google não diz à pessoa que o app diagnostica coisa alguma.

**O custo de não marcar:** se o Google discordar — e a chance é alta, porque o app se
conecta a um sensor corporal e a ficha vai descrever captação de EEG —, isso é
**declaração incorreta de segurança de dados**, que é motivo de remoção do app, não de
pedido de correção. É o erro caro na direção errada.

**O custo de marcar:** a ficha da loja passa a exibir "este app coleta informações de
saúde". Pode atrair a atenção de quem revisa para o posicionamento — o que na verdade
nos favorece, porque a Política e o consentimento já dizem, em letra grande, que o uso é
exploratório e de bem-estar.

**Se você decidir não marcar, isso precisa virar emenda registrada**, não uma escolha de
formulário — porque passa a ser uma afirmação nossa sobre a natureza do dado, e ela vai
ter de valer também na Política.

### 4.2 Em que categoria entram as **anotações de contexto**? — **recomendo `Health info`**

A anotação é texto livre que o titular escreve sobre a própria sessão ("dormi mal",
"tomei café"). Cabe em `Messages → Other in-app messages` pela forma, e em
`Health and fitness → Health info` pelo conteúdo provável.

Recomendo a **classificação mais protetiva** (`Health info`), porque é campo livre: não
controlamos o que a pessoa escreve, e classificar pelo continente em vez do conteúdo é
apostar que ninguém vai escrever nada sensível ali. O **recado do convite**, esse sim, é
mensagem de uma pessoa para outra e fica em `Other in-app messages`.

### 4.3 Manter a permissão de **localização**? — **recomendo manter, e se preparar para justificar**

`ACCESS_FINE_LOCATION` está no `app.json` e é pedida **apenas** quando o Android é
anterior ao 12, onde varrer Bluetooth exigia permissão de localização.

- **Manter:** o app funciona no Android 11 e anteriores. Preço: uma justificativa na
  revisão, e a permissão aparece na ficha.
- **Remover** (subindo o `minSdkVersion` para 31): a conversa some inteira e a ficha fica
  mais limpa. Preço: **o app deixa de instalar** em Android 11 ou anterior.

Recomendo manter nesta primeira submissão: cortar aparelhos para simplificar um
formulário é o rabo abanando o cachorro. Mas é decisão de alcance, não técnica — e é sua.

---

## 5. Quatro lacunas que podem travar a publicação

### A. Não existe URL pública de pedido de exclusão — **provavelmente bloqueante**

O Google exige, de todo app que permite **criar conta**, um endereço **acessível sem
instalar o app** onde se peça a exclusão da conta e dos dados, explicando o que é
apagado. Nosso cadastro é aberto, então a exigência se aplica.

Temos a exclusão **dentro** do app e a explicação dentro da Política. Não temos uma
**página dedicada**. O menor caminho honesto é uma rota pública nova
(`/legal/excluir-conta`, ao lado das duas que já existem e já são rotas neutras no
`RouteGuard`) que diga o que é apagado, o que sobrevive pseudonimizado e por quê
(ADR-0047), e aponte para o caminho no app e para o e-mail do encarregado.

### B. A Política de Privacidade **não é servida como texto** — risco real, medido

`https://waveai.tec.br/legal/privacidade` responde **200**, mas o que chega são
**1.425 bytes** de casca do SPA, com **zero** ocorrências de "privacidade", "coletamos"
ou "encerramento" no HTML. O texto é montado no navegador.

Um revisor humano abre no navegador e vê tudo. Uma verificação automática que busque a
URL sem executar JavaScript vê uma página vazia. Como o `app.json` já usa
`web.output: "single"`, a saída é ou pré-renderizar essas duas rotas, ou publicar uma
versão estática dos dois documentos. **Custa pouco e evita uma rejeição difícil de
diagnosticar.**

### C. A Política não nomeia os operadores de infraestrutura

A seção "Com quem compartilhamos" diz "com ninguém, por padrão" — verdade quanto a
terceiros, e é a resposta certa no formulário. Mas Neon, Azure, Cloudflare e o SMTP do
Gmail tratam dado por nossa conta, e a LGPD espera transparência sobre operadores.
Não é lacuna do formulário; é lacuna da Política, e quem revisa compara os dois.

### D. As permissões do serviço em primeiro plano são invisíveis no `app.json`

`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE` e `POST_NOTIFICATIONS` estão
no `AndroidManifest.xml` do **módulo** `apps/wave-app/modules/captacao-foreground`, não
no `app.json` — que lista só as três de Bluetooth/localização. Quem for preencher a ficha
lendo o `app.json` **não vai vê-las**, e o Google exige justificar o uso de serviço em
primeiro plano, com o tipo declarado.

A justificativa já existe pronta, escrita na ADR-0052: a captação precisa continuar com a
tela apagada, o tipo é `connectedDevice` porque o serviço mantém a conexão com o sensor
de EEG, e a notificação permanente é o preço visível — captação invisível é o oposto do
que a decisão promete.

---

## 6. O que eu não verifiquei

- **O formulário em si.** Não abri o Play Console (não há conta de desenvolvedor ainda),
  então não confirmei os rótulos atuais nem a ordem das perguntas. O §2 é o que está
  medido; o §3 é a tradução proposta para a taxonomia.
- **Se o Google aceita a página de Política como está** (lacuna B) — a medição é dos
  1.425 bytes servidos; a conclusão sobre o que o revisor aceita é inferência.
- **Se a página de exclusão precisa ser separada** da Política (lacuna A). A exigência de
  URL de exclusão é conhecida; se um âncora dentro da Política satisfaz, não sei.
- **Nada foi testado num build de loja.** O app nunca foi submetido.
