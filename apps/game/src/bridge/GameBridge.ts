import type { GameCommand, GameEvent } from './game-events.js';

type Listener<T> = (event: T) => void;

/** Typed, scene-agnostic boundary for future React HUD and Phaser runtime. */
export class GameBridge {
  private readonly commandListeners = new Set<Listener<GameCommand>>();
  private readonly eventListeners = new Set<Listener<GameEvent>>();

  sendCommand(command: GameCommand): void {
    for (const listener of this.commandListeners) listener(command);
  }

  onCommand(listener: Listener<GameCommand>): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  emit(event: GameEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }

  onEvent(listener: Listener<GameEvent>): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
}
