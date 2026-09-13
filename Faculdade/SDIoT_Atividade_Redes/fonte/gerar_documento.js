// Gera documento/Rede_WaveAI_Falhas_e_Requisitos.docx (importável no Google Docs).
// Uso: NODE_PATH=<node_modules com docx> node fonte/gerar_documento.js
// Texto em **negrito** é marcado com asteriscos duplos.

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  ShadingType, AlignmentType, HeadingLevel, ImageRun, PageOrientation, LevelFormat,
  BorderStyle, Footer, PageNumber, TableLayoutType, VerticalAlign,
} = require("docx");

const RAIZ = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Números medidos em 13/09/2026 (stack local, sinal sintético) — ver fonte/medicao
// ---------------------------------------------------------------------------
const M = require("./medidas.json");

const FONTE = "Arial";
const COR_TITULO = "1F3A5F";
const COR_CAB = "DCE6F2";
const COR_GRUPO = "EEF2F7";
const COR_SILENCIOSA = "FDECEA";
const LARG = 9638; // A4 retrato, margens de 2 cm

// -- texto com **negrito** ---------------------------------------------------
function runs(texto, base = {}) {
  const partes = String(texto).split("**");
  return partes
    .map((p, i) => (p ? new TextRun({ text: p, bold: i % 2 === 1 || base.bold, font: FONTE, size: base.size, color: base.color, italics: base.italics }) : null))
    .filter(Boolean);
}
const P = (t, o = {}) =>
  new Paragraph({ children: runs(t, { size: o.size ?? 20, color: o.color, italics: o.italics }), spacing: { after: o.after ?? 100, before: o.before ?? 0, line: o.line ?? 264 }, alignment: o.align ?? AlignmentType.JUSTIFIED, keepNext: o.keepNext });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONTE, size: 26, bold: true, color: COR_TITULO })], spacing: { before: 200, after: 100 }, keepNext: true });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONTE, size: 22, bold: true, color: COR_TITULO })], spacing: { before: 140, after: 80 }, keepNext: true });
const B = (t, o = {}) => new Paragraph({ children: runs(t, { size: o.size ?? 20 }), numbering: { reference: "marcadores", level: 0 }, spacing: { after: 50, line: 252 }, alignment: AlignmentType.LEFT });

// -- tabelas -----------------------------------------------------------------
const borda = { style: BorderStyle.SINGLE, size: 4, color: "9AA7B5" };
const bordas = { top: borda, bottom: borda, left: borda, right: borda };
function celula(texto, largura, o = {}) {
  const linhas = Array.isArray(texto) ? texto : [texto];
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    verticalAlign: VerticalAlign.TOP,
    borders: bordas,
    children: linhas.map((l) => new Paragraph({ children: runs(l, { size: o.size ?? 15, bold: o.bold }), spacing: { after: 0, line: 228 }, alignment: AlignmentType.LEFT })),
  });
}
function tabela(larguras, cabecalho, linhas, o = {}) {
  const total = larguras.reduce((a, b) => a + b, 0);
  const rows = [
    new TableRow({ tableHeader: true, cantSplit: true, children: cabecalho.map((c, i) => celula(c, larguras[i], { fill: COR_CAB, bold: true, size: o.size })) }),
  ];
  for (const linha of linhas) {
    if (linha.grupo) {
      rows.push(new TableRow({ cantSplit: true, children: [celula(`**${linha.grupo}**`, total, { span: larguras.length, fill: COR_GRUPO, size: (o.size ?? 15) + 1 })] }));
      continue;
    }
    // Linha simples é um array — e `array.fill` é um MÉTODO, não uma cor.
    const valores = Array.isArray(linha) ? linha : linha.c;
    const fundo = Array.isArray(linha) ? undefined : linha.fill;
    rows.push(new TableRow({ cantSplit: true, children: valores.map((v, i) => celula(v, larguras[i], { fill: fundo, size: o.size })) }));
  }
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: larguras, layout: TableLayoutType.FIXED, rows });
}

// ===========================================================================
// Conteúdo
// ===========================================================================
const cabecalho = [
  new Paragraph({ children: [new TextRun({ text: "Rede do WaveAI: enlaces, mapa de falhas e requisitos", font: FONTE, size: 34, bold: true, color: COR_TITULO })], spacing: { after: 60 } }),
  P("Sistemas Distribuídos Aplicado à Internet das Coisas · Prof. Rodrigo dos Santos Faustino", { size: 20, after: 20, align: AlignmentType.LEFT }),
  P("Análise e Desenvolvimento de Sistemas — AMS · 2º ano, noite · setembro de 2026", { size: 20, after: 20, align: AlignmentType.LEFT }),
  P("**Grupo:** Tiago Bryan Ramos de Oliveira · Gustavo Mendes Vetieri Mariano · Nickolas Maia de Araujo", { size: 20, after: 160, align: AlignmentType.LEFT }),
];

