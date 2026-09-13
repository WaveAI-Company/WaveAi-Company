// Gera apresentacao/Rede_WaveAI_Apresentacao.pptx — 10 minutos, 3 integrantes.
// Uso: NODE_PATH=<node_modules com pptxgenjs> node fonte/gerar_apresentacao.js
// Cores da marca: apps/wave-app/src/theme/tokens.ts (fundo escuro, teal do titular, azul do profissional).

const path = require("path");
const pptxgen = require("pptxgenjs");

const RAIZ = path.resolve(__dirname, "..");
const ESCURO = "0B1220";
const CLARO = "F5F7FA";
const TEAL = "0F7A70";
const TEAL_CLARO = "4FD1C5";
const AZUL = "2A5BC7";
const TEXTO = "1B2433";
const SUAVE = "5B6B7F";
const VERMELHO = "C62828";
const BRANCO = "FFFFFF";
const F = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5,625 pol
pres.title = "Rede do WaveAI";

const T = (slide, texto, o) => slide.addText(texto, { fontFace: F, isTextBox: true, margin: 0, color: TEXTO, ...o });
// Uma linha só, de propósito: título que quebra invade o conteúdo abaixo.
const titulo = (slide, texto, cor = TEXTO) => T(slide, texto, { x: 0.5, y: 0.28, w: 9, h: 0.6, fontSize: 26, bold: true, color: cor, fit: "shrink" });
const cartao = (slide, x, y, w, h, fill = BRANCO, linha = "D5DDE8") =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: linha, width: 0.75 }, rectRadius: 0.08 });
const selo = (slide, texto, x, y, cor = TEAL, d = 0.42) => {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: cor }, line: { color: cor } });
  T(slide, texto, { x, y, w: d, h: d, fontSize: 11, bold: true, color: BRANCO, align: "center", valign: "middle" });
};
const rodape = (slide, quem, cor = SUAVE) => T(slide, quem, { x: 0.5, y: 5.2, w: 9, h: 0.25, fontSize: 10, color: cor, align: "right" });

// 1 — Capa ------------------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: ESCURO };
  T(s, "NÃO-CLÍNICO · BEM-ESTAR EXPLORATÓRIO", { x: 0.6, y: 0.7, w: 8, h: 0.3, fontSize: 12, bold: true, color: TEAL_CLARO, charSpacing: 2 });
  T(s, "Rede do WaveAI", { x: 0.6, y: 1.15, w: 8.8, h: 1.0, fontSize: 48, bold: true, color: BRANCO });
  T(s, "Enlaces, falhas e requisitos de um sistema de EEG de consumo que já está em produção", { x: 0.6, y: 2.15, w: 8.2, h: 0.8, fontSize: 20, color: "C9D4E3" });
  T(s, [
    { text: "Tiago Bryan Ramos de Oliveira · Gustavo Mendes Vetieri Mariano · Nickolas Maia de Araujo", options: { breakLine: true } },
    { text: "Sistemas Distribuídos Aplicado à Internet das Coisas · Prof. Rodrigo dos Santos Faustino", options: { breakLine: true } },
    { text: "ADS AMS · 2º ano, noite · setembro de 2026" },
  ], { x: 0.6, y: 3.9, w: 8.8, h: 1.0, fontSize: 13, color: "9FB0C6", paraSpaceAfter: 4 });
  s.addNotes("TIAGO — 0:00 a 0:15. Apresenta o grupo e diz em uma frase: vamos mostrar a rede do WaveAI como ela está no ar, onde ela falha e o que medimos.");
}

