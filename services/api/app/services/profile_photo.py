"""Re-codificação da foto de perfil no servidor (ADR-0050).

O que o cliente manda é tratado como **não confiável**: a imagem é aberta,
validada, redimensionada e **re-codificada** para um JPEG normalizado sem EXIF.

Três motivos, todos de peso:

- **Privacidade** — foto de rosto costuma carregar GPS no EXIF; re-codificar num
  bitmap novo descarta todo metadado.
- **Segurança** — abrir e re-salvar mata o polyglot (arquivo que é imagem *e*
  HTML/JS ao mesmo tempo) e, com o teto de pixels do Pillow, barra a
  *decompression bomb*. Nunca guardamos os bytes originais.
- **Previsibilidade** — a saída tem formato e tamanho conhecidos, então servir de
  volta é trivial e o tamanho no banco é pequeno.
"""

from __future__ import annotations

import io

from PIL import Image, UnidentifiedImageError

#: Teto do upload cru (5 MB). Acima disso recusamos antes de gastar CPU com o
#: decode — foto de perfil não precisa de mais que isso.
TAMANHO_MAXIMO_UPLOAD = 5 * 1024 * 1024

#: Lado máximo do resultado. Avatar não precisa de mais; mantém o blob em dezenas
#: de KB e a linha do Postgres pequena.
LADO_MAXIMO = 512

#: Teto de pixels do decode: barra *decompression bomb* (uma imagem pequena no
#: disco que estoura a memória ao descomprimir). 4096×4096 é folgado para foto.
_MAX_PIXELS = 4096 * 4096

#: Content-type do resultado. Sempre JPEG — o servidor normaliza tudo para cá.
CONTENT_TYPE = "image/jpeg"


class ImagemInvalida(Exception):
    """Os bytes recebidos não são uma imagem que aceitamos processar."""


def processar_foto(dados: bytes) -> bytes:
    """Recebe os bytes crus e devolve um JPEG normalizado, sem EXIF.

    Levanta `ImagemInvalida` para qualquer coisa que não seja uma imagem raster
    aceitável (inclui SVG, que é executável, e arquivos corrompidos ou grandes
    demais). Quem chama traduz isso em 4xx.
    """
    if len(dados) > TAMANHO_MAXIMO_UPLOAD:
        raise ImagemInvalida("imagem grande demais")
    if not dados:
        raise ImagemInvalida("corpo vazio")

    limite_anterior = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = _MAX_PIXELS
    try:
        try:
            imagem = Image.open(io.BytesIO(dados))
            imagem.load()  # força o decode aqui, onde tratamos a falha
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            # SVG cai aqui (o Pillow não o abre como raster), assim como bytes que
            # não são imagem, arquivo truncado ou bomba de descompressão.
            raise ImagemInvalida("não é uma imagem válida") from exc

        # `convert("RGB")` descarta canal alfa e paleta: JPEG não tem alfa, e
        # normalizar aqui evita erro no save. Também achata imagem com paleta.
        imagem = imagem.convert("RGB")
        # `thumbnail` preserva a proporção e só REDUZ (nunca amplia): uma foto já
        # pequena passa intacta, uma grande encolhe para caber no lado máximo.
        imagem.thumbnail((LADO_MAXIMO, LADO_MAXIMO))

        saida = io.BytesIO()
        # Sem `exif=`: o bitmap re-salvo não carrega nada do original.
        imagem.save(saida, format="JPEG", quality=85, optimize=True)
        return saida.getvalue()
    finally:
        Image.MAX_IMAGE_PIXELS = limite_anterior
