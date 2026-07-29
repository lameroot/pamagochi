# Голосовой агент — локальный запуск (каркас E0)

## Новые приложения

- `apps/game` — Phaser детское приложение (порт `GAME_PORT`, по умолчанию 5174)
- `apps/parent` — React кабинет родителя (порт `PARENT_PORT`, по умолчанию 5175)
- `apps/voice-agent` — LiveKit voice runtime (секреты только здесь и в `apps/api`)

`apps/web` пока остаётся совместимым UI; миграция UX завершится в E4/E5.

## Быстрый старт

```bash
cp .env.local.example .env.local
# заполнить LIVEKIT_*/DEEPGRAM_*/DEEPSEEK_*/ELEVENLABS_*/VOICE_AGENT_SERVICE_TOKEN
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
LiveKit и provider API нужны только для реального голосового среза (E1+).

## Границы секретов

См. `.env.example`, `docs/credentials.md`, ADR 0001.
Frontend (`game`/`parent`/`web`) не получает `LIVEKIT_API_*`, provider keys или `VOICE_AGENT_SERVICE_TOKEN`.
