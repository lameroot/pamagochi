import type { DialogueResponse } from '../adapters/dialogue/DialogueProvider.js';

export const mockDialogues: Record<string, DialogueResponse> = {
  window: {
    text: 'Это Земля? Она гораздо ярче, чем на старых картах.',
    emotion: 'curious',
    actions: [
      { type: 'look', targetId: 'window' },
      {
        type: 'speak',
        text: 'Это Земля? Она гораздо ярче, чем на старых картах.',
        emotion: 'curious',
      },
    ],
  },
  console: {
    text: 'Кажется, корабль тоже ничего не помнит.',
    emotion: 'tired',
    actions: [
      { type: 'interact', objectId: 'console' },
      { type: 'speak', text: 'Кажется, корабль тоже ничего не помнит.', emotion: 'tired' },
    ],
  },
  container: {
    text: 'Смотри, здесь сохранилась маленькая звёздная карта!',
    emotion: 'excited',
    actions: [{ type: 'interact', objectId: 'container' }],
  },
  egg_remains: {
    text: 'Это был мой дом, пока я спал. Спасибо, что разбудил меня.',
    emotion: 'happy',
    actions: [{ type: 'look', targetId: 'egg_remains' }],
  },
};