const contexto = [
  H1("Contexto e como ler este documento"),
  P("O **WaveAI** é o nosso projeto integrador: uma plataforma de captação e análise de EEG de consumo para **bem-estar exploratório**. Um headset NeuroSky MindWave Mobile 2 (um canal, eletrodo na testa na posição FP1, 512 amostras por segundo) envia o sinal ao celular; o app repassa à nossa API na nuvem, que calcula tendências e as mostra num painel para o próprio usuário e, se ele autorizar, para um profissional de bem-estar vinculado. O produto é **não-clínico e não-diagnóstico**."),
  P("Uma diferença em relação ao enunciado precisa vir antes de tudo. A atividade pede o desenho da rede **antes** da primeira linha de firmware, e o WaveAI já está **em produção desde 26/08/2026** (waveai.tec.br). E o projeto **não tem firmware próprio**: o do headset é da NeuroSky, fechado; o que nós programamos começa no celular. Por isso este documento descreve a rede **como foi construída**, o que se esperava dela e o que foi **medido** — inclusive onde ela falha."),
  P("Cada número traz a origem: **[M]** medido por nós · **[C]** configurado no código ou na infraestrutura · **[F]** do fabricante, não medido · **[Meta]** alvo ainda não verificado. As medições de falha foram feitas em 13/09/2026 no ambiente local (docker compose, com o mesmo código e os mesmos Dockerfiles da produção) e com **sinal 100% sintético** — o projeto proíbe usar sinal de pessoa real em teste. Onde a produção difere do ambiente local (o ingress da Azure fica no meio do caminho), isso está dito."),
];

// -- Seção 1 -----------------------------------------------------------------
const L1 = [700, 1150, 1900, 1250, 2150, 1050, 1438];
const secao1 = [
  H1("1. As redes que usamos"),
  P("São **sete enlaces** do sensor ao painel. A seta de cada um aponta de quem **inicia** a conversa, que nem sempre é quem manda o dado: no E1 o celular abre a conexão e é o headset que transmite; no E5 o navegador assina e é o servidor que empurra.", { keepNext: true }),
  tabela(L1, ["Enlace", "Trecho", "Tecnologia e protocolo", "Quem inicia", "Periodicidade e volume", "Alcance", "De quem é a infraestrutura"], [
    ["**E1**", "Headset → celular", "Bluetooth Classic (2,4 GHz) · RFCOMM / SPP · fluxo binário ThinkGear (sincronismo 0xAA 0xAA + checksum de 1 byte)", "O **celular** conecta ao headset pareado; depois o headset transmite sem pedido", "512 pacotes de amostra/s × 8 B = 4.096 B/s [F] + 1 pacote/s de qualidade e eSense, ~36 B [F] ≈ 33 kbit/s", "~10 m, classe 2 [F, não medido]", "Headset e celular **do usuário**; firmware **da NeuroSky**. Nenhum equipamento é nosso."],
    ["**E2**", "Celular → API", `Wi-Fi 802.11 ou 4G + internet · **WebSocket sobre TLS 1.3** [M] sobre TCP · mensagens JSON`, "O **celular** abre wss://api.waveai.tec.br/stream; token só na 1ª mensagem, nunca na URL; 10 s para autenticar [C]", `1 frame a cada 256 amostras (0,5 s), disparado pela chegada da amostra [C]; **941–1.339 B por frame** [M] ≈ 1,8–2,6 KiB/s ≈ 6,5–9,2 MiB/h; 1 "ack" por frame`, "Onde houver internet", "Roteador do usuário ou **operadora**, backbone, DNS da **Cloudflare**, ingress da **Azure**. Nosso: só o software da API."],
    ["**E3**", "API → Analysis", "Rede virtual interna do Azure Container Apps · **HTTPS interno** [C] · JSON", "A **API** (cliente HTTP)", "1 POST por janela de 1.024 amostras = **a cada 2 s** [C], ~3,6–5,3 KB [cálculo]; timeout 5 s [C]. No fim, 1 POST com a sessão inteira (10 min ≈ 1,3 MB), timeout 30 s [C]", "Mesmo ambiente e região", "**Azure** (Microsoft). Ingress interno: inalcançável pela internet."],
    ["**E4**", "API ↔ banco", "Internet entre nuvens (Azure brazilsouth → AWS sa-east-1) · **protocolo PostgreSQL sobre TLS** · TCP · pool de conexões [C]", "A **API**", "Na captação, **1 UPDATE + commit por frame (2/s)** para somar amostras [C]; 1 INSERT ao abrir; 1 relatório cifrado ao encerrar", "Duas nuvens, ambas em São Paulo", "**Neon**, sobre AWS. Não é nossa."],
    ["**E5**", "API → painel", "Internet de quem assiste · HTTPS (TLS 1.3 [M]) · **SSE** (text/event-stream) no ao vivo + REST/JSON no histórico", "O **navegador** assina /me/live ou /patients/{id}/live; depois o servidor empurra", `1 evento de medidas **a cada 2 s** (${M.sse_bytes} B [M]) + eSense ~1/s; keepalive após 15 s sem evento [C]`, "Onde houver internet", "Rede **de quem assiste** + ingress da Azure."],
    ["**E6**", "Navegador → site", "HTTPS (TLS 1.3 [M]) · CDN", "O **navegador**", "Ao abrir o app: pacote JavaScript de **2.364.934 B** [M]; depois, cache", "Global (CDN)", "**Cloudflare Pages**. Não é nossa."],
    ["**E7**", "API → e-mail", "Internet · **SMTP (porta 587) + STARTTLS** e autenticação por senha de app [C]", "A **API**", "Sob demanda (cadastro, reenvio de código, senha, troca de e-mail); poucos KB; teto de **500/dia**; timeout 10 s [C]", "Internet", "**Google** (Gmail). Não é nossa."],
  ], { size: 15 }),
  P("**Todos os sete enlaces passam por equipamento que não é nosso.** O projeto não possui servidor físico, roteador nem rádio: controla só software e configuração. Há ainda uma dependência que não aparece como enlace próprio — E2, E5 e E6 resolvem nomes pelo **DNS da Cloudflare**. O endereço da API é “DNS only”: a Cloudflare responde qual é o IP, mas **nenhum dado do usuário atravessa a Cloudflare**.", { before: 100 }),
];

