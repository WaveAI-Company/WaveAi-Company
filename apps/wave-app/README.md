# apps/wave-app — App WaveAI (Expo universal)

Cliente único em React Native (Expo + expo-router) para **Android, iOS e Web**
(ADR-0016), com UI por papel: **paciente** (`app/patient`) e **profissional de
bem-estar** (`app/doctor`, o identificador técnico do papel é `doctor`). Uso
exploratório de bem-estar — **não-clínico e não-diagnóstico**
(`Medical/71_Intended_Use_and_Regulatory_Positioning.md`).

Fontes de verdade: decisões em `05_Decisions.md` (ADRs), arquitetura em
`Architecture/22_MVP_Platform_Architecture.md`, infra/deploy em `infra/README.md`.

## O que tem

- **Auth real** contra a API: cadastro, verificação de e-mail, login,
  recuperação de senha, guarda de rota por papel (ADR-0021).
- **Captação de EEG** (NeuroSky MindWave Mobile 2): Android por Bluetooth
  Classic/SPP (`src/device/connection.ts`), iOS por BLE
  (`src/device/connection.ios.ts`); a web não captura e mostra aviso. Parser
  ThinkGear em `src/device/thinkgear.ts`.
- **Serviço em primeiro plano** Android (`modules/captacao-foreground`, módulo
  nativo) para a captação seguir com o app em segundo plano.
- **Histórico, tendências e relatório longitudinal**, anotações de sessão,
  protocolo guiado, espectador ao vivo (paciente transmite, profissional assiste).
- **Vínculos** paciente-profissional, consentimento, exportação e exclusão de
  dados, textos legais (`src/legal`, `app/legal`), foto de perfil.
- **Design system** "Maré" em `src/theme` (tokens, temas claro/escuro,
  movimento reduzido) e `src/components`.

## Rodar

```bash
cd apps/wave-app
npm install
cp .env.example .env     # EXPO_PUBLIC_API_URL aponta para a API
npm run web              # http://localhost:8081
npm run android          # exige dev client/build nativo
npm run ios              # exige macOS e build nativo
```

Os módulos nativos (`react-native-bluetooth-classic`, `react-native-ble-plx`,
`captacao-foreground`) não rodam no Expo Go: use dev client (`expo-dev-client`)
ou build EAS (`eas.json`).

### Scripts do `package.json`

| Script | Para quê |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:web` | gera o texto legal estático e o bundle web (`expo export`) |
| `npm run check:contrast` | verifica o contraste dos tokens de cor |
| `npm run gerar:guia` / `npm run check:guia` | gera / confere `Design/guia-de-estilo.html` (sai dos tokens; nunca editar à mão) |
| `npm run gerar:legal-estatico` | gera as páginas legais estáticas |

O CI roda `typecheck`, `check:contrast` e `check:guia`. Não há suíte de testes
unitários neste app; o que depende de hardware (Bluetooth) não é exercitável em
CI, e por isso o parser do protocolo vive em módulo puro (`thinkgear.ts`).

## Variáveis de ambiente (`EXPO_PUBLIC_*`)

`EXPO_PUBLIC_API_URL` (URL da API), `EXPO_PUBLIC_ENABLE_SIMULATOR` e
`EXPO_PUBLIC_ENABLE_BLE_DIAG` (ferramentas de desenvolvimento). Exemplo em
`.env.example`. Variáveis `EXPO_PUBLIC_*` vão para o bundle: **nada secreto**.

## Autenticação: onde o token fica

O access token vive **só em memória**. O refresh é capability por plataforma
(`src/auth/storage*.ts`): na **web**, cookie `httpOnly` setado pela API (o app
não guarda nada; `credentials: "include"`); no **mobile**, `expo-secure-store`.
**Nunca** usar `localStorage`/`sessionStorage` para tokens. Em produção app e
API ficam em hosts diferentes, então a API precisa listar a origem do app em
`WAVEAI_API_CORS_ORIGINS` (ver `services/api/README.md`).

## Estrutura

```
app/            # rotas (expo-router): login, register, patient/*, doctor/*, legal/*
src/api/        # clientes da API (HTTP, stream, ao vivo)
src/auth/       # contexto de auth e armazenamento de token por plataforma
src/capture/    # sessão de captação, disponibilidade e veredito de qualidade
src/device/     # conexão Bluetooth (SPP/BLE), parser ThinkGear, contato do sensor
src/components/ # componentes compartilhados
src/theme/      # tokens e tema (design system)
modules/        # módulo nativo captacao-foreground (Android)
scripts/        # check-contrast, guia de estilo, legal estático
```

`app.json` usa `web.output: "single"` (SPA). Dados fictícios de desenvolvimento
são rotulados na UI; nenhum dado de pessoa real em dev (LGPD).
