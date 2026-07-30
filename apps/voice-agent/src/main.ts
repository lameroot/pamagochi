import { existsSync } from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import { parseVoiceAgentEnv } from './config/env.schema.js';
import { AgentSession } from './agent/agent-session.js';
import { LiveKitRoomTransport, MockRoomTransport } from './agent/room-transport.js';
import { PromptVersionLoader } from './prompt/prompt-version-loader.js';
import { createDefaultSafetyRuntime } from './safety/create-default-hooks.js';
import { SoulLoader } from './soul/soul-loader.js';

/**
 * Voice-agent entrypoint.
 *
 * Usage:
 *   VOICE_GAME_SESSION_ID=... pnpm --filter @pamagochi/voice-agent dev
 *   VOICE_ROOM_TRANSPORT=mock for local dry-run without LiveKit media
 */
async function main(): Promise<void> {
  // `pnpm --filter @pamagochi/voice-agent dev` does not pass through the
  // repository profile runner. Load the same local file explicitly, while
  // never overriding variables injected by a process manager/CI.
  const envPath =
    process.env.APP_PROFILE === 'cloud' && existsSync('.env.cloud.local')
      ? '.env.cloud.local'
      : '.env.local';
  loadDotenv({ path: envPath, quiet: true });
  const env = parseVoiceAgentEnv(process.env);
  const gameSessionId = process.env.VOICE_GAME_SESSION_ID;

  try {
    const loader = new PromptVersionLoader();
    const soulFile = new SoulLoader().load({ expectedVersion: env.PAMAGOCHI_SOUL_VERSION });
    await loader.loadActive({
      apiBaseUrl: env.VOICE_AGENT_INTERNAL_API_URL,
      serviceToken: env.VOICE_AGENT_SERVICE_TOKEN,
      expectedSoulVersion: env.PAMAGOCHI_SOUL_VERSION,
      expectedSafetyVersion: env.PAMAGOCHI_SAFETY_POLICY_VERSION,
    });
    void soulFile;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'prompt_version_load_failed';
    console.error(JSON.stringify({ event: 'voice_agent_prompt_versions_invalid', message }));
    process.exit(1);
  }

  console.info(
    JSON.stringify({
      event: 'voice_agent_starting',
      agentName: env.LIVEKIT_AGENT_NAME,
      stt: env.VOICE_STT_PROVIDER,
      llm: env.VOICE_LLM_PROVIDER,
      tts: env.VOICE_TTS_PROVIDER,
    }),
  );

  if (!gameSessionId) {
    console.info(
      JSON.stringify({
        event: 'voice_agent_idle',
        message: 'Set VOICE_GAME_SESSION_ID to attach AgentSession to a game room',
      }),
    );
    return;
  }

  const roomName = `game-${gameSessionId}`;
  const transport =
    process.env.VOICE_ROOM_TRANSPORT === 'mock'
      ? new MockRoomTransport(roomName)
      : new LiveKitRoomTransport(env, roomName, `${env.LIVEKIT_AGENT_NAME}-${gameSessionId}`);

  const safety = createDefaultSafetyRuntime(env);
  const session = new AgentSession({
    env,
    transport,
    safetyHooks: safety.hooks,
  });
  await session.start(gameSessionId);

  const shutdown = async () => {
    await session.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  console.info(
    JSON.stringify({
      event: 'voice_agent_session_ready',
      gameSessionId,
      roomName,
      state: session.getAgentState(),
      sceneKey: session.getContext()?.sceneKey,
      sceneState: session.getContext()?.sceneState,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(JSON.stringify({ event: 'voice_agent_fatal', message }));
  process.exit(1);
});