// 2 — O problema --------------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: CLARO };
  titulo(s, "O que o WaveAI faz");
  T(s, "Um headset de EEG de consumo capta o sinal da testa; o celular repassa à nossa API; ela calcula tendências e mostra num painel — ao próprio usuário e, se ele autorizar, a um profissional de bem-estar. Em produção desde 26/08/2026. Sem firmware próprio: o do headset é fechado.", { x: 0.5, y: 0.95, w: 9, h: 0.75, fontSize: 14, color: SUAVE });
  const nos = ["Headset", "Celular", "API", "Analysis", "Banco", "Painel"];
  const enl = ["E1", "E2", "E3", "E4", "E5"];
  // Caixas primeiro, selos depois: um selo desenhado antes seria coberto pela caixa seguinte.
  nos.forEach((n, i) => {
    const x = 0.5 + i * 1.56;
    cartao(s, x, 1.95, 1.12, 0.65, BRANCO, "B9C6D6");
    T(s, n, { x, y: 1.95, w: 1.12, h: 0.65, fontSize: 14, bold: true, align: "center", valign: "middle" });
  });
  enl.forEach((e, i) => selo(s, e, 0.5 + i * 1.56 + 1.12 + 0.03, 2.08, i === 1 ? AZUL : TEAL, 0.38));
  const stats = [
    ["512", "amostras por segundo, 1 canal (FP1)"],
    ["7", "enlaces do sensor ao painel"],
    ["0", "equipamentos nossos no caminho — só software e configuração"],
  ];
  stats.forEach(([n, r], i) => {
    const x = 0.5 + i * 3.05;
    cartao(s, x, 3.0, 2.85, 1.95);
    T(s, n, { x: x + 0.25, y: 3.15, w: 2.4, h: 1.0, fontSize: 60, bold: true, color: i === 2 ? VERMELHO : TEAL });
    T(s, r, { x: x + 0.25, y: 4.15, w: 2.4, h: 0.65, fontSize: 13, color: SUAVE });
  });
  rodape(s, "Tiago · 0:15–2:00");
  s.addNotes("TIAGO — até 2:00. Problema: queremos captar EEG de consumo e mostrar tendências de bem-estar sem prometer diagnóstico. Percorrer a fila de caixas: headset, celular, API, Analysis, banco, painel. Honestidade que abre o trabalho: a atividade pede o desenho antes do firmware, e o nosso sistema já está no ar e não tem firmware próprio — então mostramos a rede como construída e o que medimos. O número zero é o que mais importa: todos os sete enlaces passam por equipamento que não é nosso.");
}

// 3 — Diagrama ---------------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: BRANCO };
  T(s, "A rede, enlace por enlace", { x: 0.35, y: 0.18, w: 6.8, h: 0.45, fontSize: 22, bold: true });
  const h = 4.85;
  const w = h * (3425 / 2523);
  s.addImage({ path: path.join(RAIZ, "diagrama", "rede_waveai.png"), x: 0.3, y: 0.62, w, h, altText: "Diagrama de rede do WaveAI" });
  const x = 0.3 + w + 0.2;
  const leituras = [
    ["Seta", "aponta de quem inicia a conversa — no E1 é o celular, embora o dado venha do headset"],
    ["Guarda", "onde o dado fica em cada nó; o celular guarda < 0,5 s"],
    ["Na queda", "o que acontece com o dado quando o enlace cai"],
    ["Borda vermelha", "ponto único de falha: API, banco, celular"],
  ];
  leituras.forEach(([k, v], i) => {
    cartao(s, x, 0.7 + i * 1.18, 9.75 - x, 1.05, CLARO, CLARO);
    T(s, [{ text: k, options: { bold: true, color: i === 3 ? VERMELHO : TEAL, breakLine: true } }, { text: v, options: { color: TEXTO } }], { x: x + 0.12, y: 0.78 + i * 1.18, w: 9.75 - x - 0.24, h: 0.9, fontSize: 11, valign: "top" });
  });
  s.addNotes("GUSTAVO — 2:00 a 3:30. Percorrer com o dedo: E1 Bluetooth Classic RFCOMM do celular para o headset (o celular inicia; o headset transmite 512 pacotes por segundo, 8 bytes cada). E2 WebSocket sobre TLS até a API, passando por roteador ou 4G, que não são nossos. E3 HTTPS interno até a Analysis, que é inalcançável pela internet. E4 protocolo PostgreSQL sobre TLS até o Neon, em outra nuvem. E5 SSE do navegador para a API: o navegador assina e o servidor empurra. E6 o site na Cloudflare. E7 SMTP para o Gmail. Mostrar as três bordas vermelhas.");
}

