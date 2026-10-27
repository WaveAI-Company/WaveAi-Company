# Prompts para o Dreamina (Seedance) — abertura do pitch

Gera o **bloco 1** do [`ROTEIRO_VIDEO_PITCH.md`](ROTEIRO_VIDEO_PITCH.md): a
abertura sobre a qual o **Tiago narra ao vivo** (35 s de narração).

Conceito: **1 — "o corpo todo medido, menos um lugar"**, fechando com o
**3 — "ondas que são a cidade"**.

---

## 1. Custo medido na conta do fundador (27/10/2026)

Medido na interface, não estimado. **Escala linear por segundo nos dois modelos.**

| Modelo | Resolução | 5 s | 18 s | Por segundo |
|---|---|---|---|---|
| Seedance 2.5 **Draft** | 480p | 340 | 1.224 | **68** |
| Seedance 2.5 **cheio** | 720p | 925 | 3.330 | **185** |

Saldo na conta: **8.600 créditos**. Slider de duração vai **até 30 s**.

### O plano de gasto

| Passo | Config | Custo |
|---|---|---|
| 1. Draft de risco | Draft 480p, **5 s**, só a Cena B | 340 |
| 2. Parte A final | 2.5 cheio 720p, **12 s** | 2.220 |
| 3. Parte B final | 2.5 cheio 720p, **12 s** | 2.220 |
| | **Total** | **4.780** |
| | **Sobra para refazer uma parte inteira** | **3.820** |

**Por que 12 s e não 18 s:** duas partes de 18 s custam 6.475 e deixam 2.125 —
que não pagam a refação de nenhuma das duas. Com 12 s sobra crédito para errar
uma vez, que num prazo de três dias vale mais do que seis segundos de imagem.

Os 24 s de IA cobrem a narração até *"Nunca. Porque não dava."*. Os ~11 s
restantes rodam sobre um **zoom lento no último frame** da onda-cidade, feito no
editor, de graça.

### O draft de 5 s não é teste de beleza, é teste de risco

Por 340 créditos (4% do saldo) ele responde as cinco coisas que destroem uma
geração de 2.220, e todas as cinco são visíveis em 480p:

1. Gerou fala por cima? (maior risco, e é binário)
2. Escreveu texto ou rabisco na tela?
3. A paleta ficou fria, ou virou quente?
4. Leu como ambiente médico?
5. Obedeceu à ideia das linhas de luz saindo do corpo?

Rode o draft **com o JSON da Parte B, Cena B2 (o vazio)** — é o plano mais
difícil e o mais importante. Se ele passar, o resto passa.

---

## 2. Antes de colar: três coisas

1. **Apague do JSON as linhas de duração, proporção e resolução.** A interface
   manda nelas, e repeti-las no texto só confunde o modelo. Os JSONs abaixo
   **já estão sem elas**.
2. **O JSON é convenção de prompt, não esquema oficial da interface.** O corpo
   documentado (`prompt`, `model`, `ratio`, `duration`) é da **API**; na
   interface você cola o JSON inteiro no campo de texto. Funciona bem, mas
   nenhum campo é garantido.
3. **Valores em inglês de propósito** — o modelo adere muito mais. A explicação
   em português fica aqui.

---

## 3. Parte A — "o corpo medido" (12 s)

Cobre a narração: *"Você mede seus passos. Mede seus batimentos. Seu sono.
Alguns de vocês medem a glicose."*

