import { AccessToken } from 'livekit-server-sdk';
import type { AgentState, AgentToolResult } from '@pamagochi/contracts';
import { VOICE_PROTOCOL_VERSION } from '@pamagochi/contracts';
import type { VoiceAgentEnv } from '../config/env.schema.js';

export interface RoomTransport {
  readonly roomName: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publishAudio(chunk: Uint8Array): Promise<void>;
  onAudio(handler: (chunk: Uint8Array) => void): void;
  publishAgentState(state: AgentState): Promise<void>;
  publishToolResult(result: AgentToolResult): Promise<void>;
}

function encodeRuntimeEvent(payload: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/** In-memory transport for unit tests and local dry-runs without LiveKit network. */
export class MockRoomTransport implements RoomTransport {
  private audioHandler?: (chunk: Uint8Array) => void;
  private runtimeHandler?: (payload: unknown) => void;
  connected = false;

  constructor(readonly roomName: string) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async publishAudio(chunk: Uint8Array): Promise<void> {
    if (!this.connected) throw new Error('Room is not connected');
    void chunk;
  }

  onAudio(handler: (chunk: Uint8Array) => void): void {
    this.audioHandler = handler;
  }

  async publishAgentState(state: AgentState): Promise<void> {
    await this.publishRuntimeEvent({
      type: 'agent-state',
      state,
      at: new Date().toISOString(),
    });
  }

  async publishToolResult(result: AgentToolResult): Promise<void> {
    await this.publishRuntimeEvent({
      type: 'tool-result',
      protocolVersion: VOICE_PROTOCOL_VERSION,
      result,
    });
  }

  async publishRuntimeEvent(payload: unknown): Promise<void> {
    this.runtimeHandler?.(payload);
  }

  onRuntimeEvent(handler: (payload: unknown) => void): void {
    this.runtimeHandler = handler;
  }

  /** Test helper: simulate child mic audio. */
  emitChildAudio(chunk: Uint8Array): void {
    this.audioHandler?.(chunk);
  }
}

export async function createAgentRoomToken(
  env: VoiceAgentEnv,
  roomName: string,
  identity: string,
): Promise<string> {
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    ttl: 60 * 60,
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}

/**
 * LiveKit transport scaffold. Real WebRTC media path is activated when
 * `@livekit/rtc-node` is available; until then connect() validates token minting.
 */
export class LiveKitRoomTransport implements RoomTransport {
  private connected = false;

  constructor(
    private readonly env: VoiceAgentEnv,
    readonly roomName: string,
    private readonly identity: string,
  ) {}

  async connect(): Promise<void> {
    const jwt = await createAgentRoomToken(this.env, this.roomName, this.identity);
    if (!jwt.includes('.')) {
      throw new Error('Failed to mint LiveKit agent token');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async publishAudio(chunk: Uint8Array): Promise<void> {
    if (!this.connected) throw new Error('Room is not connected');
    void chunk;
  }

  onAudio(_handler: (chunk: Uint8Array) => void): void {
    /* wired in rtc-node integration */
  }

  async publishAgentState(state: AgentState): Promise<void> {
    void state;
    /* wired in rtc-node data channel integration */
  }

  async publishToolResult(result: AgentToolResult): Promise<void> {
    void result;
    /* wired in rtc-node data channel integration */
  }
}
