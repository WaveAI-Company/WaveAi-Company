"""Estagio 3: gera o .srt do video final a partir da transcricao.

Uso (da raiz do repo), DEPOIS de montar_audio.py:
    python Faculdade/Conecta_Pitch_2026/gerar_legendas.py

A marcacao por palavra vem do faster-whisper. O modelo erra nome proprio --
"WaveAI" vira "EVI", "INSS" vira "INSAS" -- entao ha um dicionario de
correcoes abaixo. **O texto precisa ser revisado por uma pessoa antes de
queimar**: o dicionario cobre o que eu vi, nao o que eu nao vi.
"""

import json
import pathlib

AQUI = pathlib.Path(__file__).resolve().parent
AUDIO = AQUI / "pitch" / "_build" / "audio"
TRANSCR = pathlib.Path(
    "C:/Users/TIAGO_~1/AppData/Local/Temp/claude/"
    "C--Users-tiago-0mao8ei-Claude-Projects-WaveAI/"
    "ae878d66-d7f4-4ab7-878c-38c84ebbb392/scratchpad/transcricao")

# bloco -> (chave da transcricao, deslocamento do recorte, cortes internos)
BLOCOS = [
    ("b1-tiago-pe-na-porta", "tiago__1-Tiago", 0.30, []),
    ("b2-nickolas-problema", "nickolas__nickolas", 0.25, []),
    ("b3a-nickolas-pergunta", "nickolas__nickolas", 43.85, []),
    ("b3b-gustavo-lacuna", "gustavo__gustavo1", 1.05, []),
    ("b4-gustavo-solucao", "gustavo__gustavo2", 1.00, []),
    ("b5-gustavo-demo", "gustavo__gustavo3", 1.65, [(17.53, 19.65)]),
    ("b6-tiago-diferenciais", "tiago__2-Tiago", 0.00, []),
    ("b7-nickolas-negocio", "nickolas__nickolas", 50.65, []),
    ("b8-tiago-pedido", "tiago__3-Tiago", 0.35, []),
    ("b9-gustavo-slogan", "gustavo__gustavo4", 0.95, []),
]

CORRECOES = {
    "evi": "WaveAI", "insas": "INSS", "nr1": "NR-1", "q-12": "512",
    "benstar": "bem-estar", "benestar": "bem-estar", "eg": "EEG",
    "webSocket": "WebSocket", "cortex": "córtex",
}

# Erros de varias palavras, aplicados sobre a legenda ja montada. O modelo
# nao conhece o vocabulario do projeto e inventa coisas como
# "o eletron se falou grama" no lugar de "o eletroencefalograma".
FRASES = [
    ("elétron se falou grama", "eletroencefalograma"),
    ("Q-interpreta", "Quem interpreta"),
    ("se apanha alguém", "se apoia em alguém"),
    ("é um alto relato", "é autorrelato"),
    ("aqui menos conseguir", "a que menos consegue"),
    ("gota a arma balança", "igual a tarar uma balança"),
    ("Três indicadores", "Treze indicadores"),
    ("o profissional de bem-estar viu o acompanhamento",
     "o profissional de bem-estar vê o acompanhamento"),
    ("aturizou", "autorizou"),
    ("matril de auditoria", "trilha de auditoria"),
    ("leitural ditado", "leitura auditada"),
    ("transseumentais", "transtornos mentais"),
    ("um volunt", "voluntária"),
    ("veio dado de um indivíduo", "vê o dado de um indivíduo"),
    ("aqui efetivamente escala", "a que escala"),
    ("só não há inteligência", "e não tem a inteligência"),
    ("investível", "vestível"),
    ("no inserir leia", "lá fora lê"),
    ("capita", "capta"),
    ("www.evi.tech.br", "waveai.tec.br"),
    ("bem estaria em movimento", "bem-estar em movimento"),
    ("é uma coisa", "numa coisa"),
    ("se envia no sinal bruto", "envia o sinal bruto"),
    ("não estiver se captando", "não estiver captando"),
    ("algum de vocês medem", "alguns de vocês medem"),
]

