"""Termo de consentimento informado — versão canônica (ADR-0026 / Medical/72).

O **backend é a fonte da verdade** sobre qual é a versão vigente do termo. O
app mostra o texto correspondente e, ao aceitar, informa a versão que exibiu;
se ela não bater com a vigente (o termo mudou desde que a tela abriu), a API
recusa — consentir a um texto desatualizado não é consentimento informado.

Ao versionar, registramos **o que** o titular aceitou, não só *quando*
(Medical/72 §2). Suba a versão sempre que o conteúdo material do termo mudar.
"""

from __future__ import annotations

#: Versão vigente do termo. Formato livre; mude a cada alteração material.
CONSENT_TERM_VERSION = "1.0"
