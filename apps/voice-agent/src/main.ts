import { parseVoiceAgentEnv } from './config/env.schema.js';

/**
 * Scaffold entrypoint for the voice-agent process (E0).
 * Business runtime (LiveKit AgentSession) arrives in E1.
 */
function main(): void {
  const env = parseVoiceAgentEnv(process.env);
  console.info(
    JSON.stringify({
      event: 'voice_agent_scaffold_ready',
      agentName: env.LIVEKIT_AGENT_NAME,
      stt: env.VOICE_STT_PROVIDER,
      llm: env.VOICE_LLM_PROVIDER,
      tts: env.VOICE_TTS_PROVIDER,
      soulVersion: env.PAMAGOCHI_SOUL_VERSION,
      safetyVersion: env.PAMAGOCHI_SAFETY_POLICY_VERSION,
    }),
  );
}

main();
