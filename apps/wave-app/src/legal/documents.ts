/**
 * Documentos legais — **fonte única e versionada**, no espírito do termo de
 * consentimento (`services/api/app/consent.py`).
 *
 * Ficam aqui, e não num CMS ou num arquivo solto, por três motivos: entram no
 * `build:web` (logo, viram URL pública sem login, que é o que a Play Store
 * exige); mudam por PR, com revisão e histórico; e a **versão** é o que
 * permitirá, depois, registrar o aceite e pedir novo aceite quando o texto
 * mudar de forma material.
 *
 * REGRA DE HONESTIDADE (ADR-0027) que vale em dobro aqui: este texto **não
 * pode prometer o que o produto não faz**. Onde um direito ainda não tem botão,
 * o documento diz como exercê-lo hoje — não finge que o botão existe.
 *
 * `[PREENCHER]` marca o que depende de dados que só o controlador tem. Nenhum
 * deles foi inventado.
 */

export type SecaoLegal = {
  titulo: string;
  /** Parágrafos. Texto puro — sem HTML, sem markdown para interpretar. */
  paragrafos?: string[];
  /** Itens de lista, quando enumerar é mais legível que um parágrafo. */
  itens?: string[];
};

export type DocumentoLegal = {
  slug: "privacidade" | "termos";
  titulo: string;
  /** Muda quando o texto muda de forma material (ver o cabeçalho do módulo). */
  versao: string;
  /** ISO curto (AAAA-MM-DD) — quem lê quer saber se está velho. */
  atualizadoEm: string;
  resumo: string;
  secoes: SecaoLegal[];
};

/** Identificação do controlador. Sem isto, a política não identifica ninguém. */
const CONTROLADOR = "[PREENCHER: razão social, CNPJ e endereço do controlador]";
const CONTATO_ENCARREGADO = "[PREENCHER: e-mail do encarregado (DPO)]";
const CONTATO_SUPORTE = "[PREENCHER: e-mail de contato para pedidos do titular]";

