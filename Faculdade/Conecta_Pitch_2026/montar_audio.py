"""Estagio 1 da montagem: prepara as narracoes bloco a bloco.

Uso (da raiz do repo):
    python Faculdade/Conecta_Pitch_2026/montar_audio.py

Depende so do ffmpeg. Le os .mp4 de narracao em pitch/ e escreve wavs
normalizados em pitch/_build/audio/, um por bloco do roteiro.

O audio e a FUNDACAO da montagem: a duracao de cada bloco do video sai daqui,
nao do roteiro. Os recortes abaixo vieram da transcricao com marcacao por
palavra (faster-whisper), conferida uma a uma.

Tres tratamentos, cada um por um motivo medido em 29/10/2026:

- NIVEL. Medido em EBU R128: Tiago a -27 LUFS, Gustavo a -22. Cinco decibeis
  de diferenca soam como "longe do microfone". Tudo vai para -16 LUFS, que e
  o alvo usual de video.
- RUIDO. So o Nickolas precisa: 16,5 dB de relacao sinal/ruido contra 33 dB do
  Tiago. Denoise em audio limpo so piora, entao o Tiago nao e tratado.
- CORTE DE FRASE. Em gustavo3, "e o botao que importa, iniciar sessao" sai:
  esse botao NAO existe em nenhuma das telas gravadas -- o painel de producao
  diz "A captacao acontece no app do celular". A emenda cai no silencio entre
  "sessao" (fim 17,53) e "e" (inicio 17,53).
"""

import json
import pathlib
import subprocess

AQUI = pathlib.Path(__file__).resolve().parent
PITCH = AQUI / "pitch"
DEST = PITCH / "_build" / "audio"
FFMPEG = "C:/ProgramData/chocolatey/bin/ffmpeg.exe"

# bloco -> (arquivo, inicio, fim, denoise, cortes internos [(de, ate)])
# Tempos da transcricao, com uma folga curta para nao decepar sibilante.
BLOCOS = [
    ("b1-tiago-pe-na-porta",  "tiago/1-Tiago.mp4",    0.30, 32.75, False, []),
    ("b2-nickolas-problema",  "nickolas/nickolas.mp4", 0.25, 43.10, True,  []),
    ("b3a-nickolas-pergunta", "nickolas/nickolas.mp4", 43.85, 49.10, True, []),
    ("b3b-gustavo-lacuna",    "gustavo/gustavo1.mp4",  1.05, 19.00, False, []),
    ("b4-gustavo-solucao",    "gustavo/gustavo2.mp4",  1.00, 28.95, False, []),
    ("b5-gustavo-demo",       "gustavo/gustavo3.mp4",  1.65, 69.30, False,
     [(17.53, 19.65)]),
    ("b6-tiago-diferenciais", "tiago/2-Tiago.mp4",     0.00, 25.95, False, []),
    ("b7-nickolas-negocio",   "nickolas/nickolas.mp4", 50.65, 90.60, True, []),
    ("b8-tiago-pedido",       "tiago/3-Tiago.mp4",     0.35, 14.80, False, []),
    ("b9-gustavo-slogan",     "gustavo/gustavo4.mp4",  0.95, 3.80, False, []),
]

ALVO_LUFS = -16.0


def ff(args, captura=True):
    r = subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error" if captura
                        else "info", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg falhou:\n{' '.join(args)[:300]}\n{r.stderr[:900]}")
    return r.stderr


def cadeia(denoise, cortes, inicio, fim):
    """Monta o filtro: recorte(s) -> passa-alta -> denoise opcional."""
    if cortes:
        partes, anterior = [], inicio
        for de, ate in cortes:
            partes.append((anterior, de))
            anterior = ate
        partes.append((anterior, fim))
        trechos = "".join(
            f"[0:a]atrim=start={a}:end={b},asetpts=N/SR/TB[t{i}];"
            for i, (a, b) in enumerate(partes))
        junta = "".join(f"[t{i}]" for i in range(len(partes)))
        base = f"{trechos}{junta}concat=n={len(partes)}:v=0:a=1[j];[j]"
    else:
        base = f"[0:a]atrim=start={inicio}:end={fim},asetpts=N/SR/TB,"
    f = base + "highpass=f=85"
    if denoise:
        # nr=12 dB e conservador: tira o chiado sem deixar a voz com textura
        # metalica, que e o que acontece quando se exagera.
        f += ",afftdn=nr=12:nf=-28"
    return f + ",aformat=sample_rates=48000:channel_layouts=mono[out]"


def medir(caminho):
    """Mede LUFS/TP/LRA com loudnorm em modo analise (primeira passada)."""
    # O JSON do loudnorm sai em nivel `info`; com `-loglevel error` ele some.
    saida = ff(["-i", str(caminho), "-af",
                f"loudnorm=I={ALVO_LUFS}:TP=-1.5:LRA=11:print_format=json",
                "-f", "null", "-"], captura=False)
    bruto = saida[saida.rindex("{"):saida.rindex("}") + 1]
    return json.loads(bruto)


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    print(f"{'BLOCO':26s} {'DUR':>7s} {'ANTES':>9s} {'DEPOIS':>9s} {'PICO':>8s}")
    print("-" * 66)
    total = 0.0
    resumo = {}
    for nome, rel, ini, fim, dn, cortes in BLOCOS:
        src = PITCH / rel
        bruto = DEST / f"_{nome}.wav"
        final = DEST / f"{nome}.wav"
        ff(["-i", str(src), "-filter_complex", cadeia(dn, cortes, ini, fim),
            "-map", "[out]", "-c:a", "pcm_s16le", str(bruto)])
        m = medir(bruto)
        # segunda passada: linear, para nao bombear a dinamica da fala
        ff(["-i", str(bruto), "-af",
            f"loudnorm=I={ALVO_LUFS}:TP=-1.5:LRA=11:"
            f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
            f"offset={m['target_offset']}:linear=true:print_format=summary",
            "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(final)])
        depois = medir(final)
        bruto.unlink()
        dur = float(subprocess.run(
            ["C:/ProgramData/chocolatey/bin/ffprobe.exe", "-v", "error",
             "-show_entries", "format=duration", "-of",
             "default=nw=1:nk=1", str(final)],
            capture_output=True, text=True).stdout.strip())
        total += dur
        resumo[nome] = round(dur, 3)
        print(f"{nome:26s} {dur:6.2f}s {float(m['input_i']):8.1f} "
              f"{float(depois['input_i']):8.1f} {float(depois['input_tp']):7.1f}")
    (DEST / "duracoes.json").write_text(
        json.dumps(resumo, indent=1), encoding="utf-8")
    print("-" * 66)
    print(f"{'TOTAL de narracao':26s} {total:6.2f}s = {int(total // 60)}:"
          f"{total % 60:05.2f}")


if __name__ == "__main__":
    main()
