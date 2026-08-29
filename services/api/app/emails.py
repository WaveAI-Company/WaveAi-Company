"""Textos dos e-mails transacionais — versão em texto **e** alternativa HTML.

Ficam **do lado da API**, não do adapter (ADR-0044, item 1 + emenda de
2026-08-29): trocar o provedor no P5 não pode mexer em cópia nem em visual.

Cada e-mail é um par `CorpoEmail(texto, html)`. **O texto viaja sempre** — um
cliente que não renderiza HTML não pode perder o código, senão a pessoa fica
trancada fora da conta (o dano que o fail-closed da ADR-0044 evita). O texto é o
que o console de dev imprime, e é o que a regex dos testes lê. O HTML **espelha**
o texto: mesmo conteúdo, com a marca "Maré", sem afirmar nada que o texto não
diga (ADR-0027).

O HTML é **auto-contido**: tabelas + estilo inline, **zero asset remoto** (imagem
externa em e-mail é rastreio de abertura — contra a privacidade do projeto). A
marca é wordmark em texto, não logo hospedado.

**Sem claim clínica** (Medical/71): estes e-mails falam de acesso à conta, não
de saúde. Nenhum deles descreve dado do titular.
"""

from __future__ import annotations

from dataclasses import dataclass
from html import escape as _esc

ASSUNTO_VERIFICACAO = "Seu código de verificação do WaveAI"
ASSUNTO_CADASTRO_EXISTENTE = "Alguém tentou criar uma conta com o seu e-mail"
ASSUNTO_RECUPERACAO = "Recuperar o acesso à sua conta WaveAI"
ASSUNTO_TROCA_DE_EMAIL = "Confirme seu novo e-mail no WaveAI"
ASSUNTO_TROCA_AVISO = "O e-mail da sua conta WaveAI está sendo alterado"
ASSUNTO_ENDERECO_JA_EM_USO = "Alguém tentou usar o seu e-mail em outra conta"
ASSUNTO_CONVITE = "Você recebeu um convite de acompanhamento no WaveAI"
ASSUNTO_CONVITE_LEMBRETE = "Lembrete: um convite espera por você no WaveAI"
ASSUNTO_ACESSO_AUTORIZADO = "Você foi autorizado a acompanhar alguém no WaveAI"


@dataclass(frozen=True)
class CorpoEmail:
    """As duas formas do mesmo e-mail. O `texto` é obrigatório e viaja sempre;
    o `html` é a alternativa estilizada (emenda à ADR-0044)."""

    texto: str
    html: str


# -- Toolkit HTML: e-mail é tabela + estilo inline. Cada helper devolve UMA -----
# -- linha (<tr>) da coluna central. Cores do sistema "Maré" (Design/round1). ---

_TEAL = "#0F7A70"      # e-mails de conta (verificação, recuperação, troca…)
_AZUL_PRO = "#7AA2F7"  # contexto profissional (convite, acesso autorizado)


def _p(texto: str, *, cor: str = "#3a465c") -> str:
    """Parágrafo. `texto` é HTML confiável (escrito aqui); valor dinâmico
    (código, link) entra já escapado pelos helpers próprios."""
    return (
        f'<tr><td style="padding:0 32px 14px;font-size:15px;line-height:1.65;'
        f'color:{cor};">{texto}</td></tr>'
    )


def _codigo(codigo: str) -> str:
    """Bloco do código — o herói da mensagem, grande e espaçado."""
    seguro = _esc(codigo)
    return (
        '<tr><td style="padding:6px 32px 18px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td align="center" style="background:#F5F7FA;border:1px solid #E1E8F0;'
        "border-radius:12px;padding:18px 12px;font-family:'SFMono-Regular',Consolas,"
        "Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:.42em;"
        f'color:#06231F;text-indent:.42em;">{seguro}</td>'
        "</tr></table></td></tr>"
    )


def _botao(*, rotulo: str, href: str, accent: str) -> str:
    """Botão "bulletproof" (tabela + padding): resiste aos clientes que ignoram
    CSS de `<a>`."""
    return (
        '<tr><td style="padding:6px 32px 16px;">'
        '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        f'<td align="center" style="background:{accent};border-radius:10px;">'
        f'<a href="{_esc(href)}" style="display:inline-block;padding:13px 26px;'
        f'font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">{rotulo}</a>'
        "</td></tr></table></td></tr>"
    )