// 4 — Tabela de enlaces ----------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: CLARO };
  titulo(s, "Tecnologia, protocolo e de quem é cada trecho");
  const cab = ["", "Tecnologia · protocolo", "Quem inicia", "Periodicidade · volume", "De quem é"].map((t) => ({ text: t, options: { bold: true, color: BRANCO, fill: { color: ESCURO } } }));
  const linhas = [
    ["E1", "Bluetooth Classic · RFCOMM/SPP · ThinkGear", "Celular", "512 pacotes/s × 8 B ≈ 33 kbit/s", "Usuário + NeuroSky"],
    ["E2", "Wi-Fi/4G · WebSocket sobre TLS 1.3", "Celular", "1 frame/0,5 s · 941–1.339 B (medido)", "Operadora, Azure"],
    ["E3", "HTTPS interno · JSON", "API", "1 janela/2 s · timeout 5 s", "Azure"],
    ["E4", "PostgreSQL sobre TLS", "API", "1 commit por frame (2/s)", "Neon (AWS)"],
    ["E5", "HTTPS · SSE + REST", "Navegador", "1 evento/2 s · ~1,2 KB (medido)", "Quem assiste, Azure"],
    ["E6", "HTTPS · CDN", "Navegador", "2,36 MB ao abrir o app", "Cloudflare"],
    ["E7", "SMTP 587 + STARTTLS", "API", "sob demanda · teto 500/dia", "Google"],
  ].map((l) => l.map((t, i) => ({ text: t, options: i === 0 ? { bold: true, color: TEAL } : {} })));
  s.addTable([cab, ...linhas], { x: 0.5, y: 1.05, w: 9, colW: [0.55, 2.75, 1.2, 2.7, 1.8], fontFace: F, fontSize: 12, color: TEXTO, fill: { color: BRANCO }, border: { type: "solid", pt: 0.5, color: "C9D3DF" }, rowH: 0.47, valign: "middle", margin: 0.05 });
  rodape(s, "Gustavo · 3:30–4:30");
  s.addNotes("GUSTAVO — até 4:30. Destacar três leituras da tabela: (1) quem inicia nem sempre é quem manda o dado; (2) o volume do E2 foi medido, 941 a 1.339 bytes por frame; (3) a última coluna: nenhum trecho é infraestrutura nossa. Se perguntarem do DNS: a Cloudflare só resolve o nome da API (DNS only); dado de usuário não passa por ela.");
}

// 5 — Mapa de falhas ------------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: CLARO };
  titulo(s, "Mapa de falhas: perde, atrasa, duplica, desordena");
  const stats = [["23", "modos de falha, ao menos 3 por enlace", TEAL], ["6", "silenciosos: nada quebra na tela e o dado para de chegar", VERMELHO], ["0", "duplicação ou desordem: um só WebSocket sobre TCP e nenhum reenvio", AZUL]];
  stats.forEach(([n, r, c], i) => {
    cartao(s, 0.5, 1.05 + i * 1.35, 4.2, 1.2);
    T(s, n, { x: 0.7, y: 1.1 + i * 1.35, w: 1.3, h: 1.1, fontSize: 48, bold: true, color: c, valign: "middle" });
    T(s, r, { x: 2.0, y: 1.1 + i * 1.35, w: 2.6, h: 1.1, fontSize: 13, color: TEXTO, valign: "middle" });
  });
  cartao(s, 5.0, 1.05, 4.5, 3.9);
  T(s, [
    { text: "O preço da escolha", options: { bold: true, color: TEAL, fontSize: 16, breakLine: true } },
    { text: "Sem reenvio, a mesma amostra nunca chega duas vezes — mas o que se perde não volta.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "Por que não guardar e reenviar?", options: { bold: true, color: TEAL, fontSize: 16, breakLine: true } },
    { text: "Sinal de EEG é dado pessoal sensível. O projeto decidiu não gravar sinal bruto em lugar nenhum. Em troca, a perda é declarada na tela: “faltou sinal” quando sobram ≥ 10 s de duração sem amostras." },
  ], { x: 5.25, y: 1.2, w: 4.05, h: 3.6, fontSize: 13, valign: "top", paraSpaceAfter: 4 });
  rodape(s, "Nickolas · 4:30–5:15");
  s.addNotes("NICKOLAS — até 5:15. Explicar as quatro palavras do mapa: perde, atrasa, duplica, fora de ordem. Duplicar e desordenar ficam fora porque cada captação é um único WebSocket sobre TCP e não há reenvio. O custo: o que se perde não volta — decisão de privacidade, e a perda é declarada na tela.");
}

