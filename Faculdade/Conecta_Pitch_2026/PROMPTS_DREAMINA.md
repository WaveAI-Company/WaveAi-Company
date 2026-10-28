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

Saldo na conta: **8.554 créditos** (conferido em 27/10). Slider de duração vai
**até 30 s**. No plano Básico, **R$ 1 = 185 créditos** — e como o Seedance 2.5
cheio em 720p custa 185 créditos por segundo, **1 segundo de vídeo final custa
R$ 1,00**.

### O plano de gasto

| Passo | Config | Custo |
|---|---|---|
| 1. Rascunho de risco | Draft 480p, **5 s**, prompt do §3 | 340 |
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

Rode o rascunho com o **prompt do §3 (o vazio)** — é o plano mais difícil e o
mais importante do filme. Se ele passar, o resto passa.

---

## 2. Por que não é JSON

A primeira versão deste documento trazia os prompts em JSON. **Estava errado**, e
a orientação da própria plataforma diz por quê: para o Seedance ela recomenda
**texto descritivo de 30 a 100 palavras**, começando pelo sujeito, descrevendo só
o que muda a cena e usando *negative prompt* **com moderação**. Em nenhum lugar
ela sugere JSON.

Dois problemas, e o segundo é o pior:

1. **JSON não é esquema, é texto.** O corpo documentado (`prompt`, `model`,
   `ratio`, `duration`) é da **API**. No campo da interface, as chaves, aspas e
   vírgulas entram como tokens que não significam nada visualmente — ruído que
   compete com a descrição.
2. **Os JSONs tinham ~450 palavras cada: quatro a cinco vezes o recomendado.**
   Prompt longo demais dilui a atenção do modelo, e a lista gigante de
   `negative_prompt` era o oposto de "com moderação".

Os prompts abaixo são **prosa descritiva**, e estes são os tamanhos contados:
**100 palavras** o do rascunho (dentro da faixa recomendada), **172** a Parte A
e **227** a Parte B. Os dois finais ficam acima das 100 porque encadeiam três
ou quatro planos num clipe só, e a Parte B ainda carrega a frase que limita a
imagem de referência — mas contra ~450 de antes. **Os três foram usados nesta
forma e funcionaram** (27/10/2026), então o tamanho não atrapalhou. Se um dia a
aderência piorar, o caminho é **cortar um plano**, não encurtar as frases.
Estão **em inglês de propósito**: o modelo adere bem mais.

**A interface manda na duração, proporção e resolução.** Não repita nada disso
no texto.

---

## 3. Rascunho de risco — só o vazio (5 s, Draft 480p, 340 créditos)

Este é o primeiro a rodar. **Não julgue beleza nele** — 480p é feio de
propósito. Julgue só as cinco perguntas do §1.

```text
An adult seen from behind in a near-black room, face not visible, shoulders
and neck glowing with drifting cyan light traces. The traces stop at the base
of the skull: above the head there is nothing at all, pure empty black,
unlit, while the body below still glows. Locked-off static shot, held
completely still. Near the end the emptiness pulses once, very faintly, then
goes dark. Cinematic photoreal, shallow depth of field, crushed blacks, cyan
only.

Negative: no text, letters or numbers. No voice or speech. No visible face.
No brain, skull, scan, headset or medical imagery. No warm light.
```

---

## 4. Parte A — "o corpo medido" (12 s)

Cobre a narração: *"Você mede seus passos. Mede seus batimentos. Seu sono.
Alguns de vocês medem a glicose."*

```text
A single adult in plain dark grey sportswear moves through a near-black room,
face always cropped out of frame or hidden in shadow. Cyan light is emitted by
the body itself and trails behind like long-exposure light painting, curling
and dissolving in the air. It forms smooth organic ribbons only. First, a low
lateral tracking shot of the legs: each footfall throws a glowing ribbon
upward that hangs in the dark. Then a slow push to the chest, where rings of
light pulse outward in a heartbeat rhythm, cross-dissolving into the same
person asleep, a slow luminous wave travelling along the torso. Finally a
macro on the forearm, particles resolving into one clean glowing curve, as the
camera cranes slowly up toward the head and stops just below the jaw.
Cinematic photoreal, 35mm, smooth dolly moves, shallow depth of field, crushed
blacks, cyan and electric blue only.

Negative: no text, letters, numbers, charts or user interface. No voice or
speech. No visible face. No hospital, clinic or medical equipment. No warm
light.
```

**Por que "ribbons" e não "graph":** a versão anterior pedia *a floating
step-count graph*. Gráfico com contagem convida o modelo a escrever números, e
número gerado por IA sai rabiscado — o prompt pedia justamente o artefato que o
negativo proíbe.

---

## 5. Parte B — "o vazio e as ondas" (12 s)

Cobre: *"Quando foi a última vez que você mediu o seu cérebro?"* + o silêncio +
*"Nunca. Porque não dava."*

**É a geração que decide o vídeo**, e é ela que o rascunho de 5 s deve testar.

**Exige a imagem de referência carregada** (ver §6). A primeira frase existe
para limitar o que a referência controla.

