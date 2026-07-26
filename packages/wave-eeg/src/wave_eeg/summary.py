"""Sumário por **template determinístico** do relatório longitudinal (N5-c, ADR-0035).

Transforma o relatório numérico (`wave_eeg.longitudinal.longitudinal_report`) em
frases legíveis em PT-BR, **sem LLM** e **sem interpretação clínica** — apenas
descreve as tendências que os números já dizem. É a **base confiável** da camada
de linguagem: a narrativa-LLM (N6) é upgrade de fluência **por cima** disto, nunca
em vez disto (ADR-0035).

**[RÍGIDO]** Nada aqui infere estado clínico. "Subindo/descendo" é a direção
**numérica** de uma feature; os nomes amigáveis são apenas rótulos de banda/
espectro, sem significado diagnóstico (Medical/71).
"""
from __future__ import annotations

#: Nº máximo de features destacadas no sumário (as de maior variação). Evita um
#: sumário longo demais quando muitas features têm tendência.
SUMMARY_TOP_K = 4

#: Rótulos legíveis das features do Catálogo N2 — descrições factuais de banda/
#: espectro, sem interpretação. Feature fora do mapa cai no próprio nome.
FRIENDLY_NAMES = {
    "rel_delta": "delta relativo",
    "rel_theta": "teta relativo",
    "rel_alpha": "alfa relativo",
    "rel_beta": "beta relativo",
    "rel_gamma": "gama relativo",
    "ratio_theta_beta": "razão teta/beta",
    "ratio_alpha_beta": "razão alfa/beta",
    "spectral_edge_95": "frequência de borda (95%)",
    "median_frequency": "frequência mediana",
    "spectral_entropy": "entropia espectral",
    "peak_alpha_frequency": "frequência de pico alfa",
    "rms": "amplitude RMS",
    "total_power": "potência total",
}

#: Frase de honestidade fechando todo sumário (enquadramento não-clínico).
DISCLAIMER_LINE = "Descrição de tendências numéricas — não é interpretação clínica."


def _friendly(name: str) -> str:
    return FRIENDLY_NAMES.get(name, name)


def summarize_report(report: dict, *, top_k: int = SUMMARY_TOP_K) -> list[str]:
    """Sumário em frases do relatório longitudinal. Determinístico e auditável.

    Retorna uma lista de linhas (PT-BR). Com menos de 2 sessões, informa que
    ainda não há base para tendências (não inventa direção)."""
    n = int(report.get("n_sessions", 0))
    features = report.get("features", {}) or {}

    if n < 2:
        return [f"Ainda não há sessões suficientes para tendências (n={n})."]

    lines = [f"Resumo de {n} sessões."]

    trending = [
        (name, spec) for name, spec in features.items()
        if spec.get("direction") in ("subindo", "descendo")
    ]
    trending.sort(key=lambda kv: -abs(kv[1].get("delta_pct", 0.0)))

    if trending:
        for name, spec in trending[:top_k]:
            lines.append(
                f"{_friendly(name)}: {spec['direction']} "
                f"({spec.get('delta_pct', 0.0):+.0f}% ao longo das sessões)."
            )
        restantes = len(trending) - top_k
        if restantes > 0:
            lines.append(f"(+{restantes} outra(s) feature(s) com tendência menor.)")
    else:
        lines.append("Sem tendências marcantes; as features ficaram estáveis no período.")

    quality = report.get("quality")
    if isinstance(quality, dict) and "mean" in quality:
        lines.append(
            f"Qualidade do sinal: média {quality['mean']:.2f}, "
            f"mínima {quality.get('min', quality['mean']):.2f} (escala 0–1)."
        )

    lines.append(DISCLAIMER_LINE)
    return lines
