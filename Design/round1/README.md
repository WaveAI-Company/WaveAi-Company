# Design — round 1 (linguagem "Maré")

Mockups de **referência visual** para o produto WaveAI, gerados com o modelo de
design (Fable 5) a partir de um briefing com as **regras do projeto embutidas**.
São **HTML autocontidos** (CSS/JS inline, canvas 2D e SVG; sem WebGL/CDN).

**Não é código de produção** — servem de contrato visual para o porte ao app
Expo/React Native. **Todos os dados exibidos são fictícios**, para demonstração.

## Como ver
- Abra `index.html` (galeria com todas as telas) ou sirva a pasta:
  `python -m http.server` e acesse `index.html`.
- Cada tela tem **tema claro/escuro** (alternador no header) e composições para
  **desktop / tablet / mobile**.

## Telas
Conta: `login`, `criar-conta` · Paciente: `inicio-paciente`, `estado-ao-vivo`
(tela-herói), `sessoes`, `perfil`, `convites`, `consentimento` · Profissional:
`inicio-profissional`, `painel-profissional`, `convidar`.

## Regras que o design obedece
Não-clínico/não-diagnóstico (Medical/71); honestidade visual (ADR-0027: eixos
rotulados, sem veredito, sem cor de bom/ruim onde não há valência — bandas e
estados nunca; qualidade de sinal sim); termo "anomalia" ausente (ADR-0032);
eSense sempre rotulado "proprietário · não validado" (ADR-0034); acompanhante =
"profissional de bem-estar" (ADR-0036); métricas vêm do servidor.

## Ajustes pós-geração (nesta versão)
- `index`: menu **hambúrguer** no mobile (a fileira de links quebrava).
- `painel-profissional`: corrigido **overflow horizontal** no mobile (`.pro-wrap`
  → `minmax(0,1fr)` + `min-width:0`); **busca** restaurada no mobile; lista de
  pessoas em **tira deslizante horizontal** (limite de exibição fica no backend).
- Ícone de perfil (topo direito) **linkado** ao perfil nas telas do profissional.