```text
Use the reference image only for the person's identity, clothing and skin tone
under cyan light — not for the camera angle or framing. The same adult, seen
from behind, face never visible. The camera finishes a slow crane up and locks
off completely: the shoulders and neck still glow with drifting cyan traces,
but the traces stop at the base of the skull, and above the head there is
nothing at all — pure empty black, unlit, while the body below still glows.
Hold perfectly still for a long beat. Then the camera arcs smoothly around to
a profile silhouette, features lost in deep shadow, and a single small point
of cyan light ignites on the forehead. From that one point a wave is born,
travelling forward into the dark and leaving a glowing ribbon behind it. The
ribbon multiplies into dozens of flowing waveforms filling the screen; the
camera pulls back in one unbroken move and their peaks resolve into a night
city skyline made of light, then keeps pulling back until the whole city is
one continuous glowing wave in black space. End wide, centred and steady.
Cinematic photoreal, cyan and electric blue only.

Negative: no text, signage, letters or numbers. No voice or speech. No visible
face, no face turned toward camera. No brain, skull, scan, headset or medical
imagery. No warm light.
```

### As três coisas desta versão que não eram óbvias

**1. O ponto na testa, e não um cérebro.** A ideia de pôr um cérebro com ondas
entre o vazio e a cidade foi levantada e **descartada por três motivos**. O
principal: o WaveAI é **canal único em FP1**, um ponto na testa — um cérebro
inteiro brilhando mostra atividade global, que é justamente o que o produto
**não** mede, e a ADR-0027 (honestidade visual) não deixa a imagem afirmar o que
não é verdade. Os outros dois: o cérebro **preenche o vazio**, que é a tese do
filme inteiro; e cérebro anatômico é modo de falha conhecido desses modelos.
O ponto único na testa dá a mesma virada dramática, é verdade sobre o produto e
mantém a linguagem de luz abstrata. Por isso `no brain` e `no headset` seguem no
negativo — lendo *cabeça* + *medir*, a tentação do modelo é desenhar exatamente
isso, e ainda leria como equipamento médico, que o
[`Medical/71`](../../Medical/71_Intended_Use_and_Regulatory_Positioning.md) não
permite.

**2. A primeira frase limita a referência.** O frame útil da Parte A é
**frontal** (peito, pescoço, queixo), e esta cena abre **de costas**. Sem a
frase de escopo, a referência arrasta o ângulo junto com a pessoa: o modelo vira
o sujeito para a câmera, o que mata o plano do vazio — que depende de ver a nuca
com o preto em cima — e ainda expõe o rosto. Daí também o
`no face turned toward camera` no negativo.

**3. Sumiu "in the same dark grey sportswear and near-black room".** A
referência faz esse trabalho melhor do que a palavra, e a descrição estava em
conflito com ela: o prompt dizia *cinza-escuro* e no frame a roupa aparece
**azul-petróleo**, por causa da luz ciano. Descrever uma cor contra uma imagem
que mostra outra só confunde o modelo.

---

## 6. A ordem de execução

1. **Rascunho: Draft, 480p, 5 s, 340 créditos.** Cole o prompt do **§3**.
   Julgue as cinco perguntas de risco do §1 — e **só elas**.
2. **Se passar:** Parte A (**§4**) no 2.5 cheio, 720p, 12 s (2.220).
3. **Salve um frame do último segundo da Parte A** — torso e pescoço, não as
   pernas: é nesse enquadramento que a Parte B abre. Se o menu `...` do
   resultado oferecer "estender" ou salvar o último quadro, use; senão baixe o
   MP4 e pegue o frame inteiro em 16:9, sem recortar, e sem print de player
   reduzido.
4. **Parte B** (**§5**) no 2.5 cheio, 720p, 12 s (2.220), com esse frame em
   **"Referência universal"**. Confira que a caixinha virou miniatura e não
   `+`, e **releia o custo** depois de subir a imagem.

> **Estar na mesma sessão NÃO carrega o personagem.** Cada geração é
> independente: o modelo recebe só o texto, e `"the same adult"` não tem
> referente para ele — sai *um* adulto qualquer. **A única coisa que mantém a
> mesma pessoa é a "Referência universal".** Foi essa a dúvida que quase custou
> uma geração de 2.220.
>
> Calibragem, para não gastar ansiedade à toa: como o rosto **nunca** aparece em
> nenhuma das duas partes, o que precisa casar é só roupa, tom de pele e o jeito
> das fitas de luz. Não é "reconhecer a mesma pessoa", é "não estranhar".
5. **Confira cada resultado** antes de aprovar: sem fala, sem texto na imagem,
   sem nada com cara de equipamento médico, rosto não identificável, paleta fria.

**Resolução:** 720p é suficiente. O resto do vídeo é captura de tela em 1080p, e
subir 720 → 1080 num plano escuro e difuso não aparece. Se quiser tentar, existe
**"Amplificação criativa"** na interface — confira o custo dela antes, porque
gerar direto em resolução maior sai mais caro por segundo.

## 7. Se a consistência falhar

> **Não foi necessário em 27/10/2026** — as duas partes saíram consistentes com
> a referência carregada. Fica registrado caso alguém precise regerar.

Se a pessoa mudar entre as partes e a "Referência universal" não resolver,
abandone o personagem: refaça as duas partes **sem figura humana** — só as
ribbons de luz sobre preto, e no lugar do vazio um plano com a silhueta de uma
cabeça em contraluz. Perde empatia, mas **não tem como quebrar a continuidade**,
e continuidade quebrada o júri enxerga na hora. Me avise e eu escrevo.
