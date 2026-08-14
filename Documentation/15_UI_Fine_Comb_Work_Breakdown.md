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
| 2 | Não existe grade de cartões — tudo empilha a 100% (`grid-template-areas` no mockup) | 5 | aberto |
| 3 | Estado vazio sem padrão: 4 implementações inline + `StateView` só texto | 4 | **feito** (#149) |
| 4 | Casca fora da especificação (iconbtn, avatar, role-chip, badge) | 11 | **feito** (#146) |
| 5 | `Disclaimer` solto (sem `textAlign`, sem ancoragem) + padding da tela | 11 | **feito** (#150) |
| 6 | `AuthStage` 640–1099: painel da marca é irmão do `ScrollView` e tem `overflow:hidden` | 4 | aberto |
| 7 | Cena da marca não reage ao ponteiro; ponto pula para o frame final | 3 | aberto |
| 8 | `BandStack` 10px vs **14** (lista) e **22** (destaque) do mockup | 4 | aberto |
| 9 | Navegação vestigial pré-casca (4 `NavAction` na home; tema+Sair na home do profissional) | 2 | aberto |
| 10 | Áreas sem mockup ficaram sem sistema (panorama, faixas de aviso, assistir ao vivo) | 4 | parcial (#147 alinhou) |
| 11 | Lockup da marca empilhado no auth | 2–4 | aberto |
| 12 | Olho de revelar senha não segue o accent do papel | 2 | aberto |

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
3. **`BandStack` + gráficos** — 10 → 14 na lista e 22 no destaque; estilo do
   "Tendências rápidas".
4. **`AuthStage`** — marca dentro do `ScrollView` entre 640 e 1099 + lockup em linha
   + olho da senha no accent do papel (4 telas de auth).

**Onda 2 — telas**

5. **Grade da home do paciente** (`.home-grid`: `1.4fr 1fr` com áreas).
6. **Estado ao vivo** — trio de cartões lado a lado, cartão de sessão guiada,
   faixas mais grossas, tablet em 2 colunas.
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