MAX_CARACTERES = 42   # legenda de video: duas linhas curtas leem melhor
MAX_SEGUNDOS = 5.0


def corrige(p):
    base = p.strip(" ,.!?").lower()
    if base in CORRECOES:
        fim = p[len(p.rstrip(" ,.!?")):]
        return CORRECOES[base] + fim
    return p


def aplica_frases(palavras):
    """Corrige erros de varias palavras NA SEQUENCIA, antes de quebrar linhas.

    Fazer isso no .srt pronto nao funciona: a frase errada costuma estar
    partida entre duas legendas ("O eletron se falou" / "grama morava"), e aí
    nenhuma busca casa. Aqui o trecho casado vira uma entrada so, herdando o
    intervalo de tempo das palavras que substituiu.
    """
    for errado, certo in FRASES:
        alvo = errado.split()
        i = 0
        while i <= len(palavras) - len(alvo):
            trecho = [p[2].strip(" ,.!?") for p in palavras[i:i + len(alvo)]]
            if [t.lower() for t in trecho] == [a.lower() for a in alvo]:
                pont = palavras[i + len(alvo) - 1][2]
                fim = pont[len(pont.rstrip(" ,.!?")):]
                palavras[i:i + len(alvo)] = [
                    (palavras[i][0], palavras[i + len(alvo) - 1][1],
                     certo + fim)]
            i += 1
    return palavras


def hhmmss(t):
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", ",")


def main():
    duracoes = json.loads((AUDIO / "duracoes.json").read_text(encoding="utf-8"))
    linhas, n, base_t = [], 0, 0.0
    for bloco, chave, desloca, cortes in BLOCOS:
        d = json.loads((TRANSCR / f"{chave}.json").read_text(encoding="utf-8"))
        palavras = []
        for s in d["segmentos"]:
            for w in s["palavras"]:
                t0, t1 = w["i"], w["f"]
                if any(de <= t0 < ate for de, ate in cortes):
                    continue
                for de, ate in cortes:
                    if t0 >= ate:
                        t0 -= (ate - de)
                        t1 -= (ate - de)
                t0 -= desloca
                t1 -= desloca
                if t0 < -0.05 or t0 > duracoes[bloco] + 0.05:
                    continue
                palavras.append((max(0.0, t0), t1, corrige(w["p"])))
        palavras = aplica_frases(palavras)
        atual, ini, fim_ant = [], None, 0.0
        for t0, t1, p in palavras:
            if ini is None:
                ini = t0
            cand = " ".join([*atual, p])
            if atual and (len(cand) > MAX_CARACTERES or
                          t1 - ini > MAX_SEGUNDOS):
                n += 1
                linhas.append(f"{n}\n{hhmmss(base_t + ini)} --> "
                              f"{hhmmss(base_t + fim_ant)}\n"
                              f"{' '.join(atual)}\n")
                atual, ini = [p], t0
            else:
                atual.append(p)
            fim_ant = t1
        if atual:
            n += 1
            linhas.append(f"{n}\n{hhmmss(base_t + ini)} --> "
                          f"{hhmmss(base_t + fim_ant)}\n{' '.join(atual)}\n")
        base_t += duracoes[bloco]
    texto = "\n".join(linhas)
    trocadas = sum(1 for e, _ in FRASES if e in texto)
    for errado, certo in FRASES:
        texto = texto.replace(errado, certo)
    destino = AQUI / "pitch" / "_build" / "legendas.srt"
    destino.write_text(texto, encoding="utf-8")
    print(f"{n} legendas ate {hhmmss(base_t)} -> {destino}")
    print(f"{trocadas} de {len(FRASES)} correcoes de frase casaram")
    print("REVISE O TEXTO antes de queimar: o modelo erra nome proprio.")


if __name__ == "__main__":
    main()