export const POLITICA_DE_PRIVACIDADE: DocumentoLegal = {
  slug: "privacidade",
  titulo: "Política de Privacidade",
  versao: "1.0",
  atualizadoEm: "2026-08-23",
  resumo:
    "O que o WaveAI coleta, por quanto tempo guarda, com quem compartilha e como você exerce seus direitos.",
  secoes: [
    {
      titulo: "Quem é o controlador",
      paragrafos: [
        `O tratamento dos dados descritos aqui é feito por ${CONTROLADOR}.`,
        `Para dúvidas, pedidos ou reclamações sobre dados pessoais, fale com o encarregado: ${CONTATO_ENCARREGADO}.`,
      ],
    },
    {
      titulo: "O que o WaveAI é — e o que não é",
      paragrafos: [
        "O WaveAI é uma ferramenta exploratória de bem-estar. Ele não é um dispositivo médico, não faz diagnóstico e não substitui avaliação profissional. Nada do que ele mostra deve ser lido como resultado clínico.",
        "As medidas vêm de um eletroencefalógrafo de consumo de canal único. São indicativas, sensíveis a ruído e à qualidade do contato, e não têm valor diagnóstico.",
      ],
    },
    {
      titulo: "Que dados coletamos",
      paragrafos: [
        "Coletamos o mínimo necessário para o produto funcionar. Não pedimos documento, data de nascimento, endereço nem telefone.",
      ],
      itens: [
        "Cadastro: e-mail, nome de exibição, senha (guardada apenas como hash, nunca em texto) e o papel escolhido (pessoa ou profissional de bem-estar).",
        "Sessões de captação: data, duração, aparelho e montagem usados.",
        "Medidas derivadas do sinal: potências por banda, alfa relativa, indicadores de qualidade e índices proprietários do fabricante do aparelho. Ficam cifradas no banco.",
        "Anotações de contexto que você escrever sobre uma sessão. Ficam cifradas no banco.",
        "Vínculos de acompanhamento com profissionais, e os convites que os originaram.",
        "Registros técnicos de acesso: quem leu quais dados seus, quando e quantos. Servem para você e para auditoria.",
        "Dados de sessão de login (tokens), para manter você conectado.",
      ],
    },
    {
      titulo: "O que NÃO coletamos",
      paragrafos: [
        "O sinal bruto do eletroencefalógrafo não é armazenado. Ele é processado para produzir as medidas descritas acima e descartado — não fica no servidor, não é enviado a terceiros e não pode ser recuperado depois.",
        "Não usamos seus dados para treinar modelos. A base de pesquisa do WaveAI é alimentada apenas por dados sintéticos e por captações do próprio desenvolvedor, e nunca recebe dados de usuários.",
        "Não vendemos, alugamos nem cedemos seus dados. Não há publicidade no produto.",
      ],
    },
    {
      titulo: "Com que base legal tratamos",
      paragrafos: [
        "As medidas derivadas do seu sinal só são guardadas depois que você aceita, de forma específica e destacada, o termo de consentimento que aparece no primeiro acesso. Sem esse aceite, nenhuma medida é persistida.",
        "Você pode revogar esse consentimento a qualquer momento, sem penalidade. Revogar interrompe novas gravações; não apaga sozinho o que já foi guardado, porque apagar é um ato separado e explícito — assim uma revogação não destrói seu histórico por engano.",
        "Os dados de cadastro e os registros de acesso são tratados para executar o serviço que você contratou e para cumprir obrigações de segurança e auditoria.",
      ],
    },
    {
      titulo: "Com quem compartilhamos",
      paragrafos: [
        "Com ninguém, por padrão. Um profissional de bem-estar só enxerga seus dados se você aceitar o convite dele, e o vínculo pode ser revogado por você a qualquer momento, com efeito imediato.",
        "O acompanhamento ao vivo tem uma trava a mais: além do vínculo aceito, você precisa ligar o compartilhamento naquela sessão específica. Toda sessão começa com o compartilhamento desligado.",
        "Toda leitura dos seus dados por um profissional fica registrada na trilha de acesso, com data e quantidade.",
        "Não usamos serviços de análise de comportamento, rastreadores publicitários nem redes sociais dentro do produto.",
      ],
    },
    {
      titulo: "Como protegemos",
      itens: [
        "As medidas do sinal e as anotações são cifradas no banco de dados.",
        "A senha é guardada como hash, com algoritmo próprio para senhas.",
        "O acesso exige autenticação, e o papel de cada conta limita o que ela alcança.",
        "Toda leitura de dado de um titular por outra pessoa deixa registro.",
      ],
      paragrafos: [
        "Nenhuma medida de segurança é infalível. Se ocorrer um incidente que possa gerar risco relevante a você, comunicaremos você e a autoridade competente conforme a lei.",
      ],
    },
    {
      titulo: "Por quanto tempo guardamos",
      paragrafos: [
        "Enquanto sua conta existir, seus dados continuam disponíveis para você. Não apagamos seu histórico por inatividade.",
        "Você pode apagar todas as medidas e anotações quando quiser, pelo próprio aplicativo, e o efeito é imediato e definitivo.",
        "Os registros de acesso são mantidos mesmo após a exclusão dos dados que eles descrevem: são a prova de quem leu o quê, e apagá-los tiraria de você justamente a evidência que a trilha existe para dar.",
        "[PREENCHER: prazos concretos de retenção por tipo de dado, incluindo o que acontece após a revogação do consentimento e após o encerramento da conta.]",
      ],
    },
    {
      titulo: "Seus direitos e como exercê-los",
      paragrafos: [
        "A lei brasileira garante a você confirmação do tratamento, acesso, correção, anonimização ou eliminação, portabilidade, informação sobre compartilhamento e revogação do consentimento.",
        "No aplicativo, hoje, você já consegue por conta própria:",
      ],
      itens: [
        "Ver todas as suas sessões e medidas, a qualquer momento.",
        "Exportar tudo o que é seu — medidas e anotações — num arquivo aberto.",
        "Apagar todas as suas medidas e anotações.",
        "Corrigir seu nome de exibição, sua senha e seu e-mail.",
        "Revogar o consentimento, encerrando novas gravações.",
        "Revogar o vínculo com um profissional, encerrando o acesso dele.",
      ],
    },
    {
      titulo: "Exclusão da conta",
      paragrafos: [
        "A exclusão completa da conta ainda não tem botão no aplicativo. Estamos construindo esse caminho.",
        `Até lá, peça a exclusão por ${CONTATO_SUPORTE} a partir do e-mail cadastrado, e faremos a remoção. Enquanto isso, você já pode apagar sozinho todas as suas medidas e anotações pelo aplicativo, que é o conteúdo derivado do seu sinal.`,
        "Dizemos isso explicitamente porque preferimos descrever o produto como ele é a prometer um botão que ainda não existe.",
      ],
    },
    {
      titulo: "Crianças e adolescentes",
      paragrafos: [
        "O WaveAI não se destina a menores de 18 anos, e não coletamos conscientemente dados de crianças e adolescentes. Se identificarmos uma conta nessa situação, ela será removida.",
      ],
    },
    {
      titulo: "Mudanças nesta política",
      paragrafos: [
        "Se este texto mudar de forma material, publicaremos a nova versão aqui, com data e número de versão novos, e avisaremos no aplicativo.",
        "Esta é a versão 1.0, de 23 de agosto de 2026.",
      ],
    },
  ],
};

