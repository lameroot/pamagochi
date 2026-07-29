import { z } from 'zod';
import type { IntroState } from './intro-state.js';

export const sceneAllowlistSchema = z.object({
  sceneKey: z.string().min(1).max(64),
  state: z.string().min(1).max(64),
  visibleObjectIds: z.array(z.string().max(64)).max(64),
  interactiveObjectIds: z.array(z.string().max(64)).max(64),
  allowedEventIds: z.array(z.string().max(64)).max(64),
  allowedToolNames: z.array(z.string().max(64)).max(32),
});
export type SceneAllowlist = z.infer<typeof sceneAllowlistSchema>;

/** Minimal allowlists for the talking-light technical scene (E1). */
export function talkingLightAllowlist(): SceneAllowlist {
  return {
    sceneKey: 'talking-light',
    state: 'READY',
    visibleObjectIds: ['talking_light'],
    interactiveObjectIds: ['talking_light'],
    allowedEventIds: [],
    allowedToolNames: ['character_emote'],
  };
}

/** Placeholder allowlist table for intro scene; filled in E5. */
export function introAllowlistFor(state: IntroState): SceneAllowlist {
  const baseTools = [
    'character_emote',
    'character_look_at',
    'character_gesture',
    'scene_highlight_object',
    'scene_request_event',
    'request_parent_attention',
  ];
  return {
    sceneKey: 'ship-capsule-intro',
    state,
    visibleObjectIds: ['capsule', 'power_cell', 'ship_console'],
    interactiveObjectIds:
      state === 'SHIP_DARK' ? ['ship_console'] : ['capsule', 'power_cell', 'ship_console'],
    allowedEventIds:
      state === 'POWER_RESTORED'
        ? ['OPEN_CAPSULE']
        : state === 'POWER_CELL_DISCOVERED'
          ? ['RESTORE_POWER']
          : [],
    allowedToolNames: baseTools,
  };
}
