"""Versão vigente dos Termos de Uso — fonte da verdade do servidor (ADR-0048).

Espelha o `app/consent.py`, e pelo mesmo motivo: o app mostra o texto e informa
a versão que **exibiu**; se ela não bater com a vigente aqui (o texto mudou
desde que a tela abriu), a API recusa. Aceitar um texto que já não é o que está
publicado não é aceite informado.

**Um número só.** A Política de Privacidade é parte dos Termos por referência —
o próprio texto diz isso —, então este número responde pelos dois. Dois campos
poderiam divergir sem ninguém perceber.

O texto em si vive no app (`apps/wave-app/src/legal/documents.ts`), que é quem
o renderiza. Duplicar aqui só o **número** é a mesma troca que o termo de
consentimento já faz: o cliente informa o que mostrou, o servidor decide se
aceita. Ao subir a versão lá, suba aqui.
"""

from __future__ import annotations

#: Versão vigente dos Termos de Uso. Suba a cada mudança material do texto.
#: Como este número responde também pela Política (ela é parte dos Termos por
#: referência), mudança material **em qualquer um dos dois** faz este subir.
#: 1.1: foro do domicílio do usuário nos Termos; identificação do controlador,
#: canal de contato e prazos de retenção na Política (que foi para 1.2).
TERMS_VERSION = "1.1"
