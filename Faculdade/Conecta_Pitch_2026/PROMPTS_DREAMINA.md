# Prompts para o Dreamina (Seedance) — abertura do pitch, 35 s

Gera o **bloco 1** do [`ROTEIRO_VIDEO_PITCH.md`](ROTEIRO_VIDEO_PITCH.md): os 35
segundos de pé na porta, sobre os quais o **Tiago narra ao vivo**.

Conceito escolhido: **1 — "o corpo todo medido, menos um lugar"**, fechando com o
**3 — "ondas que são a cidade"**. Trocar de conceito significa reescrever os
JSONs; é meia hora, me avise.

---

## O que mudou desde a primeira recomendação

Eu tinha dito "5 a 7 clipes de 5–10 s". **Estava desatualizado para o Dreamina:**
o Seedance 2.5 gera até **30 s nativos**, em 4K, com múltiplos planos na mesma
geração e consistência de personagem — e ainda gera trilha e efeito sonoro pelo
próprio prompt.

Então o plano mudou: **duas gerações longas em vez de seis curtas.** Menos
emenda, continuidade melhor, menos crédito queimado.

| | Plano A (recomendado) | Plano B (reserva) |
|---|---|---|
| Gerações | 2 (18 s + 17 s) | 6 clipes curtos |
| Vantagem | Continuidade real; a pessoa é a mesma | Refaz um plano ruim sem refazer o resto |
| Quando usar | Primeira tentativa | Se a consistência de personagem falhar |

Os JSONs do Plano A estão abaixo. Os do Plano B saem na hora, se precisar.

## Três coisas que você precisa saber antes de gastar crédito

1. **O JSON é convenção de prompt, não esquema oficial da interface.** O corpo
   JSON documentado (`prompt`, `model`, `ratio`, `duration`) é da **API**. Na
   interface você cola o JSON inteiro no campo de prompt — esses modelos leem
   prompt estruturado muito bem, e é por isso que os vídeos bons que você viu
   usam isso. Não é garantia de que todo campo será obedecido ao pé da letra.
2. **Valores em inglês de propósito.** O modelo adere bem mais. A descrição em
   português é aqui no documento, para você conferir o que está pedindo.
3. **O áudio precisa ser silenciado no prompt.** O Seedance 2.5 gera fala sozinho
   se você deixar. Quem narra é o Tiago — por isso todo JSON tem
   `"dialogue": "none"` e `"voiceover": "none"`. **Confira isso antes de gerar.**

---

## Geração 1 — "o corpo medido" (18 s, cobre 0:00–0:18)

Cobre: *"Você mede seus passos. Mede seus batimentos. Seu sono. Alguns de vocês
medem a glicose."*

```json
{
  "title": "Quantified Body - Part 1",
  "duration_seconds": 18,
  "aspect_ratio": "16:9",
  "resolution": "4K",
  "style": {
    "look": "cinematic sci-fi realism, premium tech commercial",
    "reference_mood": "high-end wearable brand film, dark and elegant",
    "film_grain": "very subtle",
    "render": "photoreal, shallow depth of field"
  },
  "subject": {
    "description": "a single adult person, 30s, neutral athletic clothing, face kept partially out of frame or in soft shadow, never fully identifiable",
    "consistency": "same person, same clothing, same lighting character across every shot"
  },
  "environment": "a minimalist dark interior that shifts subtly between a bedroom, a street at dawn and a desk, all sharing the same deep navy darkness",
  "shots": [
    {
      "shot": 1,
      "seconds": "0-6",
      "action": "person walking, seen from the knees down in profile. With each footfall, luminous cyan data lines bloom from the foot and rise into the air, organizing themselves into a floating step-count graph that drifts behind them",
      "camera": "slow lateral tracking shot, 50mm, moving at walking pace",
      "focus": "feet sharp, background falling off"
    },
    {
      "shot": 2,
      "seconds": "6-12",
      "action": "closer on the chest. A soft pulse of light expands from the heart in rhythm, each pulse leaving a glowing waveform that curls outward and hangs in the air. Then the scene dissolves to the same person lying asleep, a slow breathing wave of light wrapping around the torso",
      "camera": "slow push in, then a gentle dissolve, 85mm",
      "focus": "chest and the light, face never in focus"
    },
    {
      "shot": 3,
      "seconds": "12-18",
      "action": "close on a forearm. A small cluster of luminous particles reads the skin and resolves into a clean floating curve of data. Everything in frame is measured, glowing, working. The camera begins a slow rise toward the head",
      "camera": "macro to medium, beginning a slow crane upward",
      "focus": "arm sharp, the rise starts to reveal the shoulders"
    }
  ],
  "lighting": "single cool key light, deep shadows, light sources are the data glows themselves",
  "color_palette": {
    "background": "#0B1220 deep navy black",
    "primary_glow": "#4FD1C5 cyan teal",
    "secondary_glow": "#2A5BC7 electric blue",
    "accent": "#7AA2F7 pale blue",
    "rule": "no warm colors anywhere, no orange, no red, no green"
  },
  "audio": {
    "dialogue": "none",
    "voiceover": "none",
    "music": "sparse ambient electronic pad, very low, building slowly, no percussion, no melody",
    "sfx": "soft low-frequency pulses synced to the light blooms, very subtle"
  },
  "negative_prompt": "no text, no letters, no numbers, no captions, no watermarks, no user interface, no logos, no hospital, no clinic, no medical equipment, no lab coat, no stethoscope, no doctor, no wires attached to the head, no electrode cap, no recognizable celebrity, no direct eye contact with camera, no warm lighting, no daylight, no crowd, no fast cuts"
}
```

