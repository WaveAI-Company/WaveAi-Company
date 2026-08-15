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
| 9 | Navegação vestigial pré-casca (4 `NavAction` na home; tema+Sair na home do profissional) | 2 | aberto |
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
7. **Histórico** — panorama e cartões que hoje ocupam 100%.
8. **Painel do profissional** — mesmos vícios da home.
9. **`doctor/index`** — alinhamento do search, avatar da última fila (flexWrap),
   cartão estourando no celular, cartão clicável com hover.
10. **Limpeza da navegação vestigial** — os 4 `NavAction` da home do paciente e o
    seletor de tema da home do profissional. Os três "Sair" de tela já saíram
    na #150.

**Onda 3 — desenho novo e acoplar backend**

11. **Reconcepção** das áreas sem mockup: assistir ao vivo, panorama do histórico,
    faixas de aviso da home.
12. **Edição de conta no perfil** (B) — `PATCH /auth/me`, `POST /auth/email` +
    `/auth/email/confirm`, `POST /auth/password`; inclui a tela de troca de e-mail,
    que não tem mockup.
13. **Selo de autorrelato no painel do profissional** (B) — `has_annotation` já vem
    em `/patients/{id}/results`.
14. **Contagens no cartão do profissional** + emenda à ADR-0037.

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
