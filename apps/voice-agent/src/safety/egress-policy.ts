/**
 * Egress allowlist for voice-agent outbound HTTP/WebSocket targets.
 * Adapters should call `assertEgressAllowed` before opening connections.
 */

export interface EgressAllowlistEntry {
  id: string;
  description: string;
  hostPatterns: RegExp[];
}

/** Default production allowlist — LiveKit, STT/LLM/TTS providers, internal API only. */
export const DEFAULT_EGRESS_ALLOWLIST: readonly EgressAllowlistEntry[] = [
  {
    id: 'livekit',
    description: 'LiveKit SFU (signaling + media)',
    hostPatterns: [/^[^/]+\.livekit\.cloud$/i, /^livekit\./i, /^localhost$/i, /^127\.0\.0\.1$/i],
  },
  {
    id: 'deepgram',
    description: 'Deepgram STT API',
    hostPatterns: [/^api\.deepgram\.com$/i, /^[^/]+\.deepgram\.com$/i],
  },
  {
    id: 'deepseek',
    description: 'DeepSeek LLM API',
    hostPatterns: [/^api\.deepseek\.com$/i, /^[^/]+\.deepseek\.com$/i],
  },
  {
    id: 'elevenlabs',
    description: 'ElevenLabs TTS API',
    hostPatterns: [/^api\.elevenlabs\.io$/i, /^[^/]+\.elevenlabs\.io$/i],
  },
  {
    id: 'internal-api',
    description: 'Pamagochi internal API (transcript, tools, memory)',
    hostPatterns: [/^localhost$/i, /^127\.0\.0\.1$/i, /^api\./i, /^[^/]+\.onrender\.com$/i],
  },
] as const;

export interface EgressCheckResult {
  allowed: boolean;
  matchedEntryId: string | null;
  hostname: string;
  reason: string | null;
}

export function parseEgressHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function checkEgressAllowed(
  url: string,
  allowlist: readonly EgressAllowlistEntry[] = DEFAULT_EGRESS_ALLOWLIST,
): EgressCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, matchedEntryId: null, hostname: '', reason: 'invalid_url' };
  }

  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (!['https', 'http', 'wss', 'ws'].includes(scheme)) {
    return {
      allowed: false,
      matchedEntryId: null,
      hostname: parsed.hostname.toLowerCase(),
      reason: 'scheme_not_allowed',
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { allowed: false, matchedEntryId: null, hostname: '', reason: 'invalid_url' };
  }

  for (const entry of allowlist) {
    if (entry.hostPatterns.some((pattern) => pattern.test(hostname))) {
      return { allowed: true, matchedEntryId: entry.id, hostname, reason: null };
    }
  }

  return {
    allowed: false,
    matchedEntryId: null,
    hostname,
    reason: 'host_not_in_allowlist',
  };
}

export function assertEgressAllowed(
  url: string,
  allowlist: readonly EgressAllowlistEntry[] = DEFAULT_EGRESS_ALLOWLIST,
): void {
  const result = checkEgressAllowed(url, allowlist);
  if (!result.allowed) {
    throw new Error(`Egress blocked for host "${result.hostname}": ${result.reason}`);
  }
}