---

## Geração 2 — "o vazio e as ondas" (17 s, cobre 0:18–0:35)

Cobre: *"Quando foi a última vez que você mediu o seu cérebro?"* + silêncio +
*"Nunca. Porque não dava."* + *"O órgão que define como você vive o seu dia…"*

**Este é o trecho que decide o vídeo.** Se tiver de refazer alguma geração várias
vezes, é esta.

```json
{
  "title": "Quantified Body - Part 2, The Void and the Waves",
  "duration_seconds": 17,
  "aspect_ratio": "16:9",
  "resolution": "4K",
  "style": {
    "look": "cinematic sci-fi realism, premium tech commercial",
    "continuity_note": "identical person, wardrobe, lighting and palette as Part 1",
    "render": "photoreal, shallow depth of field"
  },
  "subject": {
    "description": "the same adult person from Part 1, seen from behind and in three-quarter profile, face never fully revealed",
    "consistency": "must match Part 1 exactly"
  },
  "shots": [
    {
      "shot": 1,
      "seconds": "0-7",
      "action": "the camera completes its rise from the shoulders to the head. Every part of the body below is still alive with cyan data light, but around and above the head there is absolutely nothing — a pure black absence, conspicuous and silent. The camera holds on that emptiness. At the end of the shot the void pulses once, faintly, as if answering",
      "camera": "slow crane up, then a complete stop. Absolutely static for the last 2 seconds",
      "focus": "the empty dark space around the head",
      "emphasis": "this is the key frame of the entire film: the contrast between a fully measured body and a completely unmeasured head"
    },
    {
      "shot": 2,
      "seconds": "7-11",
      "action": "from the center of that void a single thin cyan line is born and travels horizontally across the dark frame, like the first trace of an instrument finally switched on",
      "camera": "static, wide",
      "focus": "the line"
    },
    {
      "shot": 3,
      "seconds": "11-17",
      "action": "the single line multiplies into a dense field of flowing horizontal waveforms filling the frame. The camera pulls back and the peaks of the waves resolve into the silhouette of a city skyline at night, then keeps pulling back until the whole city is revealed to be one continuous glowing wave, drifting in black space",
      "camera": "continuous smooth dolly back, accelerating slightly, no cuts",
      "focus": "deep focus, the whole field"
    }
  ],
  "lighting": "the waveforms are the only light source, cool cyan on black",
  "color_palette": {
    "background": "#0B1220 deep navy black",
    "primary_glow": "#4FD1C5 cyan teal",
    "secondary_glow": "#2A5BC7 electric blue",
    "rule": "no warm colors anywhere, pure cool palette"
  },
  "audio": {
    "dialogue": "none",
    "voiceover": "none",
    "music": "the ambient pad from Part 1 continuing, dropping to near silence during the void shot, then swelling as the waves appear",
    "sfx": "complete silence during the void, then a single soft rising tone as the first line is drawn"
  },
  "negative_prompt": "no text, no letters, no numbers, no captions, no watermarks, no user interface, no logos, no brain illustration, no anatomical brain, no x-ray, no MRI, no skull, no hospital, no clinic, no medical equipment, no lab coat, no electrode cap, no wires on the head, no recognizable celebrity, no warm lighting, no daylight, no fast cuts, no camera shake"
}
```

---

## Como rodar, na ordem

1. **Gere a Parte 1 primeiro.** Quando sair uma que preste, **salve um frame** com
   a pessoa bem enquadrada.
2. **Use esse frame como referência** (Omni Reference / imagem de referência) ao
   gerar a Parte 2. É isso que mantém a mesma pessoa. Sem isso, a Parte 2 vem com
   outra pessoa e a emenda não cola.
3. **Confira no resultado, antes de aprovar:** nenhum texto na imagem (modelos de
   vídeo escrevem garatuja), nenhuma fala gerada, nada que pareça hospital ou
   equipamento médico, e o rosto não identificável.
4. **Orçamento:** conte 3 a 5 tentativas por geração. Se a Parte 1 sair boa na
   segunda e a Parte 2 na quarta, você gastou 6 gerações no total.

## Se a consistência falhar (Plano B)

Se a pessoa mudar entre as partes e a imagem de referência não resolver, abandone
o personagem: refaça as duas partes **sem figura humana**, só com as formas de
luz e as ondas sobre preto, e um único plano com a silhueta de uma cabeça em
contraluz no momento do vazio. Fica mais abstrato, perde um pouco de empatia, mas
**não tem como quebrar a continuidade** — e isso vale mais do que o capricho,
porque continuidade quebrada o júri enxerga na hora. Me avise e eu escrevo
esses JSONs.