```json
{
  "title": "Quantified Body - Part A",
  "style": {
    "look": "cinematic sci-fi realism, premium wearable-technology brand film",
    "reference": "the visual language of a high-end running-shoe or smartwatch commercial shot at night",
    "render": "photoreal, anamorphic shallow depth of field, very subtle film grain, no stylization, no illustration, no cartoon"
  },
  "global_subject": {
    "who": "one adult person in their 30s, athletic build, plain dark grey sportswear, no logos, no jewellery",
    "face_rule": "the face is never shown clearly: keep it cropped out of frame, turned away, or in deep shadow at all times",
    "consistency": "identical person, identical clothing, identical skin tone and identical lighting character in every scene"
  },
  "global_environment": "a single continuous minimalist interior in near-darkness; the walls are barely visible; the only bright things in frame are the glowing light traces",
  "light_phenomenon": {
    "what_it_is": "volumetric cyan light that is emitted by the body itself, behaving like long-exposure light painting: it trails behind movement, curls slowly in the air like smoke, and dissipates after about two seconds",
    "must_be_abstract": "the light forms smooth organic curves and waveform ribbons ONLY — never numbers, never letters, never charts with labels, never user-interface panels, never holographic screens"
  },
  "scenes": [
    {
      "id": "A1",
      "time": "0.0 - 4.0",
      "framing": "low-angle medium shot of the legs from the knees down, person walking slowly from frame left to frame right",
      "action": "at each footfall a burst of cyan light is born at the sole and stretches upward into a long trailing ribbon that floats and slowly dissolves behind the leg; by the end of the scene four or five ribbons hang in the dark air",
      "camera": "35mm lens, lateral dolly tracking at exactly walking pace, perfectly smooth, no handheld shake",
      "depth_of_field": "feet razor sharp, the hanging ribbons softly out of focus in the background"
    },
    {
      "id": "A2",
      "time": "4.0 - 8.0",
      "framing": "tight chest-level shot from the side, shoulders to waist, person now standing still",
      "action": "a ring of cyan light pulses outward from the centre of the chest in a steady heartbeat rhythm, roughly one pulse per second; each ring expands, thins and fades; midway through the scene the image cross-dissolves to the same person lying asleep on their side, where a single slow luminous wave travels up and down the torso in time with breathing",
      "camera": "85mm lens, very slow push in, then a soft 0.5 second cross-dissolve into the sleeping shot",
      "depth_of_field": "chest sharp, head out of focus and out of frame"
    },
    {
      "id": "A3",
      "time": "8.0 - 12.0",
      "framing": "macro on the inside of a forearm, then widening to a medium shot of the shoulders",
      "action": "a dense swarm of tiny cyan particles settles on the skin, reads it, and reorganises into one clean glowing curve that lifts off the arm and hovers; then the camera begins to climb from the shoulders toward the neck, and the frame ends just below the jaw",
      "camera": "macro to 50mm, beginning a slow steady crane upward in the final 1.5 seconds",
      "note": "the climb must feel like the start of a movement that is not finished"
    }
  ],
  "lighting": "one cool key light from the side at very low intensity; everything else is lit only by the cyan traces themselves; deep crushed blacks",
  "color": {
    "background": "#0B1220 near-black navy",
    "light_primary": "#4FD1C5 cyan teal",
    "light_secondary": "#2A5BC7 electric blue",
    "forbidden": "absolutely no warm tones: no orange, no amber, no yellow, no red, no green, no skin-warm highlights"
  },
  "audio": {
    "speech": "none",
    "dialogue": "none",
    "voiceover": "none",
    "narration": "none",
    "music": "one sustained low ambient synth pad, very quiet, slowly rising, no drums, no percussion, no melody",
    "sfx": "a soft deep sub-bass thud under each light burst, barely audible"
  },
  "negative_prompt": "no spoken words, no voice, no singing, no text, no letters, no numbers, no digits, no captions, no subtitles, no watermark, no logo, no user interface, no HUD, no dashboard, no holographic screen, no chart with labels, no hospital, no clinic, no medical device, no lab coat, no stethoscope, no doctor, no nurse, no electrode cap, no wires attached to the body, no clear visible face, no eye contact with camera, no celebrity likeness, no warm light, no daylight, no sunset, no other people, no crowd, no camera shake, no rapid cuts, no zoom punch, no lens flare spam"
}
```

---

## 4. Parte B — "o vazio e as ondas" (12 s)

Cobre: *"Quando foi a última vez que você mediu o seu cérebro?"* + o silêncio +
*"Nunca. Porque não dava."*

**É a geração que decide o vídeo.** A Cena B2 é o único plano que o público vai
lembrar — e é ela que o draft de 5 s deve testar primeiro.

