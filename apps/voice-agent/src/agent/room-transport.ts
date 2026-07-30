import { AccessToken } from 'livekit-server-sdk';
import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
  type RemoteTrack,
} from '@livekit/rtc-node';
import type { AgentState, AgentToolResult } from '@pamagochi/contracts';
import { VOICE_PROTOCOL_VERSION } from '@pamagochi/contracts';
import type { VoiceAgentEnv } from '../config/env.schema.js';
import { assertEgressAllowed } from '../safety/egress-policy.js';

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
 * LiveKit media transport for one agent participant.
 *
 * Incoming audio is normalized by `AudioStream` to 16 kHz mono S16LE for
 * Deepgram. Agent TTS must be 24 kHz mono S16LE (the ElevenLabs adapter asks
 * for `pcm_24000`), which is published as a normal LiveKit microphone track.
 */
export class LiveKitRoomTransport implements RoomTransport {
  private connected = false;
  private audioHandler?: (chunk: Uint8Array) => void;
  readonly publishedEvents: unknown[] = [];
  private agentToken?: string;
  private room?: Room;
  private audioSource?: AudioSource;
  private audioTrack?: LocalAudioTrack;
  private pendingTtsByte?: number;

  constructor(
    private readonly env: VoiceAgentEnv,
    readonly roomName: string,
    private readonly identity: string,
  ) {}

  async connect(): Promise<void> {
    assertEgressAllowed(this.env.LIVEKIT_URL);
    const jwt = await createAgentRoomToken(this.env, this.roomName, this.identity);
    if (!jwt.includes('.')) {
      throw new Error('Failed to mint LiveKit agent token');
    }
    const room = new Room();
    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      // The browser game joins with a child-* identity. Ignore any other
      // participants so an agent never transcribes its own published speech.
      if (track.kind !== TrackKind.KIND_AUDIO || !participant.identity.startsWith('child-')) return;
      void this.consumeChildAudio(track);
    });

    try {
      await room.connect(this.env.LIVEKIT_URL, jwt, { autoSubscribe: true, dynacast: true });
      if (!room.localParticipant)
        throw new Error('LiveKit room connected without a local participant');

      const audioSource = new AudioSource(24_000, 1);
      const audioTrack = LocalAudioTrack.createAudioTrack('pamagochi-voice', audioSource);
      const options = new TrackPublishOptions();
      options.source = TrackSource.SOURCE_MICROPHONE;
      await room.localParticipant.publishTrack(audioTrack, options);

      this.room = room;
      this.audioSource = audioSource;
      this.audioTrack = audioTrack;
      this.agentToken = jwt;
      this.connected = true;
    } catch (error) {
      await room.disconnect().catch(() => undefined);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.agentToken = undefined;
    await this.audioTrack?.close();
    await this.audioSource?.close();
    await this.room?.disconnect();
    this.audioTrack = undefined;
    this.audioSource = undefined;
    this.room = undefined;
  }

  async publishAudio(chunk: Uint8Array): Promise<void> {
    if (!this.connected) throw new Error('Room is not connected');
    if (!this.audioSource || chunk.byteLength === 0) return;

    // Avoid creating an Int16Array view over an unaligned ArrayBuffer. The
    // provider response is little-endian S16LE by contract.
    const input =
      this.pendingTtsByte === undefined ? chunk : Uint8Array.from([this.pendingTtsByte, ...chunk]);
    const evenLength = input.byteLength - (input.byteLength % 2);
    this.pendingTtsByte = input.byteLength % 2 === 1 ? input[input.byteLength - 1] : undefined;
    if (evenLength === 0) return;
    const data = new Int16Array(evenLength / 2);
    new Uint8Array(data.buffer).set(input.subarray(0, evenLength));
    await this.audioSource.captureFrame(new AudioFrame(data, 24_000, 1, data.length));
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
    await this.room?.localParticipant?.publishData(encoded, { reliable: true });
  }

  private async consumeChildAudio(track: RemoteTrack): Promise<void> {
    try {
      const stream = new AudioStream(track, 16_000, 1);
      for await (const frame of stream) {
        // Copy exactly the view represented by the typed array; Buffer backing
        // stores can be larger than the frame itself.
        const bytes = new Uint8Array(
          frame.data.buffer,
          frame.data.byteOffset,
          frame.data.byteLength,
        );
        this.audioHandler?.(Uint8Array.from(bytes));
      }
    } catch {
      // Disconnect and temporary subscription failures are reflected by the
      // AgentSession state/metrics; never leak transport internals to a child.
    }
  }

  /** Test helper: inject subscribed child mic audio. */
  emitChildAudio(chunk: Uint8Array): void {
    this.audioHandler?.(chunk);
  }
}
