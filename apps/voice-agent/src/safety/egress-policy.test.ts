import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EGRESS_ALLOWLIST,
  assertEgressAllowed,
  checkEgressAllowed,
} from './egress-policy.js';

describe('egress-policy (E6.1)', () => {
  const allowedUrls = [
    'https://api.deepgram.com/v1/listen',
    'wss://my-project.livekit.cloud',
    'https://api.deepseek.com/chat/completions',
    'https://api.elevenlabs.io/v1/text-to-speech/voice-id',
    'https://api.cartesia.ai/tts/bytes',
    'http://localhost:3000/internal/agent/sessions/x/context',
    'http://127.0.0.1:3000/internal/agent/usage',
  ];

  for (const url of allowedUrls) {
    it(`allows ${url}`, () => {
      const result = checkEgressAllowed(url);
      expect(result.allowed).toBe(true);
      expect(result.matchedEntryId).toBeTruthy();
    });
  }

  const blockedUrls = [
    'https://evil.example.com/payload',
    'https://google.com/search?q=secrets',
    'http://169.254.169.254/latest/meta-data',
    'ftp://api.deepgram.com/file',
    'not-a-url',
  ];

  for (const url of blockedUrls) {
    it(`blocks ${url}`, () => {
      const result = checkEgressAllowed(url);
      expect(result.allowed).toBe(false);
    });
  }

  it('assertEgressAllowed throws for blocked hosts', () => {
    expect(() => assertEgressAllowed('https://attacker.example/')).toThrow(/Egress blocked/);
  });

  it('allowlist covers all required provider categories', () => {
    const ids = new Set(DEFAULT_EGRESS_ALLOWLIST.map((e) => e.id));
    expect(ids).toEqual(
      new Set(['livekit', 'deepgram', 'deepseek', 'elevenlabs', 'cartesia', 'internal-api']),
    );
  });
});
