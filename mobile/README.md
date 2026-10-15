# Fitness App — Mobile (Expo)

App React Native (Expo + TypeScript) que consome a API em `../` (`/api/v1`).

## Rodar

Pré: back de pé (`docker compose up -d` na raiz do projeto) e Node 18+.

```bash
cp .env.example .env
# edite EXPO_PUBLIC_API_URL com o IP da sua maquina na LAN (nao "localhost")
npm install          # se ainda nao instalou
npx expo start       # abre o Metro; leia o QR no app Expo Go (celular) ou 'a' p/ Android
```

> **Por que IP da LAN e não `localhost`?** O celular/emulador é outra máquina —
> `localhost` apontaria pro próprio aparelho. Descubra o IP com `ip addr` (algo
> como `192.168.x.x`) e use `http://SEU_IP:8000/api/v1`.

## Estrutura

```
App.tsx                 QueryClientProvider + tela raiz
src/
  config.ts             API_URL (via EXPO_PUBLIC_API_URL)
  types.ts              tipos espelhando a API
  api/
    client.ts           fetch wrapper (erros -> ApiError)
    exercises.ts        endpoints de exercicios
  hooks/
    useExercises.ts     React Query (list / create / archive)
  screens/
    ExercisesScreen.tsx  1a tela: listar + adicionar + arquivar
```

## Estado

- **Tela de exercícios** pronta (listar, adicionar, arquivar; pull-to-refresh).
- Estado de servidor via **React Query** (cache + invalidação automática).
- Navegação entre telas entra quando houver a 2ª tela (treinos).

## Verificado

- `npx tsc --noEmit` → sem erros de tipo.
- `npx expo export` → bundle Android compila (631 módulos), imports OK.
- **Não** rodado em emulador/dispositivo neste ambiente (headless).
