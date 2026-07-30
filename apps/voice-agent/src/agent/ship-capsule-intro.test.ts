import { describe, expect, it } from 'vitest';
import type { VoiceSessionContext } from '@pamagochi/contracts';
import { DEFAULT_SAFETY_POLICY } from '@pamagochi/safety-contracts';
import { introWorldContextFor } from '@pamagochi/game-protocol';
import { PromptAssembler } from '../prompt/prompt-assembler.js';
import { runInputPipeline } from '../safety/turn-pipeline.js';
import { formatSoulForPrompt, SoulLoader } from '../soul/soul-loader.js';

const soul = formatSoulForPrompt(new SoulLoader().load().document);

describe('ship-capsule voice context', () => {
  it('includes closed-capsule perception in worldState', async () => {
    const context: VoiceSessionContext = {
      protocolVersion: '1',
      gameSessionId: 'gs1',
      conversationSessionId: 'cs1',
      childId: 'ch1',
      ageBand: '6-8',
      primaryLanguage: 'ru',
      displayName: 'Мира',
      soulVersion: '0.1.0',
      safetyPolicyVersion: '0.1.0',
      livekitRoomName: 'game-gs1',
      sceneKey: 'ship-capsule-intro',
      sceneState: 'FIRST_VOICE_CONTACT',
      worldState: introWorldContextFor('FIRST_VOICE_CONTACT') as unknown as Record<string, unknown>,
      goal: 'You hear the child but cannot see them.',
    };

    const assembler = new PromptAssembler();
    const pipeline = await runInputPipeline(
      {
        promptAssembler: assembler,
        safetyPolicy: DEFAULT_SAFETY_POLICY,
        soulText: soul,
        allowedTools: ['character_emote', 'scene_request_event'],
      },
      { context, userText: 'привет' },
    );

    expect(pipeline.proceed).toBe(true);
    expect(pipeline.systemPrompt).toContain('FIRST_VOICE_CONTACT');
    expect(pipeline.systemPrompt).toContain('cannot see');
    expect(pipeline.systemPrompt).not.toContain('sk-');
  });

  it('does not expose scene_request_event when not in allowlist', async () => {
    const context: VoiceSessionContext = {
      protocolVersion: '1',
      gameSessionId: 'gs1',
      conversationSessionId: 'cs1',
      childId: 'ch1',
      ageBand: '6-8',
      primaryLanguage: 'ru',
      displayName: 'Мира',
      soulVersion: '0.1.0',
      safetyPolicyVersion: '0.1.0',
      livekitRoomName: 'game-gs1',
      worldState: introWorldContextFor('SHIP_DARK') as unknown as Record<string, unknown>,
    };

    const pipeline = await runInputPipeline(
      {
        promptAssembler: new PromptAssembler(),
        safetyPolicy: DEFAULT_SAFETY_POLICY,
        soulText: soul,
        allowedTools: ['character_emote'],
      },
      { context, userText: 'открой капсулу' },
    );

    expect(pipeline.systemPrompt).toContain('character_emote');
    expect(pipeline.systemPrompt).not.toContain('scene_request_event');
  });
});