// 6 — Falha silenciosa do início ao fim ----------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: ESCURO };
  titulo(s, "Do início ao fim: o app congela e ninguém percebe", BRANCO);
  T(s, "Medido com cliente sintético que para de enviar, mas mantém o socket aberto e responde ao ping — o que um celular com o JavaScript pausado faz.", { x: 0.5, y: 0.9, w: 9, h: 0.5, fontSize: 13, color: "9FB0C6" });
  s.addShape(pres.shapes.LINE, { x: 0.8, y: 2.15, w: 8.4, h: 0, line: { color: "3A4B63", width: 2 } });
  // Posições fora de escala de propósito: em escala, 0 s e 12 s ficariam colados.
  const marcos = [
    [1.2, "0 s", "abre a sessão"],
    [3.4, "12 s", "último frame: o app congela"],
    [6.0, "12 → 162 s", "servidor: nada · painel: 10 keepalives e “ao vivo”"],
    [8.5, "162 s", "“stop” → relatório gerado"],
  ];
  marcos.forEach(([x, t, d], i) => {
    s.addShape(pres.shapes.OVAL, { x: x - 0.11, y: 2.04, w: 0.22, h: 0.22, fill: { color: i === 2 ? VERMELHO : TEAL_CLARO }, line: { color: ESCURO } });
    T(s, t, { x: x - 0.9, y: 1.55, w: 1.8, h: 0.4, fontSize: 14, bold: true, color: BRANCO, align: "center" });
    T(s, d, { x: x - 0.95, y: 2.35, w: 1.9, h: 0.75, fontSize: 11, color: "C9D4E3", align: "center" });
  });
  const cards = [
    ["150 s", "sem nenhum aviso, em nenhuma tela", VERMELHO],
    ["27,6 s", "quando a rede some de verdade: o ping do servidor percebe", TEAL_CLARO],
    ["10 s", "timeout de inatividade previsto: sem amostra, vira queda", "7AA2F7"],
  ];
  cards.forEach(([n, r, c], i) => {
    const x = 0.5 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.35, w: 2.85, h: 1.65, fill: { color: "16213A" }, line: { color: "2A3A55", width: 0.75 }, rectRadius: 0.08 });
    T(s, n, { x: x + 0.2, y: 3.45, w: 2.5, h: 0.8, fontSize: 36, bold: true, color: c });
    T(s, r, { x: x + 0.2, y: 4.25, w: 2.5, h: 0.65, fontSize: 12, color: "C9D4E3" });
  });
  rodape(s, "Nickolas · 5:15–7:15", "7F90A8");
  s.addNotes("NICKOLAS — até 7:15, é a parte central. Contar como história: isto aconteceu de verdade — com a tela apagada, o Android pausava o JavaScript, o envio parava, e a sessão chegava com 71,2% das amostras, sem erro nenhum. Reproduzimos: 12 s de sinal, depois silêncio com o socket aberto. Por 150 s o servidor não fechou e o painel continuou dizendo ao vivo, recebendo só keepalives. Por quê: depois da autenticação, o gateway permite silêncio entre blocos. Comparar: quando a rede cai de verdade, o ping percebe em 27,6 s e o relatório é gravado com o que chegou. Reação prevista: timeout de inatividade de 10 s, que reaproveita o caminho da queda. Dado: perde todo o período.");
}

