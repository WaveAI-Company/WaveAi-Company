# Atividade — Rede do projeto, falhas e requisitos

**Disciplina:** Sistemas Distribuídos Aplicado à Internet das Coisas · **Professor:** Rodrigo dos Santos Faustino
**Curso:** Análise e Desenvolvimento de Sistemas — AMS · 2º ano, noite
**Grupo:** Tiago Bryan Ramos de Oliveira · Gustavo Mendes Vetieri Mariano · Nickolas Maia de Araujo

Entrega acadêmica **sobre** o WaveAI, separada do produto: nada desta pasta entra em
imagem, no app ou no site (`Faculdade/**` está no `paths-ignore` do `deploy.yml`).
O Anexo VII do edital da SPTrans foi usado só como modelo de estudo.

| Arquivo | O que é |
|---|---|
| `documento/Rede_WaveAI_Falhas_e_Requisitos.docx` | Documento escrito (importar no Google Docs) |
| `diagrama/rede_waveai.drawio` | Fonte do diagrama, editável no draw.io |
| `diagrama/rede_waveai.png` | Exportação do draw.io usada no documento |
| `apresentacao/Rede_WaveAI_Apresentacao.pptx` | Slides de 10 minutos (abre no Google Slides) |
| `apresentacao/Roteiro_e_Arguicao.docx` | Roteiro de fala por integrante e perguntas prováveis |
| `fonte/` | Geradores dos `.docx`/`.pptx` e os roteiros de medição |

## Regerar

Os `.docx` e o `.pptx` saem de scripts Node (`docx` e `pptxgenjs`), que **não** são
dependências do repositório. Numa pasta temporária:

```bash
npm init -y && npm install docx pptxgenjs
NODE_PATH=<pasta-temporária>/node_modules node Faculdade/SDIoT_Atividade_Redes/fonte/gerar_documento.js
NODE_PATH=<pasta-temporária>/node_modules node Faculdade/SDIoT_Atividade_Redes/fonte/gerar_apresentacao.js
NODE_PATH=<pasta-temporária>/node_modules node Faculdade/SDIoT_Atividade_Redes/fonte/gerar_roteiro.js
```

Os números medidos que o documento cita ficam em `fonte/medidas.json`.

O PNG do diagrama sai do próprio draw.io:

```bash
draw.io -x -f png -s 2 -b 20 -o diagrama/rede_waveai.png diagrama/rede_waveai.drawio
```

## De onde vêm os números

Cada valor do documento é **medido**, **configurado no código**, **do fabricante** ou
**meta**, e o texto diz qual. As medições de falha foram feitas no stack local
(`docker compose`), com sinal **100% sintético** (device `medicao-sintetica`), pelos
roteiros em `fonte/medicao/`.
