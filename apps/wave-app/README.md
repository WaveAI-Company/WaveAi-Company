# apps/wave-app — App WaveAI (Expo universal)

Cliente único React para **iOS, Android e Web** (ADR-0016), com UI por papel
(paciente/médico). Nesta fase (M0) é o **boot + navegação**: telas placeholder
com dados fictícios, sem login real e sem captação.

> Uso exploratório de bem-estar — **não-clínico e não-diagnóstico**
> (ver `Medical/71_Intended_Use_and_Regulatory_Positioning.md`).

## Instalação

```bash
cd apps/wave-app
npm install
```

## Rodar

```bash
npm run web        # abre no navegador (http://localhost:8081)
npm run android    # emulador/dispositivo Android
npm run ios        # simulador iOS (requer macOS)
```

Outros scripts: `npm run typecheck` (tsc), `npm run build:web` (bundle de produção).

## Navegação (expo-router)

Roteamento por arquivo, compartilhado entre web e nativo:

```
app/_layout.tsx        # Stack raiz (tema e headers)
app/index.tsx          # tela inicial — escolha de papel (MOCK, sem login)
app/patient/index.tsx  # área do paciente (placeholder)
app/doctor/index.tsx   # área do médico (placeholder)
src/                   # tema e componentes compartilhados
```

No web, cada tela tem URL própria (`/`, `/patient`, `/doctor`).

## O que ainda NÃO existe (por design)

| Assunto | Issue |
|---|---|
| Login/registro real + rotas por papel (JWT) | #8 |
| Captação de EEG (BLE/SPP no mobile) | #12 |
| Telas do médico com dados reais | #10 |
| Histórico do paciente com dados reais | #11 |
| Design system / identidade por papel | #18 |

A seleção de papel na tela inicial é **simulada** e os dados listados são
**fictícios**, rotulados na UI (regra rígida: nunca exibir mock sem indicar que
não é dado real; nenhum dado de pessoa real em dev — LGPD).

## Renderização web

`app.json` usa `web.output: "single"` (SPA). O modo de renderização estática
não traz benefício para um app atrás de login e disparava um erro de SSR
("multiple renderers") com os componentes do react-native-web.
