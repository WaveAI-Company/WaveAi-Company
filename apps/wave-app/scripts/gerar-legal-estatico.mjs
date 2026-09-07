/**
 * Gera uma cópia ESTÁTICA dos documentos legais, para leitura sem JavaScript.
 *
 * POR QUE ISTO EXISTE
 * O app web é uma SPA (`web.output: "single"`): `waveai.tec.br/legal/privacidade`
 * responde 200, mas o que chega são ~1,4 KB de casca — **zero** ocorrência do
 * texto no HTML, porque o documento é montado no navegador. Um revisor humano
 * abre e vê tudo; uma verificação automática que busque a URL sem executar
 * JavaScript vê uma página vazia. É a lacuna B do
 * `Documentation/18_Play_Store_Seguranca_de_Dados.md`.
 *
 * A alternativa era pré-renderizar o app inteiro (`web.output` estático), o que
 * muda a forma do build e o roteamento em produção — blast radius em toda rota,
 * para resolver três páginas. Isto aqui não toca no app: escreve três arquivos
 * em `public/`, que o Cloudflare Pages serve **antes** do fallback de rota (a
 * regra `/* -> /index.html 200` do `_redirects` é a última da lista, e o próprio
 * arquivo documenta que arquivos existentes são servidos antes dela).
 *
 * NÃO PODE FICAR DESATUALIZADO, e é por isso que roda dentro do `build:web`:
 * quem publica é o Cloudflare Pages, rodando esse mesmo comando. A cópia
 * estática nasce a cada deploy, do mesmo `documents.ts` que o app renderiza.
 * Por isso a saída é **ignorada pelo git** — é produto de build, como o `dist/`.
 *
 * COMO O TYPESCRIPT É LIDO
 * `documents.ts` não importa nada (conferido), então basta transpilar o arquivo
 * e importar o resultado. Usa a API do `typescript`, que é **dependência direta
 * do app** — logo garantida por `npm ci` no ambiente de build. Deliberadamente
 * NÃO usa `--experimental-strip-types` do Node: ele exige Node 22.6+, e a versão
 * do Node no Cloudflare Pages não é nossa para escolher — quebrar o deploy
 * inteiro do site por causa de três páginas seria péssimo negócio.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const RAIZ = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const FONTE = join(RAIZ, "src", "legal", "documents.ts");
const DESTINO = join(RAIZ, "public", "documentos");
/** Onde o app renderiza o mesmo texto — citado no rodapé de cada página. */
const ROTA_NO_APP = { privacidade: "/legal/privacidade", termos: "/legal/termos", "excluir-conta": "/legal/excluir-conta" };