// -- Seção 2 -----------------------------------------------------------------
const L2 = [520, 1250, 1230, 1900, 1650, 1250, 1838];
const S = COR_SILENCIOSA;
const secao2 = [
  H1("2. Mapa de falhas e consequências"),
  P("Para o dado usamos quatro palavras com sentido fixo: **PERDE** (nunca chega e ninguém reenvia), **ATRASA** (chega depois), **DUPLICA** (chega mais de uma vez) e **FORA DE ORDEM**. Duas escolhas do projeto eliminam as duas últimas em quase todo o caminho: cada captação usa **um único WebSocket sobre TCP**, que entrega em ordem e sem repetição, e **não há reenvio pela aplicação** — logo a mesma amostra não tem como chegar duas vezes. O preço é explícito: **o que se perde não volta**. Linhas em vermelho-claro são falhas **silenciosas**.", { keepNext: true }),
  tabela(L2, ["#", "Modo de falha", "Causa provável", "Como o sistema percebe e em quanto tempo", "Consequência imediata", "Consequência para o dado", "Reação prevista"], [
    { grupo: "E1 — Headset → celular (Bluetooth Classic / RFCOMM / ThinkGear)" },
    ["1.1", "Queda do Bluetooth", "Headset desligado, pilha no fim, pessoa fora do alcance", "Evento nativo de desconexão, filtrado pelo endereço do headset [C]. O tempo é o do rádio do Android (não medido).", "Tela sai de “AO VIVO” e mostra “Reconectando”", "**PERDE** as amostras do intervalo (o headset não guarda)", "Reconecta a cada 2 s por até 10 s [C]. Voltou: a sessão segue e o buraco ≥ 10 s é declarado. Não voltou: encerra por queda e o servidor gera o relatório do que chegou."],
    ["1.2", "Eletrodo sem contato", "Cabelo, suor, headset torto, movimento", "O chip informa **poor_signal** (0 = bom, 200 = sem contato) 1×/s [F]; a tela atualiza em ~1 s", "Aviso de contato e de quanto confiar na leitura", "Nada se perde: o dado **chega, mas é ruído** (presente e inválido)", "Nada é descartado sozinho; a qualidade entra no relatório e o protocolo guiado verifica o instrumento."],
    { c: ["1.3", "Byte corrompido", "Interferência em 2,4 GHz (Wi-Fi, micro-ondas)", "**Silenciosa:** o checksum falha e o decodificador descarta o pacote na hora, sem log [C]. Só a completude do relatório revela, no fim da sessão.", "Nenhuma", "**PERDE** amostras isoladas; não duplica nem desordena (RFCOMM é ordenado)", "Sem retransmissão (o ThinkGear não tem). Perdas que somem ≥ 10 s aparecem como buraco no relatório."], fill: S },
    ["1.4", "Com a tela apagada, só a 1ª tentativa de reconexão acontece", "O Android pausa os temporizadores do JavaScript com a tela apagada", "Dívida conhecida e documentada: a 1ª tentativa vem do evento nativo; as seguintes esperam um temporizador que não dispara", "A reconexão fica parada até a tela acender — o que leva à falha 2.2", "**PERDE** o período até a tela acender", "Prevista: contar as tentativas dentro do serviço nativo (Kotlin), que roda com a tela apagada. Não implementada."],
    { grupo: "E2 — Celular → API (Wi-Fi/4G · WebSocket sobre TLS)" },
    ["2.1", "Rede some sem fechar a conexão", "Túnel, elevador, Wi-Fi que cai, troca Wi-Fi → 4G", `Servidor: ping do WebSocket a cada 20 s com 20 s de espera [C] → **percebeu em 27,6 s** após o último frame [M] (janela possível: 20–40 s). Celular: só quando o sistema desiste do TCP (não medido).`, "Servidor encerra a sessão como abortada e avisa o painel; o celular pode seguir exibindo a captação até perceber", "**PERDE** o que foi enviado após a queda. O que chegou vira relatório: **6.144 amostras, 1 relatório gravado** [M]", "Relatório com piso de 1.024 amostras; sessão “aborted”; buraco declarado (sessão de 40,0 s com 12 s de sinal [M]). Sem reconexão do WebSocket nem reenvio."],
    { c: ["2.2", "App congelado com a rede boa", "O sistema pausa o JavaScript (tela apagada, falha 1.4) ou um defeito para o envio; o socket segue aberto e o sistema responde ao ping sozinho", "**Silenciosa — medida:** 150 s sem nenhuma amostra, e o servidor **não fechou nem avisou** [M]. O painel recebeu só 10 keepalives e continuou “ao vivo”.", "Nenhuma mensagem em nenhuma tela", "**PERDE** todo o período", "Hoje: só se descobre depois, pela completude e pelo buraco no relatório. Prevista: timeout de inatividade no gateway (10 s sem amostra = queda). Já aconteceu de verdade: 71,2% de completude antes da correção [M]."], fill: S },
    ["2.3", "API reiniciando ou fora do ar", "Deploy, falha do processo, instância escalando do zero", "Conexão recusada ou fechada: o app percebe na hora. A 1ª conexão após ociosidade espera o **cold start de 21–26 s** [M]", "Tela mostra “conexão encerrada”; se estava encerrando, espera no máximo 30 s pelo relatório [C]", "Se o processo morre, **PERDE** o sinal da sessão em curso, que estava só na memória", "Painel honesto: “confira o seu histórico” — não afirma que salvou. Deploy só roda quando o código muda."],
    ["2.4", "Bloco grande demais", "Envio represado no celular acumula mais de 4.096 amostras (8 s)", "Servidor recusa **na hora** e fecha com código de limite excedido [C]", "Sessão encerra com erro", "**PERDE** o bloco; o que chegou antes vira relatório", "O envio passou a ser disparado pela chegada da amostra, não por relógio — era este limite que derrubava a captação em segundo plano."],
    { grupo: "E3 — API → Analysis (HTTPS interno)" },
    ["3.1", "Analysis fora ou lenta **durante** a captação", "Escala do zero, falha, deploy", M.d_percebe, M.d_imediata, "**ATRASA** o ao vivo e **PERDE** as janelas do período; o sinal bruto segue guardado na API", M.d_reacao],
    ["3.2", "Analysis fora **no encerramento**", "Mesma", "Timeout de 30 s na análise da sessão inteira [C]", "Encerra sem relatório: “análise indisponível”", "**PERDE** o relatório da sessão inteira: o bruto é descartado ao encerrar e não há fila para reprocessar", "Custo aceito da decisão de não guardar sinal bruto (privacidade); a sessão fica registrada, sem relatório."],
    ["3.3", "Versão da análise muda no meio da sessão", "Deploy da Analysis durante uma captação", "Não é percebido na hora; cada resultado grava a **engine_version** [C]", "Nenhuma", "Nada se perde; janelas da mesma sessão podem vir de versões diferentes (inconsistência, não perda)", "Rastreabilidade: o relatório guarda a versão, e comparações entre sessões podem filtrar por ela."],
    { grupo: "E4 — API ↔ banco (PostgreSQL sobre TLS)" },
    ["4.1", "Banco para de responder (sem recusar)", "Rede entre nuvens em “buraco negro”, banco travado", M.f1_percebe, M.f1_imediata, M.f1_dado, M.f1_reacao],
    ["4.2", "Banco recusa ou derruba a conexão", "Neon fora do ar, manutenção, conexão resetada", M.f2_percebe, M.f2_imediata, M.f2_dado, M.f2_reacao],
    { c: ["4.3", "Pool de conexões esgotado", "Muitos painéis ao vivo abertos ao mesmo tempo", M.e_percebe, M.e_imediata, M.e_dado, M.e_reacao], fill: M.e_silenciosa ? S : undefined },
    { grupo: "E5 — API → painel (HTTPS · SSE)" },
    { c: ["5.1", "O stream termina sem evento de fim", "A API reinicia (deploy) com o painel aberto", "**Silenciosa:** o código do painel encerra a leitura quando o stream acaba, **mas não avisa a tela** [C]", "O painel segue mostrando o último valor, parado", "**ATRASA** indefinidamente para quem assiste (nada novo chega; o histórico está intacto)", "Hoje: recarregar a página. Previsto: tratar o fim do stream como queda e mostrar “transmissão interrompida”."], fill: S },
    ["5.2", "Quem assiste perde a rede", "Wi-Fi do consultório cai", "Navegador: sem vigia de keepalive, a leitura fica bloqueada [C]. Servidor: ao escrever o próximo evento (≤ 15 s + tempo do TCP, não medido)", "Tela congela no último valor", "**PERDE** os eventos ao vivo desse espectador; a captação não muda", "Recarregar reassina; o relatório completo aparece no histórico ao fim da sessão."],
    { c: ["5.3", "Espectador lento", "Aba em segundo plano, rede ruim", "**Silenciosa:** fila de 64 eventos por espectador [C]; cheia, o evento é descartado sem log", "Nenhuma", "**PERDE** eventos ao vivo desse espectador", "Decisão: quem assiste nunca trava a captação de quem capta."], fill: S },
    { grupo: "E6 — Navegador → site (HTTPS · Cloudflare Pages)" },
    ["6.1", "Site fora do ar", "Incidente na Cloudflare ou no DNS", "Quem abre vê o erro do navegador na hora; **a equipe não tem monitor externo** e só sabe se alguém avisar", "Painel web inacessível; app Android e API seguem", "Nenhum dado de usuário (o site é só código)", "Aguardar o fornecedor; o site é estático e sem estado."],
    ["6.2", "Build do site quebra", "Atualização automática de dependência incompatível", "O Cloudflare Pages marca o build como falho em minutos; o usuário não percebe", "Nenhuma: a versão anterior segue no ar", "Nenhum", "Corrigir e publicar; pacotes do SDK do app sobem só por comando manual."],
    ["6.3", "Site e API em versões diferentes", "Os dois têm deploys independentes (Cloudflare e Azure)", "Cadastro recebe **409 “recarregue a página”** na hora [M]", "Criar conta falha por alguns minutos", "Nada se perde: o cadastro não é criado e pode ser repetido", "A mensagem pede para recarregar; a janela dura o intervalo entre os dois deploys."],
    { grupo: "E7 — API → e-mail (SMTP + STARTTLS)" },
    ["7.1", "Gmail recusa o envio", "Teto de 500/dia atingido, senha de app revogada", "Erro SMTP em até 10 s [C]; a API registra um aviso sem o endereço", "Cadastro falha com erro genérico", "Nada fica pela metade: a conta só é gravada **depois** do envio", "Tentar de novo. De propósito: é melhor falhar do que criar conta impossível de verificar."],
    { c: ["7.2", "E-mail aceito, mas não entregue", "Filtro de spam, caixa cheia", "**Silenciosa:** o Gmail responde “aceito” e a API registra “enviado”; ninguém percebe", "A pessoa não recebe o código", "**PERDE** o código, que expira em 10 min [C]", "“Reenviar código” gera outro, de uso único. A tela nunca afirma que o e-mail chegou."], fill: S },
    ["7.3", "Porta 587 bloqueada ou SMTP lento", "Rede de saída, instabilidade do provedor", "Timeout de 10 s [C]", "Cadastro demora até 10 s e falha", "Como 7.1: nada gravado", "Como 7.1."],
  ], { size: 14 }),

  H2("2.1 A falha silenciosa contada do início ao fim (2.2)"),
  P("**Situação real:** antes da correção, uma captação com a tela do celular apagada chegava ao servidor com **71,2%** das amostras e terminava como abortada — e nenhuma tela disse nada. **Reprodução medida:** um cliente sintético abriu a sessão, enviou 12 s de sinal (6.144 amostras) e parou de enviar **mantendo o socket aberto e respondendo ao ping** — exatamente o que um celular com o JavaScript pausado faz. Durante **150 s** o servidor não fechou a conexão nem mandou mensagem; o painel de quem assistia recebeu **10 comentários de keepalive** (um a cada 15 s) e nenhum aviso. Quando o cliente mandou “stop”, o relatório foi gerado normalmente. **Por que acontece:** o gateway só tem timeout antes da autenticação; depois dela, silêncio entre blocos é permitido de propósito. **Quanto tempo o painel mostra algo errado:** indefinidamente. **O que previmos:** um timeout de inatividade (10 s sem amostra = queda), que reaproveita todo o caminho da queda já testado na falha 2.1."),
  H2("2.2 A falha parcial: um nó cai e os outros continuam"),
  P(M.parcial_texto),
  P(`**Quanto tempo o painel mostra algo errado sem saber:** na falha 2.1, **27,6 s** medidos (até 40 s pelo mecanismo de ping) mostrando “ao vivo” uma captação que já tinha caído; na 2.2 e na 5.1, **sem limite**. ${M.parcial_tempo}`),
  H2("2.3 Pontos únicos de falha"),
  tabela([1900, 2700, 1700, 3338], ["Ponto único", "Se falhar, para", "Enlaces afetados", "Dados afetados"], [
    ["**API — réplica única** (maxReplicas 1)", "Captação, ao vivo, histórico, login, cadastro. O site abre, mas não serve para nada.", "E2, E3, E4, E5, E7", "Sinal das sessões em curso (só na memória); relatórios dessas sessões. Uma 2ª réplica exigiria tirar da memória o fan-out ao vivo e o limitador de login."],
    ["**Banco Neon**", "Login, histórico, abrir sessão e — medido — a própria captação em curso.", "E4 (e, por consequência, E2 e E5)", M.spof_banco],
    ["**Celular do titular**", "Toda a captação: o headset só conversa com um aparelho por vez.", "E1, E2", "Tudo que não foi enviado; o celular não guarda sinal."],
    ["**Região brazilsouth da Azure**", "API e Analysis juntas.", "E2, E3, E4, E5, E7", "Como a API. O banco sobrevive (está fora da Azure), e com ele o histórico."],
  ], { size: 15 }),
];

