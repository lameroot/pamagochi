# Голосовой агент — локальный запуск (каркас E0)

## Новые приложения

- `apps/game` — Phaser детское приложение (порт `GAME_PORT`, по умолчанию 5174)
- `apps/parent` — React кабинет родителя (порт `PARENT_PORT`, по умолчанию 5175)
- `apps/voice-agent` — LiveKit voice runtime (секреты только здесь и в `apps/api`)

`apps/web` пока остаётся совместимым UI; миграция UX завершится в E4/E5.

## Быстрый старт

```bash
cp .env.local.example .env.local
# заполнить LIVEKIT_*/DEEPGRAM_*/DEEPSEEK_*/(ELEVENLABS_* или CARTESIA_*)/VOICE_AGENT_SERVICE_TOKEN
pnpm install
pnpm setup:local
pnpm --filter @pamagochi/contracts build
pnpm --filter @pamagochi/game-protocol build
pnpm --filter @pamagochi/agent-core build
pnpm --filter @pamagochi/safety-contracts build
pnpm --filter @pamagochi/voice-agent test
pnpm --filter @pamagochi/game build
pnpm --filter @pamagochi/parent build
```

Локальный профиль по-прежнему не требует Supabase/Render/Cloudflare.
LiveKit и provider API нужны для реального голосового среза. `apps/game` работает на
`http://localhost:5174`, `apps/parent` — на `http://localhost:5175`, поэтому оба
origin уже указаны в `.env.local.example`.

## Проверка реального голоса

После `pnpm setup:local` запустите в отдельных терминалах:

```bash
pnpm dev:local
pnpm --filter @pamagochi/parent dev
pnpm --filter @pamagochi/game dev
```

В кабинете родителя (`http://localhost:5175`) создайте ребёнка и нажмите
«Запустить игру». В ответе запроса `POST /api/children/:childId/game-sessions`
возьмите `gameSessionId`, затем запустите worker:

```bash
VOICE_GAME_SESSION_ID=<gameSessionId> pnpm --filter @pamagochi/voice-agent dev
```

Voice-agent сам читает `.env.local`; не передавайте ключи через браузер или в URL.
Для настоящего потока установите `VOICE_STT_PROVIDER=deepgram`,
`VOICE_LLM_PROVIDER=deepseek` и один из TTS: `VOICE_TTS_PROVIDER=elevenlabs` или
`VOICE_TTS_PROVIDER=cartesia`. Для Cartesia нужны `CARTESIA_API_KEY` и
`CARTESIA_VOICE_ID` (выберите голос в [Cartesia Playground](https://play.cartesia.ai/));
по умолчанию используется `sonic-3.5` с `CARTESIA_LANGUAGE=ru`. TTS запрашивается
как PCM 24 kHz и публикуется agent-участником в LiveKit; микрофон ребёнка
нормализуется до PCM 16 kHz перед Deepgram.

## Границы секретов

См. `.env.example`, `docs/credentials.md`, ADR 0001.
Frontend (`game`/`parent`/`web`) не получает `LIVEKIT_API_*`, provider keys или `VOICE_AGENT_SERVICE_TOKEN`.