export const TERMOS_DE_USO: DocumentoLegal = {
  slug: "termos",
  titulo: "Termos de Uso",
  versao: "1.0",
  atualizadoEm: "2026-08-23",
  resumo:
    "As regras para usar o WaveAI: o que ele faz, o que você pode esperar dele e o que esperamos de você.",
  secoes: [
    {
      titulo: "Aceitação",
      paragrafos: [
        `Ao criar uma conta no WaveAI, você concorda com estes Termos e com a Política de Privacidade. O serviço é oferecido por ${CONTROLADOR}.`,
        "Se você não concordar com algum ponto, não crie a conta.",
      ],
    },
    {
      titulo: "O que o serviço é",
      paragrafos: [
        "O WaveAI capta o sinal de um eletroencefalógrafo de consumo, calcula medidas descritivas e mostra tendências ao longo do tempo. Opcionalmente, permite que um profissional de bem-estar escolhido por você acompanhe esses dados.",
      ],
    },
    {
      titulo: "O que o serviço NÃO é",
      paragrafos: [
        "O WaveAI não é um dispositivo médico. Não diagnostica, não trata, não previne e não monitora nenhuma doença ou condição.",
        "Nada no aplicativo deve ser usado para decidir sobre tratamento, medicação ou conduta de saúde. Se você tem uma preocupação de saúde, procure um profissional habilitado.",
        "Os textos gerados por inteligência artificial dentro do produto são apoio à leitura dos números, sempre rotulados como tal, e não são laudo, parecer nem recomendação clínica.",
        "Os índices proprietários do fabricante do aparelho não são medidas validadas cientificamente, e aparecem sempre identificados como proprietários.",
      ],
    },
    {
      titulo: "Sua conta",
      itens: [
        "Você precisa de um e-mail válido e é responsável por mantê-lo acessível — é por ele que a recuperação de senha funciona.",
        "Você é responsável por manter sua senha em segredo e por tudo o que acontecer na sua conta.",
        "Você deve ter 18 anos ou mais.",
        "Uma conta é de uma pessoa. Não a compartilhe.",
      ],
    },
    {
      titulo: "Contas de profissional",
      paragrafos: [
        "Qualquer pessoa pode criar uma conta de profissional de bem-estar: não verificamos credenciais, registro de conselho nem formação.",
        "Isso significa que a existência de uma conta de profissional não é atestado de qualificação por nós. Quem decide em quem confiar é você, ao aceitar ou recusar um convite — e você pode desfazer esse vínculo quando quiser.",
        "Quem usa uma conta de profissional se compromete a não apresentar as informações do WaveAI como resultado clínico e a não usá-las para diagnóstico.",
      ],
    },
    {
      titulo: "Uso aceitável",
      itens: [
        "Não use o serviço para fins ilícitos nem para prejudicar outra pessoa.",
        "Não tente acessar dados de quem não autorizou você.",
        "Não tente burlar limites técnicos, sondar o sistema em busca de falhas sem autorização, nem automatizar acesso em massa.",
        "Não envie dados de terceiros sem que a pessoa saiba e concorde.",
      ],
    },
    {
      titulo: "Disponibilidade",
      paragrafos: [
        "O serviço é oferecido como está e pode ficar indisponível para manutenção, atualização ou por falhas. Não garantimos funcionamento ininterrupto nem ausência de erros.",
        "Podemos alterar ou descontinuar funcionalidades. Se formos descontinuar o serviço, avisaremos com antecedência razoável para você exportar seus dados.",
      ],
    },
    {
      titulo: "Seus dados",
      paragrafos: [
        "Os dados são seus. Você pode exportá-los a qualquer momento em formato aberto e apagá-los pelo aplicativo.",
        "O tratamento está descrito na Política de Privacidade, que faz parte destes Termos.",
      ],
    },
    {
      titulo: "Encerramento",
      paragrafos: [
        "Você pode parar de usar o serviço quando quiser. Podemos encerrar ou suspender uma conta que viole estes Termos, avisando quando for possível.",
      ],
    },
    {
      titulo: "Limitação de responsabilidade",
      paragrafos: [
        "Na máxima extensão permitida pela lei aplicável, não respondemos por decisões tomadas com base nas informações do aplicativo, que são exploratórias e não clínicas.",
        "Nada nestes Termos afasta direitos que a legislação de proteção ao consumidor garante a você.",
      ],
    },
    {
      titulo: "Lei aplicável e foro",
      paragrafos: [
        "Estes Termos são regidos pela lei brasileira.",
        "[PREENCHER: foro eleito.]",
      ],
    },
    {
      titulo: "Mudanças nestes Termos",
      paragrafos: [
        "Se estes Termos mudarem de forma material, publicaremos a nova versão aqui, com data e número de versão novos, e avisaremos no aplicativo.",
        "Esta é a versão 1.0, de 23 de agosto de 2026.",
      ],
    },
  ],
};

export const DOCUMENTOS: Record<DocumentoLegal["slug"], DocumentoLegal> = {
  privacidade: POLITICA_DE_PRIVACIDADE,
  termos: TERMOS_DE_USO,
};