def _layout(*, accent: str, conteudo: str, rodape: str) -> str:
    """Embrulha o conteúdo com o wordmark, a saudação e o rodapé. Documento
    completo, auto-contido, seguro para e-mail."""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#F5F7FA;">'
        '<tr><td align="center" style="padding:28px 16px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="max-width:520px;background:#FFFFFF;border:1px solid #EDF1F6;'
        'border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,'
        "'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
        # cabeçalho / wordmark
        '<tr><td style="padding:26px 32px 0;">'
        '<span style="font-size:20px;font-weight:700;letter-spacing:-.01em;'
        'color:#0F1726;">Wave<span style="color:#0F7A70;">AI</span></span>'
        f'<div style="height:3px;width:34px;background:{accent};border-radius:3px;'
        'margin-top:8px;"></div></td></tr>'
        # saudação
        '<tr><td style="padding:22px 32px 14px;font-size:16px;line-height:1.6;'
        'color:#0F1726;">Olá!</td></tr>'
        f"{conteudo}"
        # rodapé
        '<tr><td style="padding:10px 32px 28px;">'
        '<div style="border-top:1px solid #EDF1F6;padding-top:16px;font-size:12px;'
        f'line-height:1.6;color:#8291A9;">{rodape}</div></td></tr>'
        "</table></td></tr></table>"
    )


_RODAPE_PADRAO = "WaveAI — bem-estar e tendências a partir do seu próprio sinal."


def corpo_verificacao(*, codigo: str, minutos: int) -> CorpoEmail:
    """Código de verificação do cadastro.

    Só o código: a verificação acontece na tela em que a pessoa já está
    (`Design/round1/criar-conta.html`, passo 2 de 3), então não há link a
    oferecer aqui. O link entra na recuperação de senha (fatia 6), que é o
    fluxo em que o design pede "link e código".
    """
    texto = (
        "Olá!\n\n"
        f"Seu código de verificação é: {codigo}\n\n"
        f"Ele vale por {minutos} minutos e pode ser usado uma única vez.\n\n"
        "Se não foi você quem pediu, ignore esta mensagem — sem o código, a "
        "conta não é ativada.\n\n"
        "WaveAI"
    )
    html = _layout(
        accent=_TEAL,
        conteudo=(
            _p("Use o código abaixo para confirmar seu e-mail e ativar sua conta.")
            + _codigo(codigo)
            + _p(
                f"Ele vale por <b>{minutos} minutos</b> e pode ser usado uma única "
                "vez.",
                cor="#68778F",
            )
            + _p(
                "Se não foi você quem pediu, ignore esta mensagem — sem o código, "
                "a conta não é ativada.",
                cor="#68778F",
            )
        ),
        rodape=(
            _RODAPE_PADRAO
            + "<br>Você recebeu este e-mail porque alguém usou este endereço para "
            "criar uma conta."
        ),
    )
    return CorpoEmail(texto=texto, html=html)


