import WebSocket from 'ws';
import type { VoiceAgentEnv } from '../../config/env.schema.js';
import { assertEgressAllowed } from '../../safety/egress-policy.js';
import type { StreamingSttProvider, StreamingSttSession, TranscriptEvent } from '../types.js';

interface DeepgramMessage {
  channel?: { alternatives?: Array<{ transcript?: string }> };
  is_final?: boolean;
  speech_final?: boolean;
  start?: number;
  duration?: number;
}

function listenUrl(env: VoiceAgentEnv, language: string): string {
  const base = new URL(env.DEEPGRAM_BASE_URL);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `${base.pathname.replace(/\/$/, '')}/v1/listen`;
  base.search = new URLSearchParams({
    model: env.DEEPGRAM_MODEL,
    language,
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    smart_format: String(env.DEEPGRAM_SMART_FORMAT),
    interim_results: String(env.DEEPGRAM_INTERIM_RESULTS),
    endpointing: String(env.DEEPGRAM_ENDPOINTING_MS),
    utterance_end_ms: String(env.DEEPGRAM_UTTERANCE_END_MS),
    punctuate: 'true',
  }).toString();
  return base.toString();
}

/** Deepgram live STT over authenticated WebSocket using 16 kHz mono S16LE. */
export class DeepgramSttProvider implements StreamingSttProvider {
  readonly providerId = 'deepgram';

  constructor(private readonly env: VoiceAgentEnv) {
    if (!env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY is required for deepgram STT');
    }
  }

  get model(): string {
    return this.env.DEEPGRAM_MODEL;
  }

  get language(): string {
    return this.env.DEEPGRAM_LANGUAGE;
  }

  startSession(options?: { language?: string }): StreamingSttSession {
    const language = options?.language ?? this.language;
    const url = listenUrl(this.env, language);
    assertEgressAllowed(url);
    const socket = new WebSocket(url, {
      headers: { Authorization: `Token ${this.env.DEEPGRAM_API_KEY}` },
    });
    let handler: ((event: TranscriptEvent) => void) | undefined;
    let closed = false;
    const finalParts: string[] = [];
    const pendingAudio: Uint8Array[] = [];

    socket.on('open', () => {
      console.info(JSON.stringify({ event: 'voice_agent_deepgram_connected' }));
      for (const chunk of pendingAudio.splice(0)) socket.send(chunk);
    });

    socket.on('error', (error) => {
      console.error(
        JSON.stringify({
          event: 'voice_agent_deepgram_error',
          message: error instanceof Error ? error.message.slice(0, 200) : 'connection_failed',
        }),
      );
    });

    socket.on('close', (code) => {
      if (!closed) console.error(JSON.stringify({ event: 'voice_agent_deepgram_closed', code }));
    });

    socket.on('message', (data) => {
      let message: DeepgramMessage;
      try {
        message = JSON.parse(data.toString()) as DeepgramMessage;
      } catch {
        return;
      }
      const text = message.channel?.alternatives?.[0]?.transcript?.trim();
      if (!text) return;

      // A long utterance can contain several `is_final` segments. Only hand
      // the assembled utterance to the LLM after Deepgram's endpoint detector
      // marks `speech_final`.
      if (message.is_final) finalParts.push(text);
      if (message.speech_final) {
        const utterance = finalParts.join(' ').trim() || text;
        finalParts.length = 0;
        console.info(
          JSON.stringify({
            event: 'voice_agent_stt_utterance_final',
            characters: utterance.length,
          }),
        );
        handler?.({
          text: utterance,
          isFinal: true,
          startedAtMs: message.start === undefined ? undefined : message.start * 1000,
          endedAtMs:
            message.start === undefined || message.duration === undefined
              ? undefined
              : (message.start + message.duration) * 1000,
        });
      } else if (!message.is_final) {
        handler?.({ text, isFinal: false });
      }
    });

    return {
      writeAudio(chunk) {
        if (closed || chunk.byteLength === 0) return;
        if (socket.readyState === WebSocket.OPEN) socket.send(chunk);
        else if (socket.readyState === WebSocket.CONNECTING)
          pendingAudio.push(Uint8Array.from(chunk));
      },
      async end() {
        if (closed) return;
        closed = true;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'CloseStream' }));
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.once('open', () => {
            socket.send(JSON.stringify({ type: 'CloseStream' }));
            socket.close();
          });
        }
      },
      onTranscript(next) {
        handler = next;
      },
    };
  }
}
