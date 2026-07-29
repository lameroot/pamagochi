import { useEffect, useRef } from 'react';
import type { GameBridge } from '../game/bridge/game-bridge.js';
import { createGame } from '../game/createGame.js';

export interface GameCanvasProps {
  bridge: GameBridge;
  activeChildName: string;
}

/** Mounts a Phaser.Game instance into a div and destroys it on unmount. */
export function GameCanvas({ bridge, activeChildName }: GameCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const game = createGame({
      parent: containerRef.current,
      bridge,
      activeChildName,
    });

    return () => {
      game.destroy(true);
    };
    // Intentionally only depends on `bridge`: the Phaser game is created
    // once per bridge instance. `activeChildName` changes are propagated
    // into the running scene via `bridge.sendToGame` below, not by
    // recreating the game (see the bridge documentation for why React must
    // not reach into Phaser state directly).
  }, [bridge]);

  useEffect(() => {
    bridge.sendToGame({ type: 'set-active-child', childName: activeChildName });
  }, [bridge, activeChildName]);

  return (
    <div
      ref={containerRef}
      data-testid="game-canvas-host"
      style={{ width: '100%', maxWidth: 800 }}
    />
  );
}
