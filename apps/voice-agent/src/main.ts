import { parseVoiceAgentEnv } from './config/env.schema.js';
import { AgentSession } from './agent/agent-session.js';
import { LiveKitRoomTransport, MockRoomTransport } from './agent/room-transport.js';

/**
 * Voice-agent entrypoint.
 *
 * Usage:
 *   VOICE_GAME_SESSION_ID=... pnpm --filter @pamagochi/voice-agent dev
 *   VOICE_ROOM_TRANSPORT=mock for local dry-run without LiveKit media
 */
async function main(): Promise<void> {
  const env = parseVoiceAgentEnv(process.env);
  const gameSessionId = process.env.VOICE_GAME_SESSION_ID;

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

  const session = new AgentSession({ env, transport });
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
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(JSON.stringify({ event: 'voice_agent_fatal', message }));
  process.exit(1);
});
