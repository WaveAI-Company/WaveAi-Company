"""Métricas **eSense** da NeuroSky (Attention/Meditation) — ADR-0034.

Deliberadamente **separado** do Catálogo de Features N2 (`features.py`), que só
expõe features **transparentes e interpretáveis**. O eSense é um **algoritmo
proprietário e fechado** da NeuroSky, **sem validação científica independente**:
"métrica válida" é alegação do fabricante, não fato estabelecido.

**[RÍGIDO — ADR-0034]** Onde quer que apareça (UI, relatórios, `Result`), o eSense
carrega **rótulo obrigatório** de *proprietária / não-validada / exploratória*, e
**nunca** é base de claim nem apresentado como "medida de atenção" sem a ressalva.
A camada **primária** continua sendo as features transparentes do Catálogo N2
(explicáveis para o médico); o eSense é **complemento, não fundamento**.
"""
from __future__ import annotations

from .features import FeatureSpec

#: Rótulo de confiabilidade exclusivo do eSense — distinto de "defensável"/
#: "cautela" do Catálogo N2 justamente para não se confundir com uma feature
#: transparente. Torna o guarda-corpo visível no próprio dado.
ESENSE_RELIABILITY = "proprietária/não-validada"

_ESENSE_NOTE = (
    "eSense é algoritmo PROPRIETÁRIO e FECHADO da NeuroSky, SEM validação "
    "científica independente; exploratória. Nunca base de claim nem "
    "apresentada como medida direta sem esta ressalva (ADR-0034)."
)

#: Catálogo eSense. Mesma forma (`FeatureSpec`) das features do Catálogo N2 para
#: serialização uniforme, mas mantido à parte e marcado como proprietário.
ESENSE_CATALOG = (
    FeatureSpec(
        "attention", "0..100 (proprietário)", "0..100",
        "eSense Attention (NeuroSky). " + _ESENSE_NOTE,
        ESENSE_RELIABILITY,
        "device-específico (NeuroSky); NÃO é feature transparente do Catálogo N2.",
    ),
    FeatureSpec(
        "meditation", "0..100 (proprietário)", "0..100",
        "eSense Meditation (NeuroSky). " + _ESENSE_NOTE,
        ESENSE_RELIABILITY,
        "device-específico (NeuroSky); NÃO é feature transparente do Catálogo N2.",
    ),
)

#: Nomes das métricas eSense (conveniência para consumidores).
ESENSE_NAMES = tuple(spec.name for spec in ESENSE_CATALOG)