// -- Seção 3 -----------------------------------------------------------------
const L3 = [720, 4700, 3000, 1218];
const secao3 = [
  H1("3. Requisitos funcionais e não funcionais"),
  P("Situação: **Medido** = verificado com número neste trabalho · **Implementado** = há código e teste automatizado · **Parcial** = atende em parte (dito onde não) · **Meta** = alvo com método definido, ainda não verificado.", { keepNext: true }),
  H2("3.1 Funcionais"),
  tabela(L3, ["ID", "Requisito", "Método de verificação", "Situação"], [
    ["**RF-01**", "Autenticar por e-mail e senha com dois papéis (titular e profissional). Token de acesso válido por **15 min**; renovação por cookie httpOnly por **7 dias**.", "Testes automatizados da API (suíte de 458 testes) + inspeção do cookie no navegador.", "Implementado"],
    ["**RF-02**", "Conectar ao headset pareado por Bluetooth Classic e decodificar o fluxo ThinkGear a **512 amostras/s**, descartando **100%** dos pacotes com checksum inválido.", "Teste unitário do decodificador com pacotes sintéticos corrompidos — **a criar** (o app ainda não tem testes automatizados) — e captação no aparelho real.", "Parcial"],
    ["**RF-03**", "Enviar o sinal ao gateway em blocos de **256 amostras**, autenticando na 1ª mensagem; conexão sem autenticação em **10 s** é fechada.", "Teste do gateway com cliente que não autentica, cronometrado.", "Implementado"],
    ["**RF-04**", "Devolver ao celular as medidas de uma janela a cada **1.024 amostras (2 s)**.", `Captação sintética de 60 s deve devolver 30 janelas. Medido: **${M.c_janelas}** [M].`, "Medido"],
    ["**RF-05**", "Transmitir ao vivo ao titular e, **só se ele ligar o compartilhamento naquela sessão**, ao profissional com vínculo ativo. Desligar encerra o stream do profissional **no evento seguinte**. Sinal bruto **nunca** é transmitido.", "Testes da API do compartilhamento + inspeção dos eventos SSE recebidos.", "Implementado"],
    ["**RF-06**", "Ao encerrar, gerar e gravar o relatório **cifrado** com a versão da análise; numa queda, fazer o mesmo se houver **≥ 1.024 amostras**; sem consentimento, mostrar sem gravar.", "Cenário da falha 2.1: sessão abortada com 6.144 amostras gerou **1 relatório** gravado [M]; testes do consentimento.", "Medido"],
    ["**RF-07**", "Numa queda do Bluetooth, tentar reconectar **a cada 2 s por até 10 s** e então encerrar informando a queda.", "Desligar o headset no aparelho real e cronometrar as tentativas.", "Parcial (falha 1.4)"],
    ["**RF-08**", "Declarar “faltou sinal” em toda sessão com **≥ 10 s** a mais de duração do que de sinal (amostras ÷ 512).", "A sessão do cenário 2.1 (40,0 s de sessão, 12 s de sinal) deve exibir o aviso.", "Implementado"],
    ["**RF-09**", "Conduzir o protocolo guiado de olhos abertos/fechados e dar o veredito em três estados — apareceu, não apareceu, **roteiro incompleto** — em até **1 s**.", "Tempo de resposta com 120 s de sinal: **0,17 s** [M].", "Medido"],
    ["**RF-10**", "Excluir a conta e **todos** os dados do titular numa única operação, com efeito imediato.", "Teste da API: após a exclusão, nenhuma linha do titular no banco.", "Implementado"],
  ], { size: 15 }),
  H2("3.2 Não funcionais"),
  tabela([1250, 4350, 2850, 1188], ["ID", "Requisito", "Método de verificação", "Situação"], [
    [["**RNF-01**", "Periodicidade e latência"],`O celular envia um frame a cada **256 amostras (0,5 s)**. Com a API quente, as medidas de uma janela chegam ao painel em até **3 s** após a última amostra da janela, em **95%** das janelas. A 1ª conexão após ociosidade pode levar até **30 s**.`, `Carimbar o envio e a chegada do evento SSE em 500 janelas e tirar o percentil 95. Local: p95 = **${M.c_sse_p95} ms** [M]. Produção: cold start 21–26 s [M]; latência por janela não medida.`, "Medido (local) · Meta (produção)"],
    [["**RNF-02**", "Retenção na queda"],"O celular retém no máximo **255 amostras (< 0,5 s)** e não reenvia. O servidor retém o sinal da sessão em memória e, ao perceber a queda em até **45 s**, grava o relatório do que chegou se houver **≥ 1.024 amostras**. Relatório gravado fica **enquanto a conta existir**.", "Cenário 2.1: queda percebida em **27,6 s** e relatório gravado [M]; consulta ao banco.", "Medido"],
    [["**RNF-03**", "Disponibilidade"],"**≥ 99,0% ao mês** (no máximo **7 h 18 min** fora). Conta como fora: **2 sondas seguidas**, a cada 5 min, sem resposta 200 em até **30 s** numa rota que **consulta o banco** (30 s absorvem o cold start). Manutenção programada **conta** como fora.", "Sonda externa a cada 5 min e relatório mensal. **Hoje não existe sonda.** /health sozinho não serve: medimos 200 em 0,22 s com o banco inacessível [M].", "Meta"],
    [["**RNF-04**", "Integridade"],"**100%** dos pacotes com checksum inválido descartados; completude (amostras ÷ duração × 512) registrada em **toda** sessão e buraco **≥ 10 s** declarado; frame com **seq** repetido ou menor que o anterior **recusado**; relatório cifrado com autenticação (Fernet: AES-128 + HMAC-SHA256), de modo que registro adulterado **falha** na leitura.", "Pacote corrompido sintético; sessão com buraco; frame repetido — **hoje o servidor devolve o seq mas não o valida**; byte alterado no banco.", "Parcial"],
    [["**RNF-05**", "Energia"],"Uma captação de **60 min** com a tela apagada consome **≤ 10%** da bateria do celular de referência (Motorola Edge 50 Fusion) e cabe na autonomia do headset: **1 pilha AAA, ~8 h** [F].", "Bateria antes e depois + adb shell dumpsys batterystats numa sessão de 60 min.", "Meta (não medido)"],
    [["**RNF-06**", "Segurança e privacidade"],"**100%** do tráfego que sai do ambiente da Azure com **TLS ≥ 1.2**; token nunca na URL; login bloqueado após **5 tentativas em 60 s** por cliente; relatório cifrado em repouso; sinal bruto **nunca** gravado nem transmitido ao vivo.", "openssl s_client nos dois domínios: **TLS 1.3** [M]; a 6ª tentativa recebe **429**, medido em produção em 29/08/2026 [M]; esquema do banco sem coluna de sinal bruto.", "Medido"],
  ], { size: 15 }),
];

