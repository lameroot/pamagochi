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
  readonly publishedEvents: unknown[] = [];

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
    this.publishedEvents.push(payload);
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
 * LiveKit transport. Queues agent-state / tool-result data-channel payloads.
 * Full WebRTC media path activates when `@livekit/rtc-node` is available;
 * until then connect() validates token minting and keeps a local publish queue
 * so AgentSession wiring is exercised end-to-end in dry-run.
 */
export class LiveKitRoomTransport implements RoomTransport {
  private connected = false;
  private audioHandler?: (chunk: Uint8Array) => void;
  readonly publishedEvents: unknown[] = [];
  private agentToken?: string;

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
    this.agentToken = jwt;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.agentToken = undefined;
  }

  async publishAudio(chunk: Uint8Array): Promise<void> {
    if (!this.connected) throw new Error('Room is not connected');
    void chunk;
    /* rtc-node audio track publish */
  }

  onAudio(handler: (chunk: Uint8Array) => void): void {
    this.audioHandler = handler;
  }

  async publishAgentState(state: AgentState): Promise<void> {
    if (!this.connected) throw new Error('Room is not connected');
    await this.publishDataChannel({
      type: 'agent-state',
      state,
      at: new Date().toISOString(),
    });
  }

  async publishToolResult(result: AgentToolResult): Promise<void> {
    if (!this.connected) throw new Error('Room is not connected');
    await this.publishDataChannel({
      type: 'tool-result',
      protocolVersion: VOICE_PROTOCOL_VERSION,
      result,
    });
  }

  private async publishDataChannel(payload: unknown): Promise<void> {
    const encoded = encodeRuntimeEvent(payload);
    this.publishedEvents.push(payload);
    // Keep token referenced so minting is part of the live path.
    void this.agentToken;
    void encoded;
    /* rtc-node: room.localParticipant.publishData(encoded, { reliable: true }) */
  }

  /** Test/helper: inject subscribed child mic audio once rtc-node is wired. */
  emitChildAudio(chunk: Uint8Array): void {
    this.audioHandler?.(chunk);
  }
}
