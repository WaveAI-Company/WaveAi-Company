/**
 * Valida o contraste dos tokens de cor nos dois temas (WCAG 2.1).
 *
 * Existe porque "contraste AA razoável" é critério de aceite da #18 e não deve
 * depender de olhômetro: cor de destaque que funciona no tema escuro costuma
 * falhar como texto no claro, e o inverso.
 *
 * Uso: node scripts/check-contrast.mjs
 * Sai com código 1 se qualquer par obrigatório falhar.
 */

import { readFileSync } from "node:fs";

const AA_TEXTO = 4.5;
const AA_TEXTO_GRANDE = 3.0;
const AA_NAO_TEXTO = 3.0;

function luminancia(hex) {
  const canais = [1, 3, 5]
    .map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

function razao(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Extrai os objetos de tema do tokens.ts sem precisar de bundler. */
function carregarTemas() {
  const fonte = readFileSync(new URL("../src/theme/tokens.ts", import.meta.url), "utf8");
  const temas = {};
  for (const nome of ["dark", "light"]) {
    const bloco = fonte.match(new RegExp(`const ${nome}Colors[^{]*{([\\s\\S]*?)\\n};`));
    if (!bloco) throw new Error(`não achei ${nome}Colors em tokens.ts`);
    const cores = {};
    for (const [, chave, valor] of bloco[1].matchAll(/(\w+):\s*"(#[0-9a-fA-F]{6})"/g)) {
      cores[chave] = valor;
    }
    temas[nome] = cores;
  }
  return temas;
}

/** Pares que precisam passar, com o mínimo exigido de cada um. */
function pares(c) {
  return [
    ["text", "background", AA_TEXTO],
    ["text", "surface", AA_TEXTO],
    ["textMuted", "background", AA_TEXTO],
    ["textMuted", "surface", AA_TEXTO],
    ["accentPatientText", "background", AA_TEXTO],
    ["accentPatientText", "surface", AA_TEXTO],
    ["accentDoctorText", "background", AA_TEXTO],
    ["accentDoctorText", "surface", AA_TEXTO],
    ["warningText", "background", AA_TEXTO],
    ["warningText", "surface", AA_TEXTO],
    // Texto sobre preenchimento de destaque (botões).
    ["onAccent", "accentPatient", AA_TEXTO],
    ["onAccent", "accentDoctor", AA_TEXTO],
    ["onAccent", "warning", AA_TEXTO],
    // Limites de controles interativos: 3:1 (WCAG 1.4.11).
    ["borderStrong", "background", AA_NAO_TEXTO],
    ["borderStrong", "surface", AA_NAO_TEXTO],
    // Traço de gráfico sobre o fundo do cartão.
    ["accentPatient", "surface", AA_NAO_TEXTO],
    ["accentDoctor", "surface", AA_NAO_TEXTO],
  ].filter(([a, b]) => c[a] && c[b]);
}

let falhas = 0;
const temas = carregarTemas();

for (const [nome, cores] of Object.entries(temas)) {
  console.log(`\n=== tema ${nome} ===`);
  for (const [fg, bg, minimo] of pares(cores)) {
    const r = razao(cores[fg], cores[bg]);
    const ok = r >= minimo;
    if (!ok) falhas += 1;
    console.log(
      `${ok ? "ok  " : "FALHA"} ${(`${fg} / ${bg}`).padEnd(38)} ${r.toFixed(2).padStart(5)} (min ${minimo})`,
    );
  }
}

console.log(
  falhas === 0
    ? "\nTodos os pares obrigatórios passam.\n"
    : `\n${falhas} par(es) abaixo do mínimo.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