// 7 — Falha parcial e pontos únicos ---------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: CLARO };
  titulo(s, "Falha parcial: um nó cai, e os outros mostram o quê?");
  T(s, "M = medido no ambiente local, com sinal sintético", { x: 0.5, y: 5.2, w: 5, h: 0.25, fontSize: 10, color: SUAVE });
  const cards = [
    ["Analysis lenta", "Cada janela espera 5 s e volta “indisponível”. A chamada é síncrona: a API inteira para junto — /health levou 4,5–4,7 s."],
    ["Pool do banco esgotado", "16 painéis ao vivo abertos: rota com banco espera 30,2 s e dá erro 500, enquanto /health responde 200 em 0,22 s."],
    ["Banco recusa conexão", "A captação cai em 0,9 s e a sessão fica “active” para sempre, sem relatório. O painel segue ouvindo que há captação ao vivo."],
  ];
  cards.forEach(([t, d], i) => {
    const y = 1.05 + i * 1.3;
    cartao(s, 0.5, y, 5.6, 1.15);
    selo(s, "M", 0.68, y + 0.36, TEAL, 0.42);
    T(s, [{ text: t, options: { bold: true, breakLine: true, fontSize: 15 } }, { text: d, options: { fontSize: 12, color: SUAVE } }], { x: 1.25, y: y + 0.1, w: 4.7, h: 0.95, valign: "top" });
  });
  cartao(s, 6.4, 1.05, 3.1, 3.75, "FFF4F3", "F2C4C0");
  T(s, [
    { text: "Pontos únicos de falha", options: { bold: true, color: VERMELHO, fontSize: 16, breakLine: true } },
    { text: "API — réplica única", options: { bullet: true, breakLine: true } },
    { text: "Banco Neon", options: { bullet: true, breakLine: true } },
    { text: "Celular do titular", options: { bullet: true, breakLine: true } },
    { text: "Região brazilsouth", options: { bullet: true, breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "Lição: /health sozinho mentiria. A disponibilidade se mede numa rota que usa o banco.", options: { italic: true, color: TEXTO } },
  ], { x: 6.6, y: 1.2, w: 2.75, h: 3.5, fontSize: 13, valign: "top", paraSpaceAfter: 4, color: TEXTO });
  rodape(s, "Gustavo · 7:15–8:00");
  s.addNotes("GUSTAVO — até 8:00. O “M” nos cartões é de medido, no ambiente local, com sinal sintético. A degradação esperada funcionou (captação segue, ao vivo diz indisponível, relatório sai inteiro quando a Analysis volta), mas a medição revelou que uma dependência lenta congela a réplica única inteira. Quanto tempo o painel mostra algo errado: 27,6 s na queda de rede; sem limite no app congelado e na sessão órfã. Pontos únicos: com a API fora, param captação, ao vivo e histórico; com o banco fora, param login, histórico e a própria captação.");
}

// 8 — Requisitos não funcionais -------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: CLARO };
  titulo(s, "Requisitos não funcionais: os números que escolhemos");
  const eixos = [
    ["Latência", "≤ 3 s", "até o painel em 95% das janelas · medido local: p95 32 ms", "Medido local"],
    ["Retenção na queda", "< 0,5 s", "no celular; o servidor grava o que chegou (≥ 1.024 amostras) · queda percebida em 27,6 s", "Medido"],
    ["Disponibilidade", "≥ 99,0%", "ao mês = até 7 h 18 min fora · 2 sondas seguidas sem 200 numa rota com banco", "Meta"],
    ["Integridade", "100%", "de pacotes com checksum inválido descartados · buraco ≥ 10 s declarado · seq ainda não validado", "Parcial"],
    ["Energia", "≤ 10%", "da bateria em 60 min com a tela apagada · headset: 1 pilha AAA, ~8 h (fabricante)", "Meta"],
    ["Segurança", "TLS 1.3", "medido nos dois domínios · 6ª tentativa de login recebe 429 · sinal bruto nunca gravado", "Medido"],
  ];
  eixos.forEach(([e, n, d, st], i) => {
    const x = 0.5 + (i % 3) * 3.05;
    const y = 1.0 + Math.floor(i / 3) * 2.1;
    cartao(s, x, y, 2.85, 1.95);
    T(s, `RNF-0${i + 1} · ${e}`, { x: x + 0.18, y: y + 0.12, w: 2.5, h: 0.3, fontSize: 11, bold: true, color: SUAVE });
    T(s, n, { x: x + 0.18, y: y + 0.4, w: 2.5, h: 0.62, fontSize: 30, bold: true, color: TEAL });
    T(s, d, { x: x + 0.18, y: y + 1.02, w: 2.5, h: 0.62, fontSize: 10.5, color: TEXTO });
    T(s, st, { x: x + 0.18, y: y + 1.62, w: 2.5, h: 0.25, fontSize: 10, bold: true, color: st === "Medido" || st === "Medido local" ? TEAL : st === "Parcial" ? "B26A00" : AZUL });
  });
  rodape(s, "Nickolas · 8:00–9:00");
  s.addNotes("NICKOLAS — até 9:00. Um requisito só vale com número e método de verificação. Ler os seis eixos pelo número grande, não pelo texto. Dizer a situação com franqueza: latência e segurança medidas; disponibilidade e energia são metas com método definido; integridade é parcial porque o servidor devolve o número de sequência mas ainda não o valida. Os 10 funcionais estão no documento (RF-01 a RF-10).");
}

