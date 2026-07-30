import { createGame } from './createGame.js';

const parent = document.getElementById('game');
if (!parent) throw new Error('game_mount_missing');

// This standalone entrypoint is intentionally Phaser-only. The React app uses
// its own lifecycle wrapper in apps/web; neither entrypoint mutates the other.
createGame(parent);