// -- Seção 4 (paisagem) ------------------------------------------------------
const png = fs.readFileSync(path.join(RAIZ, "diagrama", "rede_waveai.png"));
const secao4 = [
  new Paragraph({ children: [new TextRun({ text: "4. O diagrama", font: FONTE, size: 26, bold: true, color: COR_TITULO })], heading: HeadingLevel.HEADING_1, spacing: { after: 60 } }),
  P("Feito no draw.io; o arquivo editável está no repositório em Faculdade/SDIoT_Atividade_Redes/diagrama/rede_waveai.drawio. Caixas com nome, sem ícones; seta = quem inicia; em cada nó, **Guarda** (onde o dado fica) e **Na queda** (o que acontece com ele); borda vermelha grossa = ponto único de falha.", { size: 18, after: 60 }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: png, transformation: { width: 850, height: Math.round(850 * 2523 / 3425) }, altText: { title: "Diagrama de rede do WaveAI", description: "Sete enlaces do headset ao painel, com armazenamento por nó e pontos únicos de falha", name: "rede_waveai" } })] }),
];

// -- Seção 5 -----------------------------------------------------------------
const secao5 = [
  H1("5. O que este projeto NÃO exige"),
  P("O Anexo VII da SPTrans dimensiona o monitoramento de uma frota de **13.000 veículos** (§3.6). O WaveAI hoje é usado em **demonstrações**, por poucas pessoas, para bem-estar exploratório. Três exigências de lá são, aqui, decisões conscientes de não fazer:"),
  B("**Redundância com 99,9% de disponibilidade** (Anexo VII, §3.3: balanceamento e gateways em máquinas físicas diferentes). **Não exigimos**, porque uma sessão interrompida custa a repetição de alguns minutos de captação — não um ônibus sem monitoramento — e o projeto roda com custo zero em repouso: a réplica única escala a zero, e uma segunda exigiria tirar da memória o fan-out ao vivo e o limitador de login. Nossa meta é 99,0% (RNF-03), e o ponto único está marcado no diagrama."),
  B("**Guardar os dados no equipamento por 15 dias** (Anexo VII, item 02, com memória de cálculo de armazenamento embarcado). **Não exigimos, e é proibido pelo nosso próprio desenho**: o sinal de EEG é dado pessoal sensível, e o projeto decidiu não gravar sinal bruto em lugar nenhum — nem no celular, nem no servidor (minimização da LGPD). O custo aceito é que o que se perde na queda não volta; em troca, a perda é **declarada** na tela (buraco, completude) em vez de escondida."),
  B("**Proteção IP54 e relógio RTC sincronizado ao GPS** (Anexo VII, itens 06 e 20). **Não exigimos**, porque o headset é um produto de consumo usado sentado, em ambiente interno, e nenhum cálculo depende da hora absoluta de cada amostra: o servidor carimba início e fim da sessão, a taxa é fixa em 512 Hz e a posição de cada amostra no tempo sai da contagem."),
];

// ===========================================================================
const retrato = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } };
const paisagem = { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 567, bottom: 567, left: 567, right: 567 } } };
const rodape = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ["WaveAI — Rede, falhas e requisitos · página ", PageNumber.CURRENT], font: FONTE, size: 16, color: "5B7083" })] })] });

const doc = new Document({
  creator: "Grupo WaveAI",
  title: "Rede do WaveAI: enlaces, mapa de falhas e requisitos",
  styles: { default: { document: { run: { font: FONTE, size: 20 } } } },
  numbering: { config: [{ reference: "marcadores", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [
    { properties: retrato, footers: { default: rodape() }, children: [...cabecalho, ...contexto, ...secao1, ...secao2, ...secao3] },
    { properties: paisagem, footers: { default: rodape() }, children: secao4 },
    { properties: retrato, footers: { default: rodape() }, children: secao5 },
  ],
});

const saida = path.join(RAIZ, "documento", "Rede_WaveAI_Falhas_e_Requisitos.docx");
fs.mkdirSync(path.dirname(saida), { recursive: true });
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(saida, buf);
  console.log(`${saida} (${buf.length} B)`);
});