def corpo_recuperacao(*, codigo: str, link: str, minutos: int) -> CorpoEmail:
    """Recuperação de senha: **link e código**, as duas formas do mesmo segredo.

    O design oferece os dois na mesma tela (`Design/round1/login.html`) — abrir
    o link ou digitar o código. Usar um queima o outro: é um segredo só.

    O aviso final não é enfeite: um e-mail de recuperação que a pessoa não
    pediu é o primeiro sinal de que alguém está tentando entrar na conta dela.
    """
    texto = (
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
    html = _layout(
        accent=_TEAL,
        conteudo=(
            _p(
                "Recebemos um pedido para redefinir a senha da sua conta WaveAI. "
                "Abra o botão abaixo, ou use o código na tela de recuperação."
            )
            + _botao(rotulo="Redefinir senha", href=link, accent=_TEAL)
            + _p("Ou use o código:", cor="#68778F")
            + _codigo(codigo)
            + _p(
                f"Vale por <b>{minutos} minutos</b> e só pode ser usado uma vez. Ao "
                "redefinir a senha, todas as sessões abertas serão encerradas.",
                cor="#68778F",
            )
            + _p(
                "Se não foi você quem pediu, ignore — sua senha continua a mesma. "
                "Vale conferir se mais alguém tem acesso ao seu e-mail.",
                cor="#68778F",
            )
        ),
        rodape=_RODAPE_PADRAO,
    )
    return CorpoEmail(texto=texto, html=html)


def corpo_troca_de_email(*, codigo: str, minutos: int) -> CorpoEmail:
    """Código enviado ao endereço **novo** (3ª emenda à ADR-0044).

    Vai só o código, como o design pede em `perfil.html` ("confirmaremos o novo
    endereço com um código") — e pela mesma razão da verificação: quem pediu a
    troca está logado, na tela onde vai digitá-lo. Um link aqui só ampliaria a
    superfície.

    **Não diz de qual conta se trata.** Quem recebe pode não ser dono da conta
    que pediu a troca — alguém pode ter digitado o endereço errado, ou de
    propósito. Nomear a conta contaria a um estranho quem usa o WaveAI.
    """
    texto = (
        "Olá!\n\n"
        "Recebemos um pedido para passar a usar este endereço numa conta "
        "WaveAI.\n\n"
        f"Seu código de confirmação é: {codigo}\n\n"
        f"Ele vale por {minutos} minutos e pode ser usado uma única vez. "
        "Enquanto não for usado, nada muda.\n\n"
        "Se não foi você quem pediu, ignore esta mensagem.\n\n"
        "WaveAI"
    )
    html = _layout(
        accent=_TEAL,
        conteudo=(
            _p("Recebemos um pedido para passar a usar este endereço numa conta WaveAI.")
            + _codigo(codigo)
            + _p(
                f"Ele vale por <b>{minutos} minutos</b> e pode ser usado uma única "
                "vez. Enquanto não for usado, nada muda.",
                cor="#68778F",
            )
            + _p("Se não foi você quem pediu, ignore esta mensagem.", cor="#68778F")
        ),
        rodape=_RODAPE_PADRAO,
    )
    return CorpoEmail(texto=texto, html=html)


def corpo_troca_aviso_endereco_antigo(*, minutos: int) -> CorpoEmail:
    """Aviso ao endereço **atual** de que a troca foi pedida.

    É o único sinal que chega a quem perdeu o controle da conta: sem ele, um
    invasor com a sessão e a senha trocaria o endereço em silêncio e a pessoa
    descobriria só quando não conseguisse mais recuperar o acesso.

    **Não repete o endereço novo**: se a troca partiu de um invasor, este aviso
    é o que chega à vítima — e não faz sentido entregar a ela o endereço de
    quem está tomando a conta, nem entregar a terceiros o endereço de destino
    caso a caixa esteja comprometida.
    """
    texto = (
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
    html = _layout(
        accent=_TEAL,
        conteudo=(
            _p(
                "Alguém pediu para trocar o e-mail da sua conta WaveAI. A troca só "
                f"acontece se o novo endereço for confirmado, dentro de {minutos} "
                "minutos."
            )
            + _p("Se foi você, não precisa fazer nada aqui — basta confirmar no novo endereço.")
            + _p(
                "Se <b>NÃO</b> foi você, troque sua senha agora: alguém pode ter "
                "acesso à sua conta.",
                cor="#0F1726",
            )
        ),
        rodape=_RODAPE_PADRAO,
    )
    return CorpoEmail(texto=texto, html=html)


def corpo_endereco_ja_em_uso() -> CorpoEmail:
    """Aviso a quem **já tem** conta e cujo endereço alguém tentou assumir.

    Existe pelo mesmo motivo de `corpo_cadastro_existente`: a rota de troca
    responde igual exista ou não conta no endereço pedido (ADR-0024), senão
    qualquer pessoa logada teria um oráculo de "esse e-mail tem WaveAI?".
    Quem precisa saber é a dona do endereço, e ela sabe por aqui.
    """
    texto = (
        "Olá!\n\n"
        "Alguém tentou passar a usar este e-mail numa outra conta WaveAI. Como "
        "ele já pertence à sua conta, nada foi alterado — nem aqui, nem lá.\n\n"
        "Se foi você, entre normalmente na conta que já usa este endereço.\n\n"
        "Se não foi você, não precisa fazer nada.\n\n"
        "WaveAI"
    )
    html = _layout(
        accent=_TEAL,
        conteudo=(
            _p(
                "Alguém tentou passar a usar este e-mail numa outra conta WaveAI. "
                "Como ele já pertence à sua conta, nada foi alterado — nem aqui, nem lá."
            )
            + _p("Se foi você, entre normalmente na conta que já usa este endereço.")
            + _p("Se não foi você, não precisa fazer nada.", cor="#68778F")
        ),
        rodape=_RODAPE_PADRAO,
    )
    return CorpoEmail(texto=texto, html=html)


def corpo_acesso_autorizado() -> CorpoEmail:
    """Avisa o profissional de que **já** foi autorizado a acompanhar alguém.

    Quando é o paciente quem inicia, o vínculo nasce `active` (ADR-0024: o ato
    dele é o consentimento) — não há convite a aceitar, e por isso o texto é
    outro. Sem este aviso, o profissional só descobre o acesso se abrir o app
    por acaso.

    Não nomeia a pessoa, pelo mesmo motivo do convite: `display_name` é texto
    escolhido por ela e não passa por uma caixa de entrada com a nossa
    assinatura.
    """
    texto = (
        "Olá!\n\n"
        "Uma pessoa autorizou você a acompanhar as sessões dela no WaveAI.\n\n"
        "Entre na sua conta para ver quem é e o que ela compartilhou. O acesso "
        "é somente leitura, fica registrado em trilha, e ela pode encerrar "
        "quando quiser.\n\n"
        "WaveAI"
    )
    html = _layout(
        accent=_AZUL_PRO,
        conteudo=(
            _p("Uma pessoa autorizou você a acompanhar as sessões dela no WaveAI.")
            + _p(
                "Entre na sua conta para ver quem é e o que ela compartilhou. O "
                "acesso é somente leitura, fica registrado em trilha, e ela pode "
                "encerrar quando quiser."
            )
        ),
        rodape=_RODAPE_PADRAO,
    )
    return CorpoEmail(texto=texto, html=html)


def corpo_convite(*, de_profissional: bool, lembrete: bool = False) -> CorpoEmail:
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
    texto = (
        "Olá!\n\n"
        f"{abertura}\n\n"
        "Entre na sua conta para ver quem convidou, o que a pessoa passaria a "
        "ver e decidir se aceita. Nada é compartilhado enquanto você não "
        "aceitar.\n\n"
        "Se não quiser aceitar, é só ignorar — ou recusar dentro do app.\n\n"
        "WaveAI"
    )
    html = _layout(
        accent=_AZUL_PRO,
        conteudo=(
            _p(abertura)
            + _p(
                "Entre na sua conta para ver <b>quem convidou</b>, <b>o que a "
                "pessoa passaria a ver</b> e decidir se aceita. Nada é "
                "compartilhado enquanto você não aceitar."
            )
            + _p(
                "Se não quiser aceitar, é só ignorar — ou recusar dentro do app.",
                cor="#68778F",
            )
        ),
        rodape=(
            "WaveAI — este aviso não traz o nome de quem convidou, o recado, nem um "
            "botão de aceite: aceitar exige entrar na sua conta."
        ),
    )
    return CorpoEmail(texto=texto, html=html)


def corpo_cadastro_existente() -> CorpoEmail:
    """Aviso a quem **já tem** conta e cujo endereço foi usado num cadastro.

    Existe para que a API possa responder **igual** a todo cadastro, sem contar
    a quem perguntou se o e-mail já existe. Quem precisa saber é a dona do
    endereço — e ela fica sabendo por aqui, não o curioso do outro lado.
    """
    texto = (
        "Olá!\n\n"
        "Alguém tentou criar uma conta no WaveAI com este e-mail, que já está "
        "cadastrado. Nenhuma conta nova foi criada e nada mudou na sua.\n\n"
        "Se foi você, é só entrar normalmente. Se esqueceu a senha, use a "
        "recuperação na tela de entrada.\n\n"
        "Se não foi você, não precisa fazer nada.\n\n"
        "WaveAI"
    )
    html = _layout(
        accent=_TEAL,
        conteudo=(
            _p(
                "Alguém tentou criar uma conta no WaveAI com este e-mail, que já "
                "está cadastrado. Nenhuma conta nova foi criada e nada mudou na sua."
            )
            + _p(
                "Se foi você, é só entrar normalmente. Se esqueceu a senha, use a "
                "recuperação na tela de entrada."
            )
            + _p("Se não foi você, não precisa fazer nada.", cor="#68778F")
        ),
        rodape=_RODAPE_PADRAO,
    )
    return CorpoEmail(texto=texto, html=html)
