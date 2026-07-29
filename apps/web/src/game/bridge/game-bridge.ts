import type { GameToReactEvent, ReactToGameEvent } from '@pamagochi/contracts';

type Listener<T> = (event: T) => void;

/**
 * The only channel through which React and Phaser communicate. React must
 * never reach into a Phaser Scene to mutate its state directly, and Phaser
 * must never reach into React state — both sides only ever exchange the
 * typed events declared in `@pamagochi/contracts`.
 */
export class GameBridge {
  private readonly reactToGameListeners = new Set<Listener<ReactToGameEvent>>();
  private readonly gameToReactListeners = new Set<Listener<GameToReactEvent>>();

  /** Called by React to send a command into the running Phaser scene. */
  sendToGame(event: ReactToGameEvent): void {
    for (const listener of this.reactToGameListeners) listener(event);
  }

  /** Subscribed to from inside Phaser (never from React). */
  onReactToGameEvent(listener: Listener<ReactToGameEvent>): () => void {
    this.reactToGameListeners.add(listener);
    return () => this.reactToGameListeners.delete(listener);
  }

  /** Called by Phaser Scenes to notify React of something that happened in-game. */
  sendToReact(event: GameToReactEvent): void {
    for (const listener of this.gameToReactListeners) listener(event);
  }

  /** Subscribed to from inside React (never from Phaser). */
  onGameToReactEvent(listener: Listener<GameToReactEvent>): () => void {
    this.gameToReactListeners.add(listener);
    return () => this.gameToReactListeners.delete(listener);
  }
}

export function createGameBridge(): GameBridge {
  return new GameBridge();
}
