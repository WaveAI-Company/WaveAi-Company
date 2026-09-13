// Gera apresentacao/Roteiro_e_Arguicao.docx — quem fala o quê, e as perguntas prováveis.
// Uso: NODE_PATH=<node_modules com docx> node fonte/gerar_roteiro.js

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, TableLayoutType,
} = require("docx");

const RAIZ = path.resolve(__dirname, "..");
const FONTE = "Arial";
const COR = "1F3A5F";

function runs(texto, base = {}) {
  return String(texto).split("**").map((p, i) => (p ? new TextRun({ text: p, bold: i % 2 === 1 || base.bold, font: FONTE, size: base.size ?? 20 }) : null)).filter(Boolean);
}
const P = (t, o = {}) => new Paragraph({ children: runs(t, o), spacing: { after: o.after ?? 100, line: 264 } });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONTE, size: 26, bold: true, color: COR })], spacing: { before: 220, after: 100 }, keepNext: true });
const B = (t) => new Paragraph({ children: runs(t), numbering: { reference: "m", level: 0 }, spacing: { after: 40 } });
const borda = { style: BorderStyle.SINGLE, size: 4, color: "9AA7B5" };
const cel = (t, w, o = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
  margins: { top: 40, bottom: 40, left: 80, right: 80 },
  borders: { top: borda, bottom: borda, left: borda, right: borda },
  children: (Array.isArray(t) ? t : [t]).map((l) => new Paragraph({ children: runs(l, { size: 17, bold: o.bold }), spacing: { after: 0 } })),
});
function tabela(larg, cab, linhas) {
  return new Table({
    width: { size: larg.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: larg, layout: TableLayoutType.FIXED,
    rows: [new TableRow({ tableHeader: true, children: cab.map((c, i) => cel(c, larg[i], { fill: "DCE6F2", bold: true })) }),
      ...linhas.map((l) => new TableRow({ cantSplit: true, children: l.map((c, i) => cel(c, larg[i])) }))],
  });
}

const falas = [
  ["0:00–0:15", "1 · Capa", "**Tiago**", "Apresenta o grupo. Frase-guia: “vamos mostrar a rede do WaveAI como ela está no ar, onde ela falha e o que medimos”."],
  ["0:15–2:00", "2 · O que faz", "**Tiago**", ["Problema: captar EEG de consumo e mostrar tendências de bem-estar **sem prometer diagnóstico**.", "Percorrer as caixas: headset → celular → API → Analysis → banco → painel.", "Honestidade: a atividade pede o desenho antes do firmware; o nosso está no ar desde 26/08/2026 e **não tem firmware próprio**.", "O número que importa: **0 equipamentos nossos** no caminho."]],
  ["2:00–3:30", "3 · Diagrama", "**Gustavo**", ["Percorrer E1 a E7 com o dedo, dizendo tecnologia e protocolo de cada um.", "Seta = quem **inicia** (no E1 é o celular; no E5 é o navegador).", "Mostrar “Guarda” e “Na queda” em dois nós (celular e API) e as três bordas vermelhas."]],
  ["3:30–4:30", "4 · Tabela", "**Gustavo**", ["Quem inicia nem sempre é quem manda o dado.", "Volume do E2 **medido**: 941–1.339 B por frame, 2 por segundo.", "Última coluna: nenhum trecho é infraestrutura nossa."]],
  ["4:30–5:15", "5 · Mapa de falhas", "**Nickolas**", ["As quatro palavras: perde, atrasa, duplica, fora de ordem.", "Por que não há duplicação nem desordem: um só WebSocket sobre TCP e nenhum reenvio.", "O preço: o que se perde não volta — decisão de privacidade, e a perda é declarada."]],
  ["5:15–7:15", "6 · Falha do início ao fim", "**Nickolas**", ["Contar nas seis perguntas (ver seção 2 abaixo).", "Fechar comparando: 150 s sem aviso × 27,6 s quando a rede cai de verdade."]],
  ["7:15–8:00", "7 · Parcial e pontos únicos", "**Gustavo**", ["Três medições: Analysis lenta trava a API inteira; pool esgotado com /health dizendo 200; banco fora deixa sessão órfã.", "Quanto tempo o painel mostra algo errado: 27,6 s na queda de rede; sem limite no app congelado.", "Pontos únicos: API, banco, celular, região."]],
  ["8:00–9:00", "8 · Requisitos não funcionais", "**Nickolas**", ["Ler pelo número grande, não pelo texto.", "Situação com franqueza: latência e segurança **medidas**; disponibilidade e energia são **metas**; integridade é **parcial** (seq não validado).", "Os 10 funcionais estão no documento."]],
  ["9:00–10:00", "9 e 10 · Não exige, perguntas", "**Tiago**", ["Anexo VII = modelo de estudo, 13.000 veículos.", "Três decisões: réplica única; sinal bruto nunca gravado; sem IP54 nem RTC.", "Frase final: “toda falha que mostramos virou número — inclusive as que ainda não corrigimos”."]],
];

const perguntas = [
  ["Por que a seta do E1 vai do celular para o headset, se o dado vem do headset?", "Porque a seta é o sentido de quem inicia. O celular é o cliente RFCOMM e abre a conexão com o headset pareado; depois disso o headset transmite em fluxo contínuo, sem pedido."],
  ["Por que WebSocket, e não um POST HTTP por bloco?", "São 2 blocos por segundo durante toda a sessão e a resposta (ack com as medidas) volta pelo mesmo canal. Uma conexão só evita um handshake por envio e, sobre TCP, garante ordem e ausência de repetição."],
  ["Por que SSE no painel, e não WebSocket?", "O painel só recebe. SSE é HTTP comum, atravessa proxies e não precisa de protocolo de mensagens nos dois sentidos."],
  ["O que acontece se o celular perder a internet por 5 segundos?", "Se a rede volta antes de o ping do servidor expirar (20–40 s), o TCP retransmite e os blocos chegam **atrasados** — isso não medimos. Se passar disso, o servidor encerra a sessão como abortada e grava o relatório do que chegou (medido: 27,6 s)."],
  ["Por que não guardam o sinal no celular e reenviam depois?", "EEG é dado pessoal sensível, e o projeto decidiu não gravar sinal bruto em lugar nenhum (minimização, LGPD). O custo é que o que se perde não volta; em troca, a perda aparece na tela como “faltou sinal”."],
  ["Qual é a falha silenciosa?", "A 2.2: o app congela com a rede boa. O socket segue aberto e responde ao ping, então nada acusa. Medimos 150 s sem nenhum aviso; o painel continuou “ao vivo”. Já aconteceu de verdade (71,2% de completude)."],
  ["Qual é a falha parcial, e por quanto tempo o painel mostra algo errado?", "Ex.: a Analysis fica lenta e a API continua — a captação segue, mas a API inteira trava 5 s por janela. Tempo mostrando errado: 27,6 s na queda de rede; sem limite no app congelado e na sessão órfã do banco."],
  ["Onde o dado fica guardado em cada ponto?", "Headset: nada. Celular: menos de 0,5 s na memória. API: o sinal da sessão em memória até o fim (teto de 4 milhões de amostras). Analysis: nada. Banco: relatório cifrado enquanto a conta existir. Navegador: últimas janelas na memória."],
  ["Quais são os pontos únicos de falha e o que cada um derruba?", "API (réplica única): captação, ao vivo, histórico e login. Banco: login, histórico e a própria captação em curso. Celular: toda a captação. Região da Azure: API e Analysis juntas — o banco sobrevive, porque está fora dela."],
  ["Por que só uma réplica da API?", "Custo zero em repouso (escala a zero) e escala de demonstração. Além disso, o fan-out ao vivo e o limitador de login vivem na memória: uma segunda réplica exigiria um serviço como Redis."],
  ["Como detectam dado corrompido, repetido ou fora de ordem?", "Corrompido: checksum do ThinkGear e cifra autenticada do relatório. Ordem e repetição: um único WebSocket sobre TCP. Faltante: completude (amostras ÷ duração × 512). O número de sequência é devolvido, mas ainda não validado — por isso o RNF-04 está “parcial”."],
  ["Como vocês mediram esses tempos?", "No ambiente local (docker compose, mesmo código da produção), com cliente sintético em Python, uma sonda em /health a cada 0,5 s e docker pause/stop nos serviços. Os roteiros e os logs estão em fonte/medicao."],
  ["Por que 99,0% de disponibilidade e não 99,9%?", "Com uma réplica que escala a zero, a primeira requisição espera 21–26 s. 99,9% exigiria redundância — que é justamente o que decidimos não ter nesta escala."],
  ["O que conta como “fora do ar”?", "Duas sondas seguidas, a cada 5 min, sem 200 em até 30 s numa rota que consulta o banco. Não usamos só /health porque medimos /health respondendo 200 com o banco inacessível."],
  ["De onde vêm os 21–26 s de cold start?", "Da Azure alocando um nó ao escalar de zero (~9–14 s), mais o download da imagem (~4 s) e o boot da aplicação (~2 s). Medido nos logs do Container Apps."],
  ["Quanto dado o celular manda por hora?", "Cerca de 6,5 a 9,2 MiB por hora no E2 (941–1.339 B por frame, 2 por segundo)."],
  ["Por que usar TLS no E3 se a rede é interna?", "O ingress interno do Container Apps já entrega HTTPS, e manter a cifra também dentro do ambiente é defesa em profundidade."],
  ["O WaveAI é um dispositivo médico?", "Não. É não-clínico e não-diagnóstico: bem-estar exploratório. Nenhuma tela ou texto afirma finalidade de saúde."],
  ["O que vocês corrigiriam primeiro?", "O timeout de inatividade no gateway (fecha a falha silenciosa) e tirar do laço principal as chamadas síncronas ao banco e à Analysis (evita que um nó lento congele todos)."],
];

const doc = new Document({
  styles: { default: { document: { run: { font: FONTE, size: 20 } } } },
  numbering: { config: [{ reference: "m", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    children: [
      new Paragraph({ children: [new TextRun({ text: "Roteiro de fala e banco de perguntas", font: FONTE, size: 34, bold: true, color: COR })], spacing: { after: 60 } }),
      P("Rede do WaveAI · apresentação de **10 minutos** · Tiago, Gustavo e Nickolas"),
      P("**Regra do grupo:** ninguém lê o slide. Cada um fala a sua parte, mas **todos** estudam a seção 4 — na arguição a pergunta pode ir para qualquer um, e “essa parte foi o colega” custa nota do grupo inteiro."),
      H1("1. Quem fala o quê"),
      tabela([1100, 1900, 1100, 5538], ["Tempo", "Slide", "Quem", "Pontos a dizer"], falas),
      P("Tempo de fala: Tiago 3:00 · Gustavo 3:15 · Nickolas 3:45.", { after: 60 }),
      H1("2. A falha contada do início ao fim (slide 6)"),
      B("**Modo de falha:** o app congela com a rede boa — para de mandar amostras, mas o socket segue aberto."),
      B("**Causa provável:** o Android pausa o JavaScript com a tela apagada, ou um defeito trava o envio. O sistema continua respondendo ao ping sozinho."),
      B("**Como o sistema percebe e em quanto tempo:** não percebe. Medimos 150 s sem nenhuma amostra, e o servidor não fechou nem avisou."),
      B("**Consequência imediata:** nenhuma mensagem em nenhuma tela; o painel recebeu só 10 keepalives e seguiu “ao vivo”."),
      B("**Consequência para o dado:** PERDE todo o período — nunca foi enviado."),
      B("**Reação prevista:** timeout de inatividade no gateway (10 s sem amostra = queda), reaproveitando o caminho da queda que já grava o relatório. Hoje só se descobre depois, pela completude do relatório."),
      H1("3. Se o tempo apertar"),
      B("Slide 4: dizer só a última coluna (“nenhum trecho é nosso”) — ganha ~40 s."),
      B("Slide 7: citar só o cartão da Analysis e os pontos únicos — ganha ~20 s."),
      B("Nunca cortar o slide 6: é o que a rubrica pede contado do início ao fim."),
      H1("4. Perguntas prováveis na arguição"),
      tabela([3300, 6338], ["Pergunta", "Resposta curta"], perguntas),
    ],
  }],
});

const saida = path.join(RAIZ, "apresentacao", "Roteiro_e_Arguicao.docx");
fs.mkdirSync(path.dirname(saida), { recursive: true });
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(saida, b); console.log(`${saida} (${b.length} B)`); });
