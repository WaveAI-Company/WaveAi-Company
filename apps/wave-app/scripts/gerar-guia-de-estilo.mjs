/**
 * Gera `Design/guia-de-estilo.html` — o guia de marca e de tema, num arquivo só.
 *
 * PARA QUEM É: quem desenha. Abre no navegador, sem repositório, sem build, sem
 * ler TypeScript. Mostra a paleta com o código de cada cor, o contraste medido,
 * a tipografia, o espaçamento, a marca e as regras que restringem o desenho.
 *
 * POR QUE É GERADO, e não escrito à mão: o material já existia — espalhado
 * entre `src/theme/tokens.ts`, `motion.ts`, `breakpoints.ts`,
 * `Design/logos_icones/` e os comentários de cada um. Uma cópia à mão viraria a
 * segunda fonte, e divergiria do produto na primeira mudança de cor. Aqui o
 * guia **é** os tokens, renderizados.
 *
 * O contraste de cada par é **calculado na hora**, não transcrito. Nenhuma
 * tabela de números para envelhecer.
 *
 * `--check` regenera em memória e compara com o arquivo versionado: sai 1 se
 * estiverem diferentes. É o que impede o guia de virar mentira depois de alguém
 * mexer numa cor sem regerar.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const RAIZ = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const REPO = join(RAIZ, "..", "..");
const SAIDA = join(REPO, "Design", "guia-de-estilo.html");
const SO_CONFERIR = process.argv.includes("--check");

/** Transpila um módulo `.ts` SEM imports e o carrega. Mesma técnica do gerador
 *  dos documentos legais: usa a API do `typescript`, que é dependência direta. */
