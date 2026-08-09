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