```json
{
  "title": "Quantified Body - Part B - The Void and the Waves",
  "continuity": "direct continuation of 'Quantified Body - Part A': identical person, identical dark grey sportswear, identical cyan light language, identical near-black navy environment. This clip starts exactly where the previous camera movement stopped, just below the jaw.",
  "style": {
    "look": "cinematic sci-fi realism, premium wearable-technology brand film",
    "render": "photoreal, anamorphic shallow depth of field, very subtle film grain"
  },
  "scenes": [
    {
      "id": "B1",
      "time": "0.0 - 3.0",
      "framing": "three-quarter rear view, the camera finishes climbing from the shoulders and settles with the head centred in the upper third of frame",
      "action": "the shoulders, neck and upper back are still alive with slow cyan light traces, exactly like the earlier scenes; the traces rise up the spine and then simply stop at the base of the skull",
      "camera": "50mm, the last 1.5 seconds of a slow crane up, decelerating to a complete stop"
    },
    {
      "id": "B2",
      "time": "3.0 - 7.0",
      "framing": "locked-off medium shot, head and shoulders, head slightly below centre so the empty space above dominates the frame",
      "action": "around and above the head there is nothing at all: pure black, completely empty, conspicuously unlit while the body below still glows. Absolutely nothing moves in this scene except the faint drift of the traces on the shoulders. In the final half second the empty space pulses once, very faintly, a single dim cyan breath, and goes dark again",
      "camera": "completely static, locked off, zero movement",
      "emphasis": "this is the single most important shot of the film. The entire idea is the contrast between a body that is fully measured and a head that is not measured at all. Hold it. Do not cut away. Do not add anything to the empty space."
    },
    {
      "id": "B3",
      "time": "7.0 - 9.0",
      "framing": "the frame goes fully black and then one single thin horizontal cyan line is drawn across it, left to right",
      "action": "the line is drawn at a steady speed, like the first trace of an instrument that has finally been switched on; it leaves a faint glow behind it",
      "camera": "static, wide"
    },
    {
      "id": "B4",
      "time": "9.0 - 12.0",
      "framing": "wide, then very wide",
      "action": "the single line multiplies into dozens of flowing horizontal waveform ribbons that fill the frame; the camera pulls back and the peaks of those waveforms resolve into the silhouette of a night-time city skyline made of light; the camera keeps pulling back until the entire city is revealed to be one single continuous glowing waveform floating in black space",
      "camera": "continuous smooth dolly back, slightly accelerating, one unbroken move with no cuts",
      "final_frame": "end on the wide shot of the glowing waveform-city, centred, with plenty of black space around it, held steady and clean so it can be extended with a slow zoom in editing"
    }
  ],
  "lighting": "the cyan traces and the waveforms are the only light sources in the entire clip",
  "color": {
    "background": "#0B1220 near-black navy",
    "light_primary": "#4FD1C5 cyan teal",
    "light_secondary": "#2A5BC7 electric blue",
    "forbidden": "no warm tones of any kind"
  },
  "audio": {
    "speech": "none",
    "dialogue": "none",
    "voiceover": "none",
    "narration": "none",
    "music": "the ambient pad continues from Part A, dropping to near total silence during the empty-space shot, then swelling as the waveforms appear",
    "sfx": "complete silence while the space above the head is empty, then one soft rising tone as the first line is drawn"
  },
  "negative_prompt": "no spoken words, no voice, no text, no letters, no numbers, no captions, no watermark, no logo, no user interface, no HUD, no anatomical brain, no brain illustration, no glowing brain, no skull, no x-ray, no MRI, no scan imagery, no hospital, no clinic, no medical device, no electrode cap, no wires on the head, no helmet, no headset, no clear visible face, no eye contact with camera, no celebrity likeness, no warm light, no daylight, no other people, no camera shake, no cuts during the dolly back, no text on the buildings, no readable signage in the city"
}
```

**Por que `no glowing brain` e `no headset` estão no negative:** a tentação do
modelo, ao ler "cabeça" e "medir", é desenhar um cérebro brilhando ou um aparelho
na cabeça. As duas coisas destroem o plano — **o ponto é a ausência**, e um
aparelho na cabeça ainda por cima leria como equipamento médico, que o
[`Medical/71`](../../Medical/71_Intended_Use_and_Regulatory_Positioning.md) não
deixa.

---

## 5. A ordem de execução

1. **Draft, 480p, 5 s, 340 créditos.** Cole o JSON da Parte B mas deixe **só a
   cena B2** na lista `scenes` (apague B1, B3 e B4) e ajuste o `time` para
   `"0.0 - 5.0"`. Julgue as cinco perguntas de risco do §1 — e **só elas**.
2. **Se passar:** Parte A no 2.5 cheio, 720p, 12 s (2.220).
3. **Salve um frame** do último segundo da Parte A, com a nuca/ombros bem
   enquadrados.
4. **Parte B** no 2.5 cheio, 720p, 12 s (2.220), com esse frame carregado em
   **"Referência universal"**. É isso que mantém a mesma pessoa; sem isso a
   Parte B vem com outra e a emenda não cola.
5. **Confira cada resultado** antes de aprovar: sem fala, sem texto na imagem,
   sem nada com cara de equipamento médico, rosto não identificável, paleta fria.

**Resolução:** 720p é suficiente. O resto do vídeo é captura de tela em 1080p, e
subir 720 → 1080 num plano escuro e difuso não aparece. Se quiser tentar, existe
**"Amplificação criativa"** na interface — confira o custo dela antes, porque
gerar direto em resolução maior sai mais caro por segundo.

## 6. Se a consistência falhar

Se a pessoa mudar entre as partes e a "Referência universal" não resolver,
abandone o personagem: refaça as duas partes **sem figura humana** — só as
ribbons de luz sobre preto, e no lugar do vazio um plano com a silhueta de uma
cabeça em contraluz. Perde empatia, mas **não tem como quebrar a continuidade**,
e continuidade quebrada o júri enxerga na hora. Me avise e eu escrevo.
