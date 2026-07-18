# 20 · Visão de Arquitetura do Sistema (Semente v0.1) — WaveAI

| Campo | Valor |
|---|---|
| Versão | 0.1 (semente) |
| Status | Semente — **arquitetura de referência, não travada** |
| Data | 2026-07-18 |
| Documentos relacionados | [MASTER_PLAN](../MASTER_PLAN.md), [07_Tech_Stack](../07_Tech_Stack.md), [05_Decisions](../05_Decisions.md) |

> **[HIPÓTESE]** Esta é uma **arquitetura de referência conceitual** para orientar discussões. As decisões estruturais (edge-vs-nuvem, streaming, banco) permanecem abertas como ADRs. Não implementar a partir daqui.

---

## 1. Atributos de qualidade (drivers)
Prioridades para SaMD com dados sensíveis e time pequeno:
1. **Segurança & privacidade** (LGPD) — cifragem, IAM, auditoria.
2. **Confiabilidade & rastreabilidade** (IEC 62304) — nada de caixa-preta não versionada.
3. **Integridade do dado clínico** — do sensor ao relatório.
4. **Escalabilidade incremental** — simples primeiro, escala quando justificar.
5. **Manutenibilidade** — poucas tecnologias, serviços gerenciados.

## 2. Componentes (lógicos)
```
[NeuroSky FP1]
     │  Bluetooth (ThinkGear)
     ▼
[App Paciente (mobile)]
   • captação + qualidade de sinal
   • pré-processamento leve (edge?)
   • anotações contextuais
     │  HTTPS / WebSocket (TLS)
     ▼
[Gateway de Ingestão / API]
     ▼
[Processamento de Sinal (DSP)] ──► [Camada de Features]
     ▼                                   │
[Detecção de Eventos / IA (apoio)] ◄─────┘
     ▼
[Armazenamento]
   • Série temporal (EEG/features)
   • Relacional (clínico, usuários)
   • Objetos (raw, relatórios) — cifrado
     ▼
[Analytics & Relatórios] ──► [Portal do Médico (web)]
                                   • dashboards, vereditos
[Serviços transversais]
   • Identidade (OAuth2/OIDC, papéis)
   • Auditoria imutável
   • Notificações (contexto pós-evento)
   • Observabilidade
```

## 3. Dois caminhos de dados
- **Tempo quase real:** dispositivo → app → ingestão → processamento leve → alertas/estado ao vivo. **[HIPÓTESE]** latência aceitável a definir (Q-TEC-02); "tempo real" clínico raramente exige milissegundos.
- **Batch/histórico:** consolidação, features de longo prazo, correlação contexto × sinal, relatórios.

## 4. Decisão estrutural nº 1: Edge vs Nuvem (ADR-0005, aberta)
| Abordagem | Vantagens | Desvantagens |
|---|---|---|
| **Processar na nuvem** | Lógica centralizada, fácil atualizar, dispositivo leve | Mais dados trafegados; dependência de conectividade; custo de banda |
| **Processar no edge (app)** | Menos tráfego; funciona offline; privacidade | Limite de CPU/bateria; atualizar algoritmo é mais difícil; rastreabilidade IEC 62304 mais complexa |
| **Híbrido** *(provável)* | Filtragem/qualidade no edge; features/IA na nuvem | Complexidade de particionamento |
**[RECOMENDAÇÃO]** Definir após o spike da Fase 1 medir volume de dados, latência e consumo do app.

## 5. Modelo de dados (alto nível)
Entidades núcleo: **Paciente**, **Médico**, **Vínculo médico-paciente**, **Sessão de captação**, **Amostra/Segmento de sinal**, **Feature**, **Evento detectado**, **Anotação contextual**, **Relatório**, **Veredito**, **Log de auditoria**.
**[RECOMENDAÇÃO]** Separar **dado clínico identificável** de **dado de sinal/telemetria**; considerar pseudonimização para pipelines de IA.

## 6. Segurança (transversal)
Cifragem em trânsito (TLS) e repouso; autenticação forte e autorização por papel (paciente/médico/admin); **trilha de auditoria imutável** (quem viu/alterou o quê); segregação de ambientes; gestão de segredos. Modelagem de ameaças (STRIDE) a produzir em `Infrastructure/`.

## 7. Deploy & residência
**[RECOMENDAÇÃO]** Nuvem gerenciada em **região no Brasil** (LGPD), IaC versionado, ambientes segregados (dev/homolog/prod), CI/CD com rastreabilidade. Provedor/região = ADR-0008.

## 8. Abstração do dispositivo
**[RECOMENDAÇÃO]** Isolar o NeuroSky atrás de uma **interface de dispositivo** (camada anticorrupção), de modo que suportar outros EEGs no futuro não afete o resto do sistema — mitiga o risco R-07 (dependência de SDK proprietário).

## 9. Perguntas em aberto
Q-TEC-01 (edge vs nuvem), Q-TEC-02 (latência), Q-TEC-04 (banco de série temporal), Q-TEC-05 (SDK NeuroSky), Q-LGP-01 (residência).

## 10. Próximas expansões
Modelo C4 completo · Modelo de dados detalhado · Especificação de APIs · Modelo de eventos/streaming · ADRs estruturais.
