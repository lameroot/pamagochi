import { describe, expect, it, vi } from 'vitest';
import { createGameBridge } from './game-bridge.js';

describe('GameBridge', () => {
  it('delivers React -> Game events only to game-side listeners', () => {
    const bridge = createGameBridge();
    const gameListener = vi.fn();
    const reactListener = vi.fn();
    bridge.onReactToGameEvent(gameListener);
    bridge.onGameToReactEvent(reactListener);

    bridge.sendToGame({ type: 'set-active-child', childName: 'Alex' });

    expect(gameListener).toHaveBeenCalledWith({ type: 'set-active-child', childName: 'Alex' });
    expect(reactListener).not.toHaveBeenCalled();
  });

  it('delivers Game -> React events only to react-side listeners', () => {
    const bridge = createGameBridge();
    const gameListener = vi.fn();
    const reactListener = vi.fn();
    bridge.onReactToGameEvent(gameListener);
    bridge.onGameToReactEvent(reactListener);

    bridge.sendToReact({ type: 'scene-ready', sceneKey: 'main' });

    expect(reactListener).toHaveBeenCalledWith({ type: 'scene-ready', sceneKey: 'main' });
    expect(gameListener).not.toHaveBeenCalled();
  });

  it('allows unsubscribing', () => {
    const bridge = createGameBridge();
    const listener = vi.fn();
    const unsubscribe = bridge.onGameToReactEvent(listener);
    unsubscribe();

    bridge.sendToReact({ type: 'scene-ready', sceneKey: 'main' });

    expect(listener).not.toHaveBeenCalled();
  });
});
