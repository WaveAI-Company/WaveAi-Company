# 15 — Pente fino de UI/UX (P13): causas, fila e estado

Frente aberta em **2026-08-13**, depois de a P12 fechar o backlog de funcionalidade.
Entrada: varredura do fundador tela a tela, nos dois temas, entregue como um PDF de
33 páginas com 49 prints. **A extração fica em `data/pente-fino/`** (fora do git,
por peso): `anotacoes.txt` (texto integral) e `prints/pNN_N.png` (as 49 imagens).

Este arquivo é a **fonte única do que falta** nesta frente. Quem retomar lê daqui,
não do PDF.

## Método combinado

- O fundador anota; **eu agrupo por CAUSA, não por tela** — a maior parte do que ele
  vê é transversal (um token, um componente).
- As PRs saem **componentes primeiro, telas depois**: ajuste de componente redesenha
  várias telas, e o contrário é retrabalho.
- Cada ausência é classificada **(A)** por regra · **(B)** backend pronto sem UI ·
  **(C)** não portado de propósito · **(D)** depende de build · **(E)** lacuna.
- O mockup (`Design/round1/`) é **contrato visual**, não especificação de
  acessibilidade: quando colidir, **medir**, manter o nosso e pôr o número no PR.

## As 12 causas

| # | Causa | Telas | Estado |
|---|---|---|---|
| 1 | `Button` sem largura própria (o `.btn` do mockup é `inline-flex`; `.btn-block` é a exceção) | 7 + casca | **feito** (#145) |
| 2 | Não existe grade de cartões — tudo empilha a 100% (`grid-template-areas` no mockup) | 5 | parcial (#153: home do paciente) |
| 3 | Estado vazio sem padrão: 4 implementações inline + `StateView` só texto | 4 | **feito** (#149) |
| 4 | Casca fora da especificação (iconbtn, avatar, role-chip, badge) | 11 | **feito** (#146) |
| 5 | `Disclaimer` solto (sem `textAlign`, sem ancoragem) + padding da tela | 11 | **feito** (#150) |
| 6 | `AuthStage` 640–1099: painel da marca é irmão do `ScrollView` e tem `overflow:hidden` | 4 | **feito** (#152) |
| 7 | Cena da marca não reage ao ponteiro; ponto pula para o frame final | 3 | aberto |
| 8 | `BandStack` 10px vs **14** (lista) e **22** (destaque) do mockup | 4 | **feito** (#151) |
| 9 | Navegação vestigial pré-casca (4 `NavAction` na home; tema+Sair na home do profissional) | 2 | **feito** (#150, #157, #158) |
| 10 | Áreas sem mockup ficaram sem sistema (panorama, faixas de aviso, assistir ao vivo) | 4 | parcial (#147 alinhou) |
| 11 | Lockup da marca empilhado no auth | 2–4 | **feito** (#152) |
| 12 | Olho de revelar senha não segue o accent do papel | 2 | **feito** (#152) |

**Causas já fechadas fora dessa lista:** coluna de conteúdo centralizada (era à
esquerda no mockup) e `flex: 1` virando altura no celular — **uma só causa** explicava
o "espaçamento muito grande" **e** a "sobreposição" do perfil (#147).

## Decisões do fundador (2026-08-13)

1. **Cards do profissional:** contagem de sessões e de autorrelatos **sim** (metadado,
   não audita); **valor** de banda (alfa 26%→34%) **não**. Sai como **emenda à
   ADR-0037** junto da fatia.
2. **Telas sem mockup:** desenhar direto, sem aprovação prévia de HTML; ajusta depois.
3. **"Sair" fica na sidebar**, contra o mockup — e sai do perfil.

## Fila (ordem de execução)

Cada item é uma PR, sai de `main` e para no verde local.

**Onda 1 — componentes (o que resta)**

1. ~~**`EmptyState`**~~ — **feito (#149)**. Saiu como `EmptyState` e não
   `EstadoVazio`: a convenção do repositório é código em inglês. O link em vez
   de botão vale **só para convites** — nos outros quatro mockups o CTA é
   `.btn.btn-primary`. Padding único `56/32/72` (a home do mockup usa `48/32/64`;
   8 px não se veem e um segundo valor viraria a próxima divergência).
2. ~~**Rodapé e respiro**~~ — **feito (#150)**. `Disclaimer` ganhou `placement`
   (`sidebar` 11,5px · `footer` centralizado e ancorado com `marginTop:"auto"` ·
   `auth` no fim da coluna, a 14px do fundo); padding do `ScreenContainer` por
   faixa: `24/32/64` · `24/24/64` · `16/16/96`.
   **O aviso continua nos dois lugares** (sidebar **e** rodapé de tela), contra o
   mockup, que só tem o da sidebar: abaixo de 768px a sidebar é gaveta fechada e
   o posicionamento de Medical/71 deixaria de estar à vista no aparelho mais
   usado. Decisão do fundador em 2026-08-14.
   Levou junto os **três botões "Sair" de tela** (`doctor/index`,
   `doctor/profile`, `patient/profile`) — parte da causa 9, antecipada porque com
   o aviso ancorado no fim eles ficariam pendurados **depois** dele.
3. ~~**`BandStack` + gráficos**~~ — **feito (#151)**. `BandStack` ganhou
   `tamanho` (14/raio 4 na lista, 22/raio 6 no destaque); `BandBars` foi de 10
   para **22** com raio 4, gap 14 e a tipografia do mockup (era a queixa da tela
   ao vivo, não estava na fila); e o `TrendChart` foi para SVG com a área sob a
   curva.
   **Achado:** o `TrendChart` **não desenhava nada** desde que passou a depender
   de `onLayout` — comprovado no baseline com `git stash`. Ver o gotcha 6 abaixo.
4. ~~**`AuthStage`**~~ — **feito (#152)**. Uma rolagem só para as duas colunas
   (marca e formulário na mesma página entre 640 e 1099); lockup em linha via
   prop no `Logo` — a sidebar segue empilhada, não cabe nos 240px; e `Field`
   ganhou `accent`, que o cadastro passa a partir do papel **selecionado**.
   O olho no accent **diverge do mockup de propósito** (lá é `--ink-3`): pedido
   do fundador, que anotou "isso não tem a ver com o mockup, mas é um detalhe".

**Onda 2 — telas**

5. ~~**Grade da home do paciente**~~ — **feito (#153)**. As três formas do
   `.home-grid`, com **três árvores** e não uma: a ordem muda de faixa para
   faixa e nenhum arranjo de `flexWrap` produz as duas com a mesma ordem de
   filhos. Cruzar 1199 ou 767 **remonta os cartões** (gráficos piscam, a onda
   reinicia); decisão do fundador em 2026-08-14, com o custo exposto — a pessoa
   usa um aparelho por vez e nada digitado se perde nesta tela.
   **Ausência registrada:** o cartão "Qualidade do sinal" da coluna direita
   **não** foi portado — **(A) por regra + (E) lacuna de dado**. O `Result` não
   tem "% de contato" (tem `signal_std`, `mains_power`, `mains_power_ratio`), e
   o verde/amarelo do mockup exigiria o limiar de "sinal bom o suficiente" que é
   a **Q-TEC-06, em aberto**. Reabrir isso é decisão de produto, não de UI.
6. ~~**Estado ao vivo**~~ — **feito (#154)**: rodapé do herói ancorado com borda
   e botão de largura de conteúdo, onda de 320px, trilho em 2 colunas no tablet,
   trio `1.35fr .9fr .9fr` (composição · sessão guiada · compartilhar) e "Ondas
   ao vivo" em linha inteira. As faixas mais grossas já tinham saído na #151.
   **Ficou de fora, de propósito:** a *nova concepção* do cartão de alfa relativa
   — é desenho novo e vai para a onda 3. Enquanto isso ele fica em linha inteira,
   fora da disputa por espaço.
7. ~~**Histórico**~~ — **feito (#155)**. Dos três pontos anotados, dois já
   tinham saído: a faixa mais grossa dos cards de sessão na #151 e o estado
   vazio na #149. Sobrava o **panorama**, que não tem mockup: virou grade
   `1.4fr 1fr` (tendência e relatório na coluna larga, "Última sessão" e "Nota
   de contexto" na estreita), `1fr 1fr` só na primeira linha no tablet.
   Critério do arranjo: **quem ganha com largura** — gráfico e texto corrido
   respiram; cartão compacto só esticava.
8. ~~**Painel do profissional**~~ — **feito (#156)**. Os quatro cartões grandes
   (alfa, composição, relatório, nota) ocupavam 100% e viraram **dois por
   linha** no desktop — no mockup são `.g-alpha`/`.g-comp`/`.g-sum`/`.g-notes`
   com `grid-column: span 2` dentro do `.dash` de quatro colunas. Abaixo de
   1200 voltam à linha inteira, que também é o mockup (`span 2` de duas colunas
   é a linha toda).
   **Achado no caminho:** os tiles tinham `flexBasis: 30%` e cabiam **três** por
   linha, então o quarto — o seletor de período — caía sozinho. O `.dash` é
   `repeat(4, …)`; passou a `22%`.
9. ~~**`doctor/index`**~~ — **feito (#157)**. Cartão inteiro clicável com o
   hover do `.pcard` (sobe 2px, borda no accent); busca e botão encostados à
   direita (`.page-top .sp{flex:1}`) e busca a 100% no celular; e o seletor de
   tema saiu (pedido explícito do fundador — conferido antes que
   `doctor/profile` já traz o mesmo seletor).
   **Dois dos quatro pontos não se reproduziam mais** ao medir: o avatar da
   última fila já estava alinhado (os espaçadores resolveram) e o cartão não
   estoura no celular (`scrollWidth == clientWidth`). Corrigidos por fatias
   anteriores.
   **Fora de escopo:** "faltam informações nos cards" é a fatia 14 (contagens +
   emenda à ADR-0037).
10. ~~**Limpeza da navegação vestigial**~~ — **feito (#158)**. Os quatro
    `NavAction` do rodapé da home do paciente saíram; o seletor de tema da home
    do profissional saiu na #157 e os três "Sair" de tela na #150.
    **Causa 9 fechada. Onda 2 fechada.**

**Onda 3 — desenho novo e acoplar backend**

11. **Reconcepção** das áreas sem mockup: assistir ao vivo, panorama do histórico,
    faixas de aviso da home.
12. ~~**Edição de conta no perfil**~~ (B) — **feito (#161 nome e senha, #162
    e-mail)**. O `AccountEditor` serve aos dois perfis.
    A troca de e-mail ficou **dentro do painel**, sem rota nova: são dois campos
    e um código, e sair do perfil para voltar seria mais navegação do que o
    fluxo merece.
    **A cópia é o cuidado principal** e obedece duas regras que apontam ao mesmo
    lugar: anti-enumeração (ADR-0024) impede dizer "e-mail já em uso" — o
    servidor responde igual nos dois casos — e honestidade visual (ADR-0027)
    impede afirmar entrega. Daí *"se o endereço estiver livre, o código chega
    nele em instantes"*, verdadeiro nos dois ramos.
13. ~~**Selo de autorrelato no painel do profissional**~~ — **feito (#159)**.
    O `has_annotation` já vinha do servidor e a lista o ignorava: ela usava um
    `Panel` de título e sobrancelha, anterior ao porte, enquanto o histórico do
    paciente já usava o `SessionRow` do design. Trocado pelo `SessionRow`, o
    que apaga a segunda representação da mesma linha de sessão.
    Verificado contra a API: 14 sessões em 30 dias, **2** com `has_annotation`,
    **2** selos na tela.
14. ~~**Contagens no cartão do profissional**~~ — **feito (#160)**. `COUNT(*)`
    de sessões e de autorrelatos em cada `CareLinkResponse` **ativo**, sem
    decifrar e **sem gerar evento de acesso**; o pendente não recebe nada.
    A **emenda à ADR-0037 (2026-08-14)** saiu em commit próprio e registra
    explicitamente o que se abre mão: sem trilha, o profissional observa o
    ritmo de uso dos vinculados sem deixar registro. O limite fixado é
    **cartão conta, cartão não mede** — alfa médio e qualidade seguem só no
    painel, pela rota auditada.

## Gotchas de verificação descobertos nesta frente

1. **A pane congela `transition`.** Ela roda com `visibilityState: "hidden"` e **0
   quadros de `requestAnimationFrame`**, então uma propriedade com `transition` fica
   no valor inicial e `getComputedStyle` **mente**. Para medir cor:
   `el.style.transition = "none"` antes de ler. Quase virou um bug de tema reportado
   que não existia.
2. **Transbordo por `right > innerWidth` dá falso positivo** quando o filho é
   decorativo dentro de `overflow:hidden` (o `WaveField` mede 1800px). O decisivo é
   `scrollWidth > innerWidth`.
3. **`resize_window` sozinho não cruza a quebra**: o `Dimensions` do RN-web só
   atualiza com um `resize` despachado em `window.visualViewport`. Com isso dá para
   testar remontagem **sem recarregar**.
4. **Regex `<Button\b[^>]*?/>` perde tags com `=>` dentro** (arrow function tem `>`).
   Conferir por contagem depois de qualquer edição em lote.
5. **`alignItems: "center"` num pai anula o `Button` de largura cheia no celular.**
   O `Button` não declara `alignSelf` na faixa móvel de propósito — conta com o pai
   em coluna para esticar. Qualquer invólucro centralizador precisa trocar o
   `alignItems` por `alignSelf: "stretch"` abaixo de 768 px, ou o botão volta à
   largura do rótulo (medido: 203 px em vez de 261 px numa tela de 375 px).
6. **`onLayout` devolve 0 e nunca mais dispara.** O `TrendChart` media a largura
   assim e ficava preso em `width === 0`: o cartão "Tendências rápidas" reservava
   180px e desenhava **nada**, em produção, sem erro no console. O `WaveField` já
   trazia a mesma nota ("medir com `onLayout` daria 0 na montagem") e contornava
   com `useWindowDimensions`. **Regra:** não medir para desenhar. Para geometria
   que precisa acompanhar o container, use `viewBox` + `preserveAspectRatio="none"`
   num `View` posicionado, com `vectorEffect="non-scaling-stroke"` na linha e o
   truque do segmento de comprimento zero com `strokeLinecap="round"` nos pontos
   (um `Circle` viraria elipse no eixo esticado). Texto **não** entra no SVG
   esticado — a fonte esticaria junto.
8. **`padding` no filho flexível rouba a fração dele.** No `AuthStage` o rodapé
   tinha `flexBasis: 0` e `paddingHorizontal: 24`: os 48px entravam como base e
   a coluna saía 26px mais larga do que devia — o aviso ficava 15px fora do
   centro do cartão. Com o respiro num `View` **filho**, a diferença caiu para
   **2px**. Vale para qualquer caixa que divida espaço por `flex`.
7. **Um `git stash` separa o seu bug do bug que já estava lá.** Antes de consertar
   o que parece regressão sua, meça o baseline: os dois minutos evitam tanto
   assumir culpa quanto declarar conserto do que não estava quebrado.

## Bugs funcionais anotados no pente fino (não são de layout)

Vieram da varredura da tela **Estado ao vivo** e **não** foram tocados pelas
fatias de UI. Cada um precisa de investigação própria:

1. **Compartilhar ao vivo resetava o botão** e aparentava não funcionar.
2. **Encerrar e iniciar de novo dava erro**, exigindo recarregar a página.
3. **Reduzir a janela para o tamanho de celular — ou trocar de aba — parava a
   captação.** Descartada a hipótese mais óbvia: a tela ao vivo usa **uma árvore
   só** com estilos condicionais, então não é remontagem por faixa. Resta
   investigar o ciclo de vida do stream (visibilidade da aba, `StreamSession`).

O fundador suspeita que 1 e 2 possam ser do simulador; 3 vale para os dois casos.

**Situação em 2026-08-16 (PRs #163 e #164 mergeadas):**

1. **Fechado.** Era o compartilhamento ao vivo, e a causa estava no servidor:
   quem publicava lia `live_sharing_enabled` do objeto carregado no `start` do
   stream, que vive pela conexão WebSocket inteira; quem liga é outra
   requisição, com outra sessão do SQLAlchemy. Como toda sessão nasce desligada
   (ADR-0045), ligar durante a captação é o único caminho — e nunca funcionava.
   Corrigido na **#164**, com dois testes (o de fluxo **não** trava a
   regressão: no `TestClient` as duas pontas dividem a mesma sessão do
   SQLAlchemy; quem trava é o que cria a segunda sessão à mão e chama
   `_publicar_ao_vivo`, o ponto de uso). Validado pelo fundador na interface.
2. **Fechado** na #163: `limparParaNovaSessao` passou a descartar a sessão
   pendente. `parar()` deixa o socket aberto de propósito (é por ele que vem o
   relatório) e só `onClosed` fecha; nessa janela, quem clicava em iniciar
   ganhava um `sessao.current` novo por cima do antigo, e o `closed` atrasado da
   sessão velha fechava **a sessão corrente**.
3. **Ainda aberto** — captação que para ao reduzir a janela ou trocar de aba.
   Não foi investigado nesta leva.

## Adiado com decisão tomada: paginação do histórico (2026-08-16)

Surgiu na revisão da tela de **Histórico**: com uma sessão por dia a lista vira
um scroll longo. O fundador decidiu **não** fazer o paliativo de cliente (um
"ver mais" sobre os dados já carregados) e **fazer a paginação de verdade
depois**. Fica registrado o que já foi apurado, para a fatia futura não
recomeçar do zero:

- **Hoje não há paginação nenhuma.** `GET /me/results` (`services/api/app/api/
  results.py`) não tem `limit`, `offset` nem `Query(`: a tela baixa o histórico
  inteiro e filtra na memória. O `SegmentedFilter` de **período** que já está no
  topo da tela é client-side sobre esse conjunto.
- **Paginar a lista não pode paginar os números.** Tendência de alfa, "Panorama
  das sessões", "Tendências por medida" e "Resumo do período" são calculados
  sobre o conjunto carregado. Se os agregados passarem a seguir a página, a tela
  dirá "resumo de 30 sessões" mostrando dez, ou mudará a tendência conforme a
  página — a tela afirmando o que não é verdade (**ADR-0027**). O desenho é:
  **lista paginada, agregados sobre o período inteiro** — duas chamadas.
- **A trilha de auditoria muda de forma.** Ler dado de titular é auditado; na
  tela do profissional, paginar multiplica os eventos e a trilha passa a
  registrar "leitura da página 3" em vez de "leitura do histórico". Decidir isso
  é parte da fatia, não detalhe de implementação.
- Filtro extra barato quando for a hora: **só sessões com autorrelato** — o
  `has_annotation` já vem do servidor como metadado (#159, emenda à ADR-0037 de
  2026-08-10: a existência da nota não audita).
- **A mesma fatia cobre a lista "Todas as sessões" do painel do profissional**
  (2026-08-16). Lá o peso é maior: cada leitura de dado de titular é auditada,
  então paginar multiplica os eventos de acesso de quem **não é** o titular —
  é o caso que decide se a trilha registra "leitura da página 3" ou uma leitura
  por visita.

## Estado da frente em 2026-08-16 — P13 essencialmente fechada

As PRs **#163** (pente fino de layout em nove telas) e **#164** (correção do
compartilhamento ao vivo) foram mergeadas, e o fundador validou o design tela a
tela na aplicação rodando. Com isso:

- **A fila 11 (reconcepção das áreas sem mockup) deixou de fazer sentido**: as
  três áreas — assistir ao vivo, faixas de aviso da home e o cartão de alfa
  relativa — foram redesenhadas dentro da própria leva, com o layout decidido
  ao vivo com o fundador, e não como fatia separada.
- O método que sobreviveu: **medir o baseline antes de mexer** e medir de novo
  nas três faixas. Dois erros vieram de medir só a faixa que motivou o ajuste
  (o piso de 420px do título quebrou o celular; o `flexBasis:300` sem
  `flexShrink` só vazava abaixo de 360px).

### O que resta de UI/backend antes da infra — revisado em 2026-08-22

Revisado com o fundador em 2026-08-22, ao abrir a conversa de infraestrutura.
Duas entradas fecharam **sem código**, uma foi **descartada**, e **duas novas
entraram**: o alvo deixou de ser demonstração interna e passou a ser **cadastro
aberto ao público, com o app na Play Store**. Isso promove dois itens legais de
"algum dia" a **pré-requisito de publicação**.

1. **Filtro e paginação** do histórico e da lista do painel — a seção acima.
   É o único item com escopo de fatia já desenhado. **Aberto.**
2. **Política de Privacidade e Termos de Uso** — **parcialmente entregue em
   2026-08-23.** Os dois documentos existem, versionados em
   `apps/wave-app/src/legal/documents.ts`, renderizados nas rotas **neutras**
   `/legal/privacidade` e `/legal/termos` (nem exigem login, nem expulsam quem
   já entrou) e linkados no cadastro. O **registro do aceite** foi **feito em
   2026-08-23** (ADR-0048): caixa obrigatória, `accepted_terms_version` +
   `accepted_terms_at`, e 409 para versão desatualizada.

   **Os `[PREENCHER]` foram preenchidos em 2026-08-23.** Eram **cinco**, não
   quatro: o quinto era o **foro**, que vive nos *Termos* e não na Política —
   erro de contagem que se repetiu nesta seção e na conversa de infra até alguém
   varrer o arquivo. Controlador = **uma** pessoa física (nomear os três
   integrantes publicaria o nome completo de duas pessoas sem melhorar a
   prestação de contas), **sem endereço** (o único que existiria é residencial),
   canal único de contato, retenção descrita por tipo de dado e foro do
   **domicílio do usuário** — que é o que dispensa endereço e o que o CDC
   garante de qualquer modo. Política **1.2**, Termos **1.1**, `TERMS_VERSION`
   **1.1** (um número só responde pelos dois, ADR-0048 §4).

   **O que ainda falta:** a **revisão jurídica** e a **hospedagem sempre no ar**.
   E uma **dependência dura**: o texto promete apagar a trilha pseudonimizada em
   **até 12 meses**, e nada a apaga hoje. O job de expurgo agendado tem de entrar
   **antes** de a URL ficar pública; se não entrar, o parágrafo volta a "enquanto
   for necessário" antes da publicação. Está anotado como `TODO(infra)` em
   `apps/wave-app/src/legal/documents.ts`, na própria seção.

   **Lacuna aberta e consciente:** a Política 1.1 promete que, mudando de forma
   material, *"avisaremos no aplicativo"* — e **esse aviso não existe**. Contas
   anteriores ficaram com o campo nulo (nulo é "não temos registro", nunca
   "recusou") e ninguém é interrompido ao entrar. Enquanto as contas antigas
   forem as de teste e a do fundador, o custo é zero; deixa de ser zero no dia
   em que houver gente de fora e os Termos mudarem. A alternativa — gate ao
   entrar para quem tem campo nulo ou versão velha — está descrita na ADR-0048
   como preterida **por tamanho**, não por mérito.

   Nota histórica do que motivou a entrada: Não existem:
   varrido o repo inteiro, as duas expressões só aparecem no mockup
   `Design/round1/criar-conta.html` e dentro de `.venv` (ruído de dependência).
   A tela implementada já trata a ausência com honestidade —
   `apps/wave-app/app/register.tsx:232` diz, em comentário, que os links do
   mockup não existem. Com cadastro aberto isso vira bloqueador: a Play Store
   exige a política numa **URL pública acessível sem login**, logo ela **não
   pode morar num servidor que fica desligado**. O texto é do fundador; a
   engenharia só hospeda e liga.
3. **Exclusão de conta** — **novo, aberto.** Zero ocorrências no repo inteiro
   (`excluir conta`, `delete_account`, `apagar conta`, `encerrar conta`).
   Exigida pela Play Store para apps com login e pelo direito de eliminação da
   LGPD. **Começa por ADR**, porque colide de frente com a **ADR-0037**: apagar
   a conta e preservar a trilha de auditoria de leitura de dado do titular são
   objetivos opostos, e a fronteira entre eles é decisão do fundador.
4. **"Encerrar protocolo" em duas linhas** no layout grande — **fechado em
   2026-08-22**: o rótulo passa a ser **"Encerrar"**. Metade do trilho dá 133px,
   101 úteis, e o rótulo antigo pedia 114. O botão já vive dentro do cartão do
   protocolo guiado, então o substantivo era redundante.
5. **Hover do cartão de convite pendente**: decidido **não fazer**. No RN-web
   0.86 o hover só existe em `Pressable` de fato interativo, e o cartão não leva
   a lugar nenhum.

### Fechados sem código em 2026-08-22

- **Bug 3 da tela ao vivo** (a captação parava ao trocar de aba ou reduzir a
  janela): **é dev-only e não será corrigido.** A captação no web de produção
  não existe — `apps/wave-app/src/device/connection.web.ts:16` tem
  `supported: false`, e `apps/wave-app/src/capture/availability.ts:40` define
  `capturaDisponivel() = supported || SIMULADOR_HABILITADO`, com o simulador
  **desligado em produção por regra**. O que travava era o `setInterval` de
  `apps/wave-app/app/patient/live.tsx:321` e `:373`, que o navegador estrangula
  em aba oculta; no Android (`src/device/connection.ts:85`) e no iOS
  (`src/device/connection.ios.ts:104`) não existe "trocar de aba".
  **Ressalva honesta:** o mecanismo foi **traçado, não reproduzido**. E o
  espectador ao vivo usa `fetch`+`getReader`
  (`apps/wave-app/src/api/liveWatch.ts:105`), mecanismo diferente de timer —
  **não foi medido**. É um risco distinto, nunca relatado, e segue sem dono.
- **Faixa "convite aguardando resposta" na home do paciente**: decidido
  **manter**. Tirá-la deixaria o convite sem indicação em duas das três faixas,
  porque o badge da sidebar é escondido no rail (768–1199, fidelidade ao
  mockup) e no celular a sidebar é gaveta.
- **Sino de notificações**: **descartado — não será feito.** Era proposta do
  fundador em 2026-08-16 e foi retirada por ele em 2026-08-22. Não existia nada
  no backend (varrido `services/api/app`, zero ocorrência de
  `notification`/`notificac`) e teria exigido ADR. O aviso de consentimento
  nunca deveria ter ido para ele de todo jeito: sem consentimento os resultados
  não são guardados, e isso é condição, não recado.

### Dívidas que a infra vai encontrar (registradas no código)

Nenhuma delas bloqueia a P13; todas viram decisão quando houver mais de uma
réplica ou operação real:

- `app/api/deps.py:35` — **rate limiter em memória do processo** (ADR-0023).
  `TODO(#19)`: Redis para múltiplas réplicas. Com duas réplicas, o limite de 5
  tentativas por 60s vira 10.
- `app/api/deps.py:268` — **IP do cliente vem de cabeçalho falsificável** sem um
  proxy confiável à frente. Decidir o proxy é decisão de infra.
- `app/api/live.py:12` — **o SSE segura a conexão do banco** durante a
  transmissão inteira (a sessão do request só fecha no fim). Aceitável para
  poucos espectadores por instância; ao escalar, sessão de vida curta ou driver
  assíncrono.
- `app/security/crypto.py:10` — **rotação da chave de cifra**: Fernet suporta
  `MultiFernet` para rotacionar sem reprocessar tudo. Entra quando houver
  operação real.

### Estado do banco de dev

O convite de `prof.convite1` para `paciente.um` **com recado** foi criado à mão
em 2026-08-16, para conferir a citação atribuída da ADR-0043 na tela. Não vem do
seed: recuse pela própria tela quando não precisar mais dele.

## Banco de dev para a varredura

Seed: `paciente.um/dois/tres@example.com` e `dra.ficticia@example.com`.
Recuperadas pelo fluxo real e com a mesma senha: `vazio.teste@example.com` (paciente
zerado), `prof.convite1@example.com` (profissional zerado), `prof.convite2@example.com`
(só um convite pendente). Senha de todas: `senha-de-teste-bem-longa-7`.

- **`paciente.dois`/`tres`** são as contas para julgar desenho e gráfico — dados bem
  formados.
- **`paciente.um`** tem sessões de simulador com **alfa ~98%**, que deformam gráfico e
  narrativa. Serve para volume e para o selo de autorrelato, não para julgar desenho.
- E-mail de dev sai no stdout do container: `docker compose logs -f api`.
- **Login tem limite de 5 tentativas por 60 s por IP** — trocar de conta rápido
  devolve 429; reiniciar o container da API zera o limitador.
