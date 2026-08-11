"""Textos dos e-mails transacionais.

Ficam **do lado da API**, não do adapter (ADR-0044, item 1): trocar o provedor
no P5 não pode mexer em cópia. Texto puro, sem HTML — o que o console imprime
em dev é literalmente o que o provedor mandará.

**Sem claim clínica** (Medical/71): estes e-mails falam de acesso à conta, não
de saúde. Nenhum deles descreve dado do titular.
"""

from __future__ import annotations

ASSUNTO_VERIFICACAO = "Seu código de verificação do WaveAI"
ASSUNTO_CADASTRO_EXISTENTE = "Alguém tentou criar uma conta com o seu e-mail"
ASSUNTO_RECUPERACAO = "Recuperar o acesso à sua conta WaveAI"
ASSUNTO_TROCA_DE_EMAIL = "Confirme seu novo e-mail no WaveAI"
ASSUNTO_TROCA_AVISO = "O e-mail da sua conta WaveAI está sendo alterado"
ASSUNTO_ENDERECO_JA_EM_USO = "Alguém tentou usar o seu e-mail em outra conta"
ASSUNTO_CONVITE = "Você recebeu um convite de acompanhamento no WaveAI"
ASSUNTO_CONVITE_LEMBRETE = "Lembrete: um convite espera por você no WaveAI"
ASSUNTO_ACESSO_AUTORIZADO = "Você foi autorizado a acompanhar alguém no WaveAI"


def corpo_verificacao(*, codigo: str, minutos: int) -> str:
    """Código de verificação do cadastro.

    Só o código: a verificação acontece na tela em que a pessoa já está
    (`Design/round1/criar-conta.html`, passo 2 de 3), então não há link a
    oferecer aqui. O link entra na recuperação de senha (fatia 6), que é o
    fluxo em que o design pede "link e código".
    """
    return (
        "Olá!\n\n"
        f"Seu código de verificação é: {codigo}\n\n"
        f"Ele vale por {minutos} minutos e pode ser usado uma única vez.\n\n"
        "Se não foi você quem pediu, ignore esta mensagem — sem o código, a "
        "conta não é ativada.\n\n"
        "WaveAI"
    )


def corpo_recuperacao(*, codigo: str, link: str, minutos: int) -> str:
    """Recuperação de senha: **link e código**, as duas formas do mesmo segredo.

    O design oferece os dois na mesma tela (`Design/round1/login.html`) — abrir
    o link ou digitar o código. Usar um queima o outro: é um segredo só.

    O aviso final não é enfeite: um e-mail de recuperação que a pessoa não
    pediu é o primeiro sinal de que alguém está tentando entrar na conta dela.
    """
    return (
        "Olá!\n\n"
        "Recebemos um pedido para redefinir a senha da sua conta WaveAI.\n\n"
        f"Seu código é: {codigo}\n\n"
        f"Ou abra este link: {link}\n\n"
        f"Vale por {minutos} minutos e só pode ser usado uma vez. Ao redefinir "
        "a senha, todas as sessões abertas serão encerradas.\n\n"
        "Se não foi você quem pediu, ignore esta mensagem — sua senha continua "
        "a mesma. Vale conferir se mais alguém tem acesso ao seu e-mail.\n\n"
        "WaveAI"
    )


def corpo_troca_de_email(*, codigo: str, minutos: int) -> str:
    """Código enviado ao endereço **novo** (3ª emenda à ADR-0044).

    Vai só o código, como o design pede em `perfil.html` ("confirmaremos o novo
    endereço com um código") — e pela mesma razão da verificação: quem pediu a
    troca está logado, na tela onde vai digitá-lo. Um link aqui só ampliaria a
    superfície.

    **Não diz de qual conta se trata.** Quem recebe pode não ser dono da conta
    que pediu a troca — alguém pode ter digitado o endereço errado, ou de
    propósito. Nomear a conta contaria a um estranho quem usa o WaveAI.
    """
    return (
        "Olá!\n\n"
        "Recebemos um pedido para passar a usar este endereço numa conta "
        "WaveAI.\n\n"
        f"Seu código de confirmação é: {codigo}\n\n"
        f"Ele vale por {minutos} minutos e pode ser usado uma única vez. "
        "Enquanto não for usado, nada muda.\n\n"
        "Se não foi você quem pediu, ignore esta mensagem.\n\n"
        "WaveAI"
    )


def corpo_troca_aviso_endereco_antigo(*, minutos: int) -> str:
    """Aviso ao endereço **atual** de que a troca foi pedida.

    É o único sinal que chega a quem perdeu o controle da conta: sem ele, um
    invasor com a sessão e a senha trocaria o endereço em silêncio e a pessoa
    descobriria só quando não conseguisse mais recuperar o acesso.

    **Não repete o endereço novo**: se a troca partiu de um invasor, este aviso
    é o que chega à vítima — e não faz sentido entregar a ela o endereço de
    quem está tomando a conta, nem entregar a terceiros o endereço de destino
    caso a caixa esteja comprometida.
    """
    return (
        "Olá!\n\n"
        "Alguém pediu para trocar o e-mail da sua conta WaveAI. A troca só "
        f"acontece se o novo endereço for confirmado, dentro de {minutos} "
        "minutos.\n\n"
        "Se foi você, não precisa fazer nada aqui — basta confirmar no novo "
        "endereço.\n\n"
        "Se NÃO foi você, troque sua senha agora: alguém pode ter acesso à sua "
        "conta.\n\n"
        "WaveAI"
    )


