"""Corpos dos e-mails: texto e alternativa HTML (emenda à ADR-0044).

100% sintético, sem banco nem rede. Garante que o HTML **espelha** o texto (o
código viaja nas duas formas), que é auto-contido e sem asset remoto, e que as
regras da ADR-0043 sobrevivem no HTML do convite.
"""

from __future__ import annotations

import pytest
from app.emails import (
    corpo_acesso_autorizado,
    corpo_cadastro_existente,
    corpo_convite,
    corpo_endereco_ja_em_uso,
    corpo_recuperacao,
    corpo_troca_aviso_endereco_antigo,
    corpo_troca_de_email,
    corpo_verificacao,
)

_LINK = "https://waveai.tec.br/reset-password?token=abc"

TODOS = [
    corpo_verificacao(codigo="284913", minutos=15),
    corpo_recuperacao(codigo="571046", link=_LINK, minutos=15),
    corpo_troca_de_email(codigo="900001", minutos=15),
    corpo_troca_aviso_endereco_antigo(minutos=15),
    corpo_endereco_ja_em_uso(),
    corpo_acesso_autorizado(),
    corpo_convite(de_profissional=True),
    corpo_convite(de_profissional=False, lembrete=True),
    corpo_cadastro_existente(),
]


@pytest.mark.parametrize("corpo", TODOS)
def test_html_e_texto_existem_e_html_e_autocontido(corpo):
    assert corpo.texto.strip(), "o texto é obrigatório e viaja sempre"
    assert corpo.html.lstrip().startswith("<table"), "HTML de e-mail é tabela"
    # Zero asset remoto: nenhuma imagem, nenhum src externo (seria rastreio).
    assert "<img" not in corpo.html
    assert "src=" not in corpo.html


CODIGOS = [
    (corpo_verificacao(codigo="284913", minutos=15), "284913"),
    (corpo_recuperacao(codigo="571046", link=_LINK, minutos=15), "571046"),
    (corpo_troca_de_email(codigo="900001", minutos=15), "900001"),
]


@pytest.mark.parametrize("corpo,codigo", CODIGOS)
def test_o_codigo_aparece_no_texto_e_no_html(corpo, codigo):
    """O que discrimina o pareamento: perder o código numa das formas trancaria
    a pessoa fora da conta (o dano que o fail-closed da ADR-0044 evita)."""
    assert codigo in corpo.texto
    assert codigo in corpo.html


def test_recuperacao_tem_botao_com_o_link():
    corpo = corpo_recuperacao(
        codigo="571046", link="https://waveai.tec.br/reset-password?token=xyz", minutos=15
    )
    assert 'href="https://waveai.tec.br/reset-password?token=xyz"' in corpo.html


def test_convite_no_html_nao_tem_link_de_acao_nem_botao():
    """ADR-0043/0024: o e-mail de convite não carrega link de ação — aceitar
    exige entrar na conta. O HTML não pode reintroduzir um `<a>`."""
    corpo = corpo_convite(de_profissional=True)
    assert "<a " not in corpo.html
    assert "href=" not in corpo.html