// 9 — O que não exige --------------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: CLARO };
  titulo(s, "O que a SPTrans exige e o WaveAI não");
  const col = [
    ["Redundância, 99,9%", "Réplica única, meta de 99,0%", "Sessão interrompida custa minutos de captação repetidos, não uma frota sem monitoramento — e o custo em repouso é zero."],
    ["15 dias guardados no equipamento", "Sinal bruto nunca gravado", "EEG é dado pessoal sensível: a LGPD pede minimização. A perda é declarada na tela, não escondida."],
    ["IP54 e relógio RTC com GPS", "Uso interno, taxa fixa de 512 Hz", "Headset de consumo usado sentado; o tempo de cada amostra sai da contagem, não de um relógio."],
  ];
  col.forEach(([a, b, c], i) => {
    const x = 0.5 + i * 3.05;
    cartao(s, x, 1.05, 2.85, 3.9);
    T(s, "SPTrans exige", { x: x + 0.2, y: 1.2, w: 2.45, h: 0.28, fontSize: 11, bold: true, color: SUAVE });
    T(s, a, { x: x + 0.2, y: 1.48, w: 2.45, h: 0.7, fontSize: 16, bold: true, color: TEXTO });
    T(s, "WaveAI decide", { x: x + 0.2, y: 2.25, w: 2.45, h: 0.28, fontSize: 11, bold: true, color: TEAL });
    T(s, b, { x: x + 0.2, y: 2.53, w: 2.45, h: 0.6, fontSize: 15, bold: true, color: TEAL });
    T(s, c, { x: x + 0.2, y: 3.2, w: 2.45, h: 1.6, fontSize: 12, color: SUAVE, valign: "top" });
  });
  rodape(s, "Tiago · 9:00–10:00");
  s.addNotes("TIAGO — até 10:00. O Anexo VII foi modelo de estudo: 13.000 veículos. Cada ausência aqui é decisão com motivo de escala, risco e objetivo: (1) redundância — escala de demonstração e custo zero em repouso; uma segunda réplica exigiria tirar da memória o fan-out ao vivo; (2) retenção de 15 dias — proibida pelo próprio desenho, por privacidade; (3) IP54 e RTC — produto de consumo em ambiente interno. Fechar: cada falha que mostramos virou número, inclusive as que ainda não corrigimos.");
}

// 10 — Perguntas ------------------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: ESCURO };
  T(s, "Perguntas", { x: 0.6, y: 1.3, w: 8.8, h: 1.0, fontSize: 48, bold: true, color: BRANCO });
  T(s, "Toda falha que mostramos virou número — inclusive as que ainda não corrigimos.", { x: 0.6, y: 2.35, w: 8.4, h: 0.8, fontSize: 20, color: TEAL_CLARO });
  T(s, "Documento, diagrama (.drawio) e medições: pasta Faculdade/SDIoT_Atividade_Redes do repositório.", { x: 0.6, y: 4.3, w: 8.8, h: 0.4, fontSize: 12, color: "9FB0C6" });
  s.addNotes("Todos. Qualquer um responde qualquer parte — ver o banco de perguntas no roteiro.");
}

const saida = path.join(RAIZ, "apresentacao", "Rede_WaveAI_Apresentacao.pptx");
require("fs").mkdirSync(path.dirname(saida), { recursive: true });
pres.writeFile({ fileName: saida }).then((f) => console.log(f));