def corpo_endereco_ja_em_uso() -> str:
    """Aviso a quem **já tem** conta e cujo endereço alguém tentou assumir.

    Existe pelo mesmo motivo de `corpo_cadastro_existente`: a rota de troca
    responde igual exista ou não conta no endereço pedido (ADR-0024), senão
    qualquer pessoa logada teria um oráculo de "esse e-mail tem WaveAI?".
    Quem precisa saber é a dona do endereço, e ela sabe por aqui.
    """
    return (
        "Olá!\n\n"
        "Alguém tentou passar a usar este e-mail numa outra conta WaveAI. Como "
        "ele já pertence à sua conta, nada foi alterado — nem aqui, nem lá.\n\n"
        "Se foi você, entre normalmente na conta que já usa este endereço.\n\n"
        "Se não foi você, não precisa fazer nada.\n\n"
        "WaveAI"
    )


def corpo_acesso_autorizado() -> str:
    """Avisa o profissional de que **já** foi autorizado a acompanhar alguém.

    Quando é o paciente quem inicia, o vínculo nasce `active` (ADR-0024: o ato
    dele é o consentimento) — não há convite a aceitar, e por isso o texto é
    outro. Sem este aviso, o profissional só descobre o acesso se abrir o app
    por acaso.

    Não nomeia a pessoa, pelo mesmo motivo do convite: `display_name` é texto
    escolhido por ela e não passa por uma caixa de entrada com a nossa
    assinatura.
    """
    return (
        "Olá!\n\n"
        "Uma pessoa autorizou você a acompanhar as sessões dela no WaveAI.\n\n"
        "Entre na sua conta para ver quem é e o que ela compartilhou. O acesso "
        "é somente leitura, fica registrado em trilha, e ela pode encerrar "
        "quando quiser.\n\n"
        "WaveAI"
    )


def corpo_convite(*, de_profissional: bool, lembrete: bool = False) -> str:
    """Avisa que há um convite de vínculo esperando **dentro do app**.

    Três coisas que este e-mail deliberadamente **não** carrega, e o porquê:

    - **o recado do convite** (ADR-0043). É texto escrito por uma pessoa sobre
      outra; numa caixa de entrada ele vira vetor de phishing, e o cliente de
      e-mail transforma URL em link — exatamente o que a ADR-0043 proíbe na
      nossa renderização. O recado continua no app, como citação atribuída;
    - **o nome de quem convidou.** Pelo mesmo motivo: `display_name` é texto
      escolhido pela pessoa e caberia um "Fulano — confirme em http://…". O que
      vai é o **papel**, que é do sistema. Quem convidou aparece na tela;
    - **qualquer link para agir.** Aceitar exige entrar na conta; um botão de
      aceite por e-mail seria um caminho de consentimento sem autenticação, e
      consentimento é o eixo da ADR-0024.

    Só é enviado para endereço que **já tem conta** — não existe convite frio,
    senão qualquer pessoa logada faria o WaveAI disparar e-mail para estranhos.
    """
    quem = "um profissional de bem-estar" if de_profissional else "uma pessoa"
    abertura = (
        "Continua esperando por você um convite no WaveAI."
        if lembrete
        else f"{quem.capitalize()} convidou você a compartilhar o acompanhamento "
        "das suas sessões no WaveAI."
    )
    return (
        "Olá!\n\n"
        f"{abertura}\n\n"
        "Entre na sua conta para ver quem convidou, o que a pessoa passaria a "
        "ver e decidir se aceita. Nada é compartilhado enquanto você não "
        "aceitar.\n\n"
        "Se não quiser aceitar, é só ignorar — ou recusar dentro do app.\n\n"
        "WaveAI"
    )


def corpo_cadastro_existente() -> str:
    """Aviso a quem **já tem** conta e cujo endereço foi usado num cadastro.

    Existe para que a API possa responder **igual** a todo cadastro, sem contar
    a quem perguntou se o e-mail já existe. Quem precisa saber é a dona do
    endereço — e ela fica sabendo por aqui, não o curioso do outro lado.
    """
    return (
        "Olá!\n\n"
        "Alguém tentou criar uma conta no WaveAI com este e-mail, que já está "
        "cadastrado. Nenhuma conta nova foi criada e nada mudou na sua.\n\n"
        "Se foi você, é só entrar normalmente. Se esqueceu a senha, use a "
        "recuperação na tela de entrada.\n\n"
        "Se não foi você, não precisa fazer nada.\n\n"
        "WaveAI"
    )
