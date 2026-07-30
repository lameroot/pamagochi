import {
  agentStateEventSchema,
  type AgentState,
  type AgentToolResult,
  agentToolResultSchema,
  voiceRuntimeEventSchema,
} from '@pamagochi/contracts';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { VoiceClient } from './voice-client.js';

function parseRuntimePayload(payload: Uint8Array): {
  agentState?: AgentState;
  toolResult?: AgentToolResult;
} {
  try {
    const text = new TextDecoder().decode(payload);
    const json: unknown = JSON.parse(text);
    const event = voiceRuntimeEventSchema.safeParse(json);
    if (!event.success) return {};

    if (event.data.type === 'agent-state') {
      const stateEvent = agentStateEventSchema.parse(event.data);
      return { agentState: stateEvent.state };
    }
    if (event.data.type === 'tool-result') {
      const result = agentToolResultSchema.parse(event.data.result);
      return { toolResult: result };
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Browser LiveKit client: publish mic, subscribe agent audio, receive runtime events.
 */
export class LiveKitVoiceClient implements VoiceClient {
  private room?: Room;
  private agentState: AgentState = 'connecting';
  private readonly stateListeners = new Set<(state: AgentState) => void>();
  private readonly toolListeners = new Set<(result: AgentToolResult) => void>();
  private agentAudio?: HTMLAudioElement;

  getAgentState(): AgentState {
    return this.agentState;
  }

  onAgentState(handler: (state: AgentState) => void): () => void {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  onToolResult(handler: (result: AgentToolResult) => void): () => void {
    this.toolListeners.add(handler);
    return () => this.toolListeners.delete(handler);
  }

  async connect(config: { url: string; token: string }): Promise<void> {
    this.setAgentState('connecting');
    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;

    room.on(RoomEvent.DataReceived, (payload) => {
      const parsed = parseRuntimePayload(payload);
      if (parsed.agentState) this.setAgentState(parsed.agentState);
      if (parsed.toolResult) {
        for (const listener of this.toolListeners) listener(parsed.toolResult);
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const element = track.attach();
      if (element instanceof HTMLAudioElement) {
        this.agentAudio?.pause();
        this.agentAudio?.remove();
        this.agentAudio = element;
        element.autoplay = true;
        element.dataset.pamagochiVoice = 'agent-audio';
        element.setAttribute('aria-hidden', 'true');
        element.style.display = 'none';
        // Keep the media element in the document. A detached <audio> element
        // is not reliably rendered by browsers, even when its MediaStream is
        // playing, so LiveKit audio could be received but remain silent.
        document.body.append(element);
        void element.play().then(
          () => console.info('[voice] agent audio playback started'),
          (error: unknown) =>
            console.warn('[voice] agent audio playback was blocked by the browser', error),
        );
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      this.setAgentState('reconnecting');
    });

    room.on(RoomEvent.Reconnecting, () => {
      this.setAgentState('reconnecting');
    });

    room.on(RoomEvent.Reconnected, () => {
      this.setAgentState('listening');
    });

    await room.connect(config.url, config.token);
    await room.localParticipant.setMicrophoneEnabled(true);
    this.setAgentState('listening');
  }

  async disconnect(): Promise<void> {
    this.agentAudio?.pause();
    this.agentAudio?.remove();
    this.agentAudio = undefined;
    await this.room?.disconnect();
    this.room = undefined;
    this.setAgentState('unavailable');
  }

  private setAgentState(state: AgentState): void {
    this.agentState = state;
    for (const listener of this.stateListeners) listener(state);
  }
}

/** In-memory client for node tests without WebRTC. */
export class MockVoiceClient implements VoiceClient {
  private agentState: AgentState = 'connecting';
  private connected = false;
  private readonly stateListeners = new Set<(state: AgentState) => void>();
  private readonly toolListeners = new Set<(result: AgentToolResult) => void>();

  getAgentState(): AgentState {
    return this.agentState;
  }

  onAgentState(handler: (state: AgentState) => void): () => void {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  onToolResult(handler: (result: AgentToolResult) => void): () => void {
    this.toolListeners.add(handler);
    return () => this.toolListeners.delete(handler);
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.emitState('connecting');
    this.emitState('listening');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emitState('unavailable');
  }

  /** Test helper: simulate agent state from voice-agent. */
  simulateAgentState(state: AgentState): void {
    if (!this.connected && state !== 'unavailable') return;
    this.emitState(state);
  }

  /** Test helper: simulate tool-result event. */
  simulateToolResult(result: AgentToolResult): void {
    for (const listener of this.toolListeners) listener(result);
  }

  private emitState(state: AgentState): void {
    this.agentState = state;
    for (const listener of this.stateListeners) listener(state);
  }
}
