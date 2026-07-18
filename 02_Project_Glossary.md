# 02 · Glossário do Projeto — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Status | Vivo (atualizar continuamente) |
| Data | 2026-07-18 |

Glossário canônico. Sempre que um termo novo relevante surgir, registrá-lo aqui para garantir vocabulário compartilhado entre as disciplinas.

---

## A. EEG, Neurociência e Sinais

| Termo | Definição |
|---|---|
| **EEG (Eletroencefalografia)** | Registro da atividade elétrica cerebral captada por eletrodos. EEG clínico usa múltiplos canais; o NeuroSky usa **um único canal**. |
| **Sistema 10‑20** | Padrão internacional de posicionamento de eletrodos no EEG clínico (19+ canais). O NeuroSky **não** implementa montagem 10‑20. |
| **FP1** | Posição frontopolar esquerda. Local do eletrodo do NeuroSky (testa, acima do olho). Muito suscetível a artefatos oculares/musculares. |
| **Eletrodo seco** | Eletrodo sem gel condutor. Mais prático, porém com maior impedância e ruído que o eletrodo úmido clínico. |
| **Referência / Terra** | Eletrodos de comparação. No NeuroSky ficam no clipe de orelha. |
| **Bandas de frequência** | Delta (0,5–4 Hz), Teta (4–8 Hz), Alfa (8–13 Hz), Beta (13–30 Hz), Gama (>30 Hz). Associadas a estados fisiológicos distintos. |
| **PSD (Densidade Espectral de Potência)** | Distribuição da potência do sinal por frequência. Base para extrair potências de banda. |
| **eSense (Attention/Meditation)** | Métricas proprietárias do NeuroSky (0–100). **Caixa-preta, não validadas clinicamente.** Usar com cautela e nunca como base de *claim* clínica. |
| **Artefato** | Componente do sinal que não é de origem cerebral. Principais: **EOG** (olhos/piscadas), **EMG** (músculos), movimento, rede elétrica. |
| **EOG / EMG** | Atividade elétrica ocular / muscular que contamina o EEG, especialmente forte em FP1. |
| **SNR (Relação Sinal-Ruído)** | Quão forte é o sinal de interesse frente ao ruído. Crítico em canal único seco. |
| **Época/Janela** | Segmento temporal do sinal usado para análise (ex.: janelas de 1–4 s com sobreposição). |
| **Atividade epileptiforme** | Padrões associados a epilepsia. **[FATO]** sua detecção confiável exige EEG clínico multicanal — fora do alcance do canal único. |
| **Poor Signal Quality** | Indicador do NeuroSky (0–200; 0 = bom contato) da qualidade do acoplamento. |

## B. Regulatório, Clínico e Qualidade

| Termo | Definição |
|---|---|
| **SaMD** | *Software as a Medical Device* — software que é, por si só, um dispositivo médico. Enquadramento escolhido para o WaveAI. |
| **ANVISA** | Agência Nacional de Vigilância Sanitária (Brasil). |
| **RDC 657/2022** | Norma da ANVISA que regula a regularização de SaMD no Brasil (vigente desde 01/07/2022). |
| **RDC 751/2022** | Norma da ANVISA de **classificação de risco** (Classes I–IV) e regimes de notificação/registro (vigente desde 01/03/2023). |
| **Classe de risco (I–IV)** | I = menor risco, IV = máximo. Classes I/II → notificação; III/IV → registro. |
| **IMDRF** | Fórum internacional que definiu o framework de categorização de risco de SaMD (referência da ANVISA). |
| **CDS (Clinical Decision Support)** | Apoio à decisão clínica. O papel exato da IA no WaveAI. |
| **LGPD** | Lei Geral de Proteção de Dados (Brasil). Dados de saúde são **dados pessoais sensíveis** (art. 11). |
| **RIPD/DPIA** | Relatório de Impacto à Proteção de Dados. Provavelmente exigível dado o tratamento de dados sensíveis. |
| **ISO 14971** | Gestão de risco de dispositivos médicos. |
| **IEC 62304** | Ciclo de vida de software de dispositivo médico. |
| **IEC 62366** | Engenharia de usabilidade de dispositivos médicos. |
| **ISO 13485** | Sistema de gestão da qualidade (QMS) para dispositivos médicos. |
| **CFM / SBIS** | Conselho Federal de Medicina / Sociedade Brasileira de Informática em Saúde — relevantes para prontuário e telemedicina. |

## C. Engenharia, Dados e IA

| Termo | Definição |
|---|---|
| **Ingestão em streaming** | Recepção contínua do fluxo de dados do dispositivo em tempo quase real. |
| **Edge processing** | Processamento no dispositivo/cliente antes de enviar à nuvem. |
| **Série temporal** | Dado indexado no tempo (o EEG é uma série temporal de alta frequência). |
| **Feature (atributo)** | Variável derivada do sinal (ex.: potência de banda, razão teta/beta) usada por modelos. |
| **Pipeline** | Sequência de etapas de transformação do dado, da captação ao insight. |
| **MLOps** | Práticas de operação de ML: versionamento de dados/modelos, avaliação, deploy, monitoramento. |
| **Human-in-the-loop** | Arquitetura em que um humano (o médico) valida/decide sobre as saídas da IA. |
| **XAI (IA explicável)** | Técnicas para tornar as saídas do modelo interpretáveis — importante para confiança clínica. |
| **Model card** | Documento que descreve um modelo: dados, desempenho, limitações, uso pretendido. |

## D. Produto

| Termo | Definição |
|---|---|
| **Paciente** | Usuário que coleta o sinal e fornece contexto. |
| **Médico** | Profissional que acompanha pacientes e emite vereditos/recomendações. |
| **Veredito** | Conclusão/recomendação clínica emitida pelo médico (nunca pela IA). |
| **Anotação contextual** | Registro do paciente sobre o que ocorria em um dado momento (ex.: causa de um pico de estresse). |
| **Dashboard** | Painel analítico com visualizações do sinal e dos eventos. |
