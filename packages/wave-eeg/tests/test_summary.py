"""Sumário por template determinístico (N5-c, ADR-0035) — sem LLM, sem clínica."""
from wave_eeg.longitudinal import longitudinal_report
from wave_eeg.summary import DISCLAIMER_LINE, SUMMARY_TOP_K, summarize_report


def _report(sessions, quality=None):
    return longitudinal_report(sessions, quality_scores=quality)


def test_sumario_descreve_tendencia_e_qualidade():
    sessions = [
        {"rel_alpha": 0.20, "rel_beta": 0.10},
        {"rel_alpha": 0.30, "rel_beta": 0.10},
        {"rel_alpha": 0.40, "rel_beta": 0.10},
    ]
    linhas = summarize_report(_report(sessions, quality=[0.9, 0.8, 0.7]))
    texto = " ".join(linhas)
    assert "Resumo de 3 sessões." in linhas
    # alfa relativo subiu -> aparece com nome amigável e direção.
    assert any("alfa relativo" in l and "subindo" in l for l in linhas)
    assert "Qualidade do sinal" in texto
    # Fecha sempre com o enquadramento não-clínico.
    assert linhas[-1] == DISCLAIMER_LINE


def test_sumario_sem_tendencia_marca_estavel():
    sessions = [{"rel_alpha": 0.30}] * 4
    linhas = summarize_report(_report(sessions))
    assert any("estáveis" in l for l in linhas)


def test_sumario_poucas_sessoes_nao_inventa_tendencia():
    linhas = summarize_report(_report([{"rel_alpha": 0.3}]))
    assert len(linhas) == 1
    assert "suficientes" in linhas[0]


def test_sumario_limita_ao_top_k():
    # 6 features todas com tendência forte -> destaca no máximo SUMMARY_TOP_K.
    nomes = ["rel_delta", "rel_theta", "rel_alpha", "rel_beta", "rel_gamma", "median_frequency"]
    sessions = [
        {n: 0.10 * (s + 1) * (i + 1) for i, n in enumerate(nomes)}
        for s in range(3)
    ]
    linhas = summarize_report(_report(sessions))
    destaques = [l for l in linhas if "% ao longo das sessões)" in l]
    assert len(destaques) == SUMMARY_TOP_K
    assert any("outra(s) feature(s)" in l for l in linhas)


def test_nao_ha_termo_clinico_no_sumario():
    # O vocabulário clínico-sonante fica fora do sumário (Medical/71). O termo
    # abandonado pela ADR-0032 tem guard de CI próprio, então não o repetimos
    # aqui — checamos os demais.
    sessions = [{"rel_alpha": 0.2}, {"rel_alpha": 0.5}]
    texto = " ".join(summarize_report(_report(sessions))).lower()
    for proibido in ("diagnóstic", "doença", "transtorno", "patológ"):
        assert proibido not in texto