async function carregar(caminhoRelativo) {
  const fonte = readFileSync(join(RAIZ, caminhoRelativo), "utf8");
  const js = ts.transpileModule(fonte, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const temp = join(RAIZ, "node_modules", `.cache-guia-${Date.now()}.mjs`);
  writeFileSync(temp, js, "utf8");
  try {
    return await import(pathToFileURL(temp).href);
  } finally {
    rmSync(temp, { force: true });
  }
}

/**
 * Extrai objetos `{ chave: número }` de um arquivo por regex.
 *
 * `breakpoints.ts` importa do `react-native` (tem um hook no fim), então não dá
 * para carregá-lo como módulo aqui. É a mesma técnica que o
 * `check-contrast.mjs` já usa para ler as cores — e falha de forma mansa: sem
 * o bloco, a seção some do guia em vez de derrubar a geração.
 */
function numerosDoBloco(fonte, nome) {
  const bloco = fonte.match(new RegExp(`export const ${nome}\\s*=\\s*{([\\s\\S]*?)\\n}`));
  if (!bloco) return null;
  const out = {};
  for (const [, k, v] of bloco[1].matchAll(/(\w+):\s*(\d+)/g)) out[k] = Number(v);
  return Object.keys(out).length ? out : null;
}

// -- cor -------------------------------------------------------------------

function luminancia(hex) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function razao(a, b) {
  if (!/^#[0-9a-fA-F]{6}$/.test(a) || !/^#[0-9a-fA-F]{6}$/.test(b)) return null;
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return ((x + 0.05) / (y + 0.05)).toFixed(2);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Agrupamento das cores. É a única parte **editorial** do guia: os tokens não
 * carregam categoria, e listá-los na ordem em que estão no arquivo não ajuda
 * quem desenha. Um token novo que não caia em nenhum grupo aparece em "outros",
 * para nunca sumir em silêncio.
 */
const GRUPOS = [
  {
    titulo: "Superfícies",
    nota: "Quatro níveis de elevação. O input preenchido usa `surfaceAlt`, e é sobre ele que o texto digitado precisa se sustentar.",
    chaves: ["background", "surface", "surfaceAlt", "surfaceStrong"],
  },
  {
    titulo: "Limites",
    nota: "`border` e `borderSoft` são decorativos e podem ter contraste baixo. `borderStrong` é limite de controle interativo e exige 3:1 — por isso é sólido, e não com alfa.",
    chaves: ["border", "borderSoft", "borderStrong"],
  },
  {
    titulo: "Texto",
    nota: "Três níveis. O terceiro (`textSubtle`) é o mais apertado: o tom do mockup reprovava no tema claro.",
    chaves: ["text", "textMuted", "textSubtle"],
  },
  {
    titulo: "Acento por papel",
    nota: "Paciente e profissional têm acentos próprios, e eles MUDAM entre os temas: o turquesa que rende 10:1 no escuro cai para ~1,8:1 sobre branco. `onAccentX` é a tinta que fica POR CIMA do preenchimento.",
    chaves: ["accentPatient", "accentPatientText", "onAccentPatient", "accentDoctor", "accentDoctorText", "onAccentDoctor", "onAccent"],
  },
  {
    titulo: "Estado",
    nota: "Atenção e perigo. Não são cor de papel: usam a tinta neutra `onAccent` por cima.",
    chaves: ["warning", "warningText", "danger", "dangerText"],
  },
  {
    titulo: "Bandas do espectro",
    nota: "CATEGÓRICAS, nunca uma escala. Não há gradiente de pior para melhor e nenhum tom é mais alarmante que os outros: banda não tem valência, e pintar alfa de verde ou beta de vermelho inventaria um juízo que a análise não faz.",
    chaves: ["bandDelta", "bandTheta", "bandAlpha", "bandBeta", "bandGamma"],
  },
];

function swatch(nome, valor, paleta) {
  const contra = ["background", "surface", "surfaceAlt"]
    .map((fundo) => {
      const r = razao(valor, paleta[fundo]);
      return r ? `<span class="r" title="contraste sobre ${fundo}">${fundo.replace("surfaceAlt", "alt").replace("background", "fundo")} ${r}</span>` : "";
    })
    .filter(Boolean)
    .join("");
  return `<div class="sw">
      <div class="am" style="background:${esc(valor)}"></div>
      <div class="meta"><code class="nome">${esc(nome)}</code><code class="hex">${esc(valor)}</code>
        <div class="rs">${contra}</div>
      </div>
    </div>`;
}

function blocoPaleta(tema, paleta) {
  const usadas = new Set();
  let html = "";
  for (const g of GRUPOS) {
    const presentes = g.chaves.filter((k) => k in paleta);
    presentes.forEach((k) => usadas.add(k));
    if (!presentes.length) continue;
    html += `<h3>${esc(g.titulo)}</h3><p class="nota">${esc(g.nota)}</p>
      <div class="grade">${presentes.map((k) => swatch(k, paleta[k], paleta)).join("")}</div>`;
  }
  const sobraram = Object.keys(paleta).filter((k) => !usadas.has(k));
  if (sobraram.length) {
    html += `<h3>Outros</h3><p class="nota">Tokens que ainda não têm grupo neste guia — apareceram aqui para não sumirem em silêncio.</p>
      <div class="grade">${sobraram.map((k) => swatch(k, paleta[k], paleta)).join("")}</div>`;
  }
  return `<section class="tema ${tema}" data-tema="${tema}">
    <h2>Paleta — tema ${tema === "dark" ? "escuro" : "claro"}</h2>${html}</section>`;
}

// -- marca -----------------------------------------------------------------

/**
 * Embute um SVG do kit, renomeando o id do gradiente.
 *
 * Todos os arquivos usam `id="marca"`. Num documento só, ids repetidos fazem os
 * outros SVG apontarem para o PRIMEIRO gradiente — na prática, a marca do fundo
 * claro sairia com as cores do escuro. Um sufixo por arquivo resolve.
 */
function svgDoKit(arquivo, sufixo) {
  try {
    const bruto = readFileSync(join(REPO, "Design", "logos_icones", "kit", arquivo), "utf8");
    return bruto.replace(/id="marca"/g, `id="marca-${sufixo}"`).replace(/url\(#marca\)/g, `url(#marca-${sufixo})`);
  } catch {
    return `<p class="nota">(${esc(arquivo)} não encontrado)</p>`;
  }
}

// -- página ----------------------------------------------------------------

const CSS = `
:root{color-scheme:dark;--pg:#0B1220;--card:#151E32;--alt:#1C2740;--tx:#F5F7FA;--tx2:#B6C1D4;--tx3:#8291A9;--bd:#2A3550;--ac:#4FD1C5}
*{box-sizing:border-box}
body{margin:0;padding:32px 20px 80px;background:var(--pg);color:var(--tx);
     font:15px/1.6 -apple-system,"Segoe UI",Roboto,system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto}
h1{font-size:32px;line-height:1.2;margin:0 0 6px}
h2{font-size:22px;margin:56px 0 4px;padding-top:24px;border-top:1px solid var(--bd)}
h3{font-size:15px;margin:28px 0 2px;letter-spacing:.02em}
p{color:var(--tx2)}
.lead{font-size:16px;max-width:70ch}
.nota{color:var(--tx3);font-size:13.5px;margin:4px 0 14px;max-width:78ch}
code{font-family:ui-monospace,Consolas,monospace}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.sw{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--bd);
    border-radius:12px;padding:10px}
.am{width:46px;height:46px;border-radius:9px;flex:0 0 auto;border:1px solid rgba(255,255,255,.14)}
.meta{min-width:0}
.nome{display:block;font-size:12.5px;color:var(--tx);word-break:break-all}
.hex{display:block;font-size:12px;color:var(--tx3);text-transform:uppercase}
.rs{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.r{font-size:10.5px;color:var(--tx3);background:var(--alt);border-radius:5px;padding:1px 5px;white-space:nowrap}
.tema.light .sw{background:#FFFFFF;border-color:rgba(15,23,38,.12)}
.tema.light .nome{color:#0F1726}
.tema.light .hex,.tema.light .r{color:#606E85}
.tema.light .r{background:#EDF1F6}
table{border-collapse:collapse;width:100%;font-size:14px;margin-top:10px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--bd);vertical-align:top}
th{color:var(--tx3);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
td code{color:var(--ac)}
.tipo{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:14px 18px;margin:8px 0}
.tipo .amostra{margin:0}
.tipo .spec{color:var(--tx3);font-size:12px;margin:4px 0 0}
.marcas{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-top:12px}
.marca{border:1px solid var(--bd);border-radius:12px;padding:20px;text-align:center}
.marca svg{width:110px;height:110px}
.marca .cap{font-size:12.5px;color:var(--tx3);margin-top:10px}
.fundoEscuro{background:#0B1220}
.fundoClaro{background:#F5F7FA}
.aviso{border-left:3px solid #F2C94C;background:rgba(242,201,76,.07);padding:12px 16px;border-radius:0 10px 10px 0;margin:14px 0}
.aviso strong{color:#F2C94C}
ul{color:var(--tx2)}li{margin:6px 0}
.espaco{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-top:10px}
.espaco div{text-align:center;font-size:11px;color:var(--tx3)}
.espaco i{display:block;background:var(--ac);border-radius:3px;margin-bottom:6px}
.rodape{color:var(--tx3);font-size:13px;margin-top:60px;border-top:1px solid var(--bd);padding-top:18px}
`;

function tabela(titulo, obj, sufixo = "") {
  if (!obj) return "";
  const linhas = Object.entries(obj)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}${esc(sufixo)}</td></tr>`)
    .join("");
  return `<h3>${esc(titulo)}</h3><table><tbody>${linhas}</tbody></table>`;
}

async function montar() {
  const tokens = await carregar("src/theme/tokens.ts");
  const mov = await carregar("src/theme/motion.ts");
  const bpSrc = readFileSync(join(RAIZ, "src", "theme", "breakpoints.ts"), "utf8");
  const bp = numerosDoBloco(bpSrc, "bp");
  const larguras = numerosDoBloco(bpSrc, "larguras");
  const teto = numerosDoBloco(bpSrc, "teto");

  const tipo = Object.entries(tokens.typography)
    .map(
      ([nome, v]) => `<div class="tipo">
      <p class="amostra" style="font-size:${v.fontSize}px;font-weight:${v.fontWeight};line-height:${v.lineHeight}px">
        ${esc(nome)} — A calma tem um ritmo</p>
      <p class="spec"><code>${esc(nome)}</code> · ${v.fontSize}px · peso ${v.fontWeight} · entrelinha ${v.lineHeight}px</p>
    </div>`,
    )
    .join("");

  const espacos = Object.entries(tokens.spacing)
    .map(([k, v]) => `<div><i style="width:${v}px;height:${Math.max(v, 6)}px"></i>${esc(k)} ${v}</div>`)
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WaveAI — guia de estilo</title>
<style>${CSS}</style>
</head>
<body><div class="wrap">

<h1>WaveAI — guia de estilo</h1>
<p class="lead">Marca, paleta, tipografia e as regras que restringem o desenho, num arquivo só.
Feito para abrir no navegador — não é preciso repositório nem ferramenta.</p>

<div class="aviso"><strong>Este arquivo é gerado.</strong> Ele não é uma cópia dos valores:
ele <em>é</em> os tokens do produto, lidos de <code>apps/wave-app/src/theme/</code> e de
<code>Design/logos_icones/</code>, renderizados. Editar este HTML à mão não muda o app e
se perde na próxima geração. Para mudar uma cor, mude o token; depois rode
<code>npm run gerar:guia</code> em <code>apps/wave-app</code>.</div>

<h2>Como as cores funcionam aqui</h2>
<p>Os tokens são <strong>semânticos, não literais</strong>: as telas pedem <code>text</code>,
<code>surface</code>, <code>accentPatient</code> — nunca um hex. É isso que permite trocar o
tema inteiro sem tocar em tela nenhuma.</p>
<p>Há <strong>dois temas</strong> e <strong>dois papéis</strong> (paciente e profissional de
bem-estar). Cada papel tem seu acento, e ele <strong>muda entre os temas</strong> — não por
gosto: o turquesa que rende 10:1 sobre o fundo escuro cai para cerca de 1,8:1 sobre branco,
ilegível como texto.</p>
<p>Cada amostra abaixo traz o <strong>contraste calculado</strong> contra as três superfícies
(fundo da página, cartão e trilho). Os pares obrigatórios são verificados no CI por
<code>npm run check:contrast</code>, que reprova a mudança antes de ela chegar ao produto.</p>

<div class="aviso"><strong>A armadilha que já nos pegou.</strong> O verificador valida cada tema
contra as superfícies <em>daquele tema</em>. Onde a superfície é de cor <strong>fixa</strong> —
o painel de autenticação é escuro nas larguras estreitas mesmo no tema claro —, o par "cor do
tema claro sobre fundo escuro fixo" <strong>escapa</strong> da verificação. Foi assim que a marca
ficou uma vez em 3,05:1. Se a superfície não acompanha o tema, passe as cores explicitamente e
meça na tela.</div>

${blocoPaleta("dark", tokens.palettes.dark)}
${blocoPaleta("light", tokens.palettes.light)}

<h2>Tipografia</h2>
<p>Escala com <strong>fontes do sistema</strong>, de propósito: fonte customizada é dependência
nativa, e dependência nativa exige recompilar o app a cada mudança. A identidade vem de escala,
peso e ritmo — não do desenho da letra.</p>
${tipo}

<h2>Espaçamento, raio e alvo de toque</h2>
<div class="espaco">${espacos}</div>
${tabela("Raio de canto", tokens.radius, "px")}
<h3>Alvo mínimo de toque</h3>
<p class="nota">${tokens.MIN_TOUCH}px — o piso das diretrizes de acessibilidade das duas
plataformas. Abaixo disso o controle fica difícil de acertar.</p>

<h2>Movimento</h2>
<p>Três durações, colhidas das transições dos mockups. Elas ficam num lugar só porque é a
<strong>repetição</strong> da mesma curva que faz a interface parecer uma coisa só; um
<code>.15s</code> copiado à mão garante que a próxima tela vá divergir.</p>
${tabela("Durações", mov.motion, "ms")}
${tabela("Curvas", mov.easing)}

<h2>Larguras</h2>
${bp ? tabela("Cortes (breakpoints)", bp, "px") : ""}
${larguras ? tabela("Colunas fixas", larguras, "px") : ""}
${teto ? tabela("Teto de conteúdo por tipo de tela", teto, "px") : ""}

<h2>Marca</h2>
<p>Tudo o que a marca é sai de <strong>um vetor só</strong>. Não existe segunda arte: os ícones
do app, o favicon, a tela de abertura e o material de redes saem dos mesmos contornos, então
nenhum deles pode envelhecer sozinho.</p>

<h3>Duas formas</h3>
<div class="marcas">
  <div class="marca fundoEscuro">${svgDoKit("waveai-completa-p-fundo-escuro.svg", "ce")}
    <div class="cap"><code>completa</code> · para fundo escuro</div></div>
  <div class="marca fundoClaro">${svgDoKit("waveai-completa-p-fundo-claro.svg", "cc")}
    <div class="cap"><code>completa</code> · para fundo claro</div></div>
  <div class="marca fundoEscuro">${svgDoKit("waveai-simbolo-p-fundo-escuro.svg", "se")}
    <div class="cap"><code>símbolo</code> · para fundo escuro</div></div>
  <div class="marca fundoClaro">${svgDoKit("waveai-simbolo-p-fundo-claro.svg", "sc")}
    <div class="cap"><code>símbolo</code> · para fundo claro</div></div>
</div>
<p class="nota"><strong>Completa</strong> (anel + onda + ponto) onde há espaço: capa, banner,
slide, cabeçalho. Abaixo de ~48px o traço do anel vira um fio — ele tem 3,5% do lado da arte —,
então não use a completa em coisa pequena. <strong>Símbolo</strong> (onda + ponto) para tamanhos
pequenos e para quando a marca aparece junto de outros elementos. Dentro do produto:
autenticação usa o símbolo; o app já logado usa a completa.</p>

<h3>Os dois pares de cor</h3>
<p class="nota">O nome do arquivo diz <strong>onde a arte pousa</strong>, não a cor dela.
<code>-p-fundo-escuro</code> usa turquesa → azul (<code>#4FD1C5</code> → <code>#7AA2F7</code>);
<code>-p-fundo-claro</code> usa verde-petróleo → azul (<code>#0F7A70</code> → <code>#2A5BC7</code>).
Usar o par trocado é o que deixa a marca apagada: o par claro sobre fundo claro rende 1,8:1 e o
escuro sobre fundo escuro rende 3,05:1 — contra os 10,04:1 do par certo. Não é gosto, é enxergar.</p>

<h3>O que não fazer com a marca</h3>
<ul>
  <li><strong>Não redesenhe</strong> em outra ferramenta. Se divergir do vetor, os ícones do app e
      o material passam a ser coisas diferentes.</li>
  <li><strong>Não estique.</strong> A proporção é quadrada e o <code>viewBox</code> já traz o respiro.</li>
  <li><strong>Não recolora à mão.</strong> Os dois pares existem por contraste medido; um terceiro
      par inventado não passa por verificação nenhuma.</li>
  <li><strong>Não use roxo/violeta perto da marca</strong> em gráficos: <code>#9085E9</code> /
      <code>#6D5AC4</code> é a cor com que os gráficos significam a banda gama.</li>
</ul>
<p class="nota">Arquivos prontos para redes, apresentação e material: <code>Design/logos_icones/kit/</code>
(PNG em 512/1024/2048 e SVG). Prefira o SVG sempre que a ferramenta aceitar. Os PNG de marca têm
fundo transparente; só os <code>avatar-*</code> são opacos — um PNG transparente vira marca
invisível quando a plataforma põe fundo branco por baixo.</p>

<h2>Regras que restringem o desenho</h2>
<p>Não são preferências. Vêm de decisões registradas, e uma tela que as viole não passa.</p>
<ul>
  <li><strong>Nada de claim clínica.</strong> O produto é exploratório e de bem-estar; não faz
      diagnóstico e não substitui avaliação profissional. Termos aceitos: bem-estar, tendências,
      estados mentais, exploratório.</li>
  <li><strong>A tela nunca afirma o que não é verdade.</strong> Sem "enviado" quando não se sabe
      se chegou, sem "só você vê" com o compartilhamento ligado, sem prazo que ninguém cumpre.
      "Não foi medido direito" não é a mesma frase que "foi medido e não deu".</li>
  <li><strong>Sem cor de bom/ruim onde não há valência.</strong> Bandas do espectro não têm juízo;
      contato de sensor tem (é qualidade de medição, não de pessoa).</li>
  <li><strong>eSense sempre rotulado</strong> como proprietário e não validado — é complemento
      exploratório, nunca fundamento.</li>
  <li><strong>Nenhuma medida é calculada na tela.</strong> Números vêm do servidor; a interface
      exibe e rotula.</li>
</ul>

<p class="rodape">Gerado por <code>apps/wave-app/scripts/gerar-guia-de-estilo.mjs</code> a partir de
<code>src/theme/tokens.ts</code>, <code>src/theme/motion.ts</code>, <code>src/theme/breakpoints.ts</code>
e <code>Design/logos_icones/kit/</code>. Para atualizar: <code>npm run gerar:guia</code> em
<code>apps/wave-app</code>.</p>

</div></body>
</html>
`;
}

/**
 * Quebra de linha normalizada em LF, sempre.
 *
 * Os SVG do kit são lidos do disco e, num checkout Windows, chegam com CRLF —
 * que entrava no HTML gerado. O `--check` então acusava "desatualizado" logo
 * depois de gerar, porque comparava um lado com CRLF contra o outro sem. A
 * saída passa a ser a mesma em qualquer máquina.
 */
const html = (await montar()).replace(/\r\n/g, "\n");

if (SO_CONFERIR) {
  let atual = "";
  try {
    atual = readFileSync(SAIDA, "utf8");
  } catch {
    atual = "";
  }
  if (atual.replace(/\r\n/g, "\n") !== html) {
    console.error(
      "Design/guia-de-estilo.html esta desatualizado em relacao aos tokens.\n" +
        "Rode `npm run gerar:guia` em apps/wave-app e inclua o arquivo no commit.",
    );
    process.exit(1);
  }
  console.log("guia de estilo em dia com os tokens");
} else {
  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, html, "utf8");
  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  console.log(`Design/guia-de-estilo.html  ${kb} KB`);
}