/** Transpila e importa o módulo de documentos. Sem checagem de tipos: só apagar. */
async function carregarDocumentos() {
  const js = ts.transpileModule(readFileSync(FONTE, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const temp = join(RAIZ, "node_modules", ".cache-legal-estatico.mjs");
  mkdirSync(dirname(temp), { recursive: true });
  writeFileSync(temp, js, "utf8");
  try {
    return await import(pathToFileURL(temp).href + `?v=${Date.now()}`);
  } finally {
    rmSync(temp, { force: true });
  }
}

/** Escapa o que muda o significado do HTML. O texto é puro, e continua puro. */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `2026-09-06` -> `06/09/2026`. Sem fuso: a data é do documento, não do leitor. */
function data(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Paleta da página — **uma tabela só**, que serve ao CSS e à conta de contraste.
 *
 * Na primeira versão eu escrevi as cores duas vezes: no CSS e na tabela que
 * mede. Ao provar que a guarda de contraste falha (troquei uma cor por uma ruim
 * e ela reprovou, como devia), notei que a troca **não tinha mexido no CSS** —
 * ou seja, era possível mudar o que a página mostra sem mudar o que a conta
 * confere, e ficar com uma aprovação que não valia nada. Duas cópias divergem
 * na primeira correção; esta agora é uma.
 *
 * São os mesmos tokens de `src/theme/tokens.ts`, copiados para cá porque esta
 * página **não carrega nada do app** — nem CSS, nem fonte, nem script. Uma
 * página legal que depende de recurso externo é uma página que pode chegar em
 * branco, que é justamente o defeito que ela veio consertar.
 */
const PALETA = {
  claro: { fundo: "F5F7FA", superficie: "FFFFFF", texto: "161C29",
           suave: "3D4A5F", sutil: "606E85", borda: "D5DDE8", marca: "0F7A70" },
  escuro: { fundo: "0B1220", superficie: "151E32", texto: "E7ECF5",
            suave: "AFBCD0", sutil: "8291A9", borda: "2A3550", marca: "4FD1C5" },
};

const variaveis = (tema) =>
  Object.entries(PALETA[tema]).map(([k, v]) => `--${k}:#${v};`).join(" ");

const CSS = `
:root { color-scheme: light dark; ${variaveis("claro")} }
@media (prefers-color-scheme: dark) { :root { ${variaveis("escuro")} } }
* { box-sizing: border-box; }
body { margin:0; padding:24px 16px 64px; background:var(--fundo); color:var(--texto);
       font:16px/1.6 -apple-system,"Segoe UI",Roboto,system-ui,sans-serif; }
main { max-width:760px; margin:0 auto; background:var(--superficie);
       border:1px solid var(--borda); border-radius:16px; padding:40px; }
.eyebrow { font-size:11px; font-weight:700; letter-spacing:.09em; text-transform:uppercase;
           color:var(--sutil); margin:0 0 8px; }
h1 { font-size:28px; line-height:1.25; margin:0; }
.resumo { color:var(--suave); margin:8px 0 0; }
.selo { color:var(--sutil); font-size:14px; margin:12px 0 0; }
h2 { font-size:17px; margin:32px 0 12px; }
p, li { color:var(--suave); font-size:15px; }
ul { padding-left:20px; }
li { margin:8px 0; }
footer { max-width:760px; margin:24px auto 0; color:var(--sutil); font-size:14px; }
footer a { color:var(--marca); }
@media (max-width:600px) { main { padding:24px 20px; border-radius:12px; } h1 { font-size:23px; } }
`;

function pagina(doc, outros) {
  const secoes = doc.secoes
    .map((s) => {
      const ps = (s.paragrafos ?? []).map((p) => `      <p>${esc(p)}</p>`).join("\n");
      const li = (s.itens ?? []).map((i) => `        <li>${esc(i)}</li>`).join("\n");
      const lista = li ? `      <ul>\n${li}\n      </ul>` : "";
      return `      <h2>${esc(s.titulo)}</h2>\n${[ps, lista].filter(Boolean).join("\n")}`;
    })
    .join("\n\n");

  const links = outros
    .map((o) => `<a href="./${o.slug}.html">${esc(o.titulo)}</a>`)
    .join(" · ");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.titulo)} — WaveAI</title>
<meta name="description" content="${esc(doc.resumo)}">
<style>${CSS}</style>
</head>
<body>
  <main>
    <p class="eyebrow">${esc(doc.titulo)} · versão ${esc(doc.versao)}</p>
    <h1>${esc(doc.titulo)}</h1>
    <p class="resumo">${esc(doc.resumo)}</p>
    <p class="selo">Atualizada em ${data(doc.atualizadoEm)}</p>

${secoes}
  </main>
  <footer>
    <p>Leia também: ${links}</p>
    <p>Esta é a versão em página estática, para leitura sem JavaScript. O mesmo
    texto, na mesma versão, está no aplicativo em
    <a href="https://waveai.tec.br${ROTA_NO_APP[doc.slug]}">waveai.tec.br${ROTA_NO_APP[doc.slug]}</a>.</p>
  </footer>
</body>
</html>
`;
}

/**
 * Contraste dos pares desta página — medido aqui porque o `check-contrast.mjs`
 * **não alcança isto**: ele valida os tokens do tema contra as superfícies do
 * tema, e estas cores vivem dentro de um HTML gerado. Foi exatamente um par
 * fora do verificador que deixou a marca em 3,05:1 no painel de autenticação; a
 * conta anda junto do arquivo para não repetir. Lê da MESMA `PALETA` que o CSS.
 */
const AA_TEXTO = 4.5;

function luminancia(hex) {
  const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return Number(((x + 0.05) / (y + 0.05)).toFixed(2));
}

function conferirContraste() {
  console.log(`\ncontraste do texto (WCAG AA: ${AA_TEXTO}:1):`);
  let reprovados = 0;
  for (const [tema, t] of Object.entries(PALETA)) {
    const medidas = {
      "corpo / cartão": razao(t.suave, t.superficie),
      "título / cartão": razao(t.texto, t.superficie),
      "selo / cartão": razao(t.sutil, t.superficie),
      "rodapé / fundo": razao(t.sutil, t.fundo),
      "link / fundo": razao(t.marca, t.fundo),
    };
    for (const [nome, valor] of Object.entries(medidas)) {
      const ok = valor >= AA_TEXTO;
      if (!ok) reprovados += 1;
      console.log(`  ${tema.padEnd(7)} ${nome.padEnd(16)} ${String(valor).padStart(5)}:1${ok ? "" : "   <- ABAIXO"}`);
    }
  }
  if (reprovados > 0) {
    console.error(`\n${reprovados} par(es) abaixo de ${AA_TEXTO}:1 — corrija antes de publicar`);
    process.exit(1);
  }
}

const mod = await carregarDocumentos();
const docs = Object.values(mod.DOCUMENTOS);
if (docs.length === 0) {
  // Falhar alto: uma geração vazia que passasse batido publicaria o silêncio
  // exatamente onde a lacuna B já publicava silêncio.
  console.error("nenhum documento em DOCUMENTOS — nada a gerar");
  process.exit(1);
}

mkdirSync(DESTINO, { recursive: true });
console.log("documentos legais em página estática (sem JavaScript):");
for (const doc of docs) {
  const html = pagina(doc, docs.filter((d) => d.slug !== doc.slug));
  const caminho = join(DESTINO, `${doc.slug}.html`);
  writeFileSync(caminho, html, "utf8");

  // Mede o que a lacuna B media: o texto está NO HTML, e não só na tela depois
  // de um script rodar. Compara contra a primeira frase do documento.
  const primeiraFrase = (doc.secoes[0].paragrafos?.[0] ?? doc.secoes[0].itens?.[0] ?? "").slice(0, 40);
  const temTexto = primeiraFrase.length > 0 && html.includes(esc(primeiraFrase));
  if (!temTexto) {
    console.error(`  ${doc.slug}: o texto NAO entrou no HTML`);
    process.exit(1);
  }
  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  console.log(
    `  documentos/${doc.slug}.html  v${doc.versao}  ${kb} KB  ${doc.secoes.length} secoes  texto no HTML: sim`,
  );
}

conferirContraste();
