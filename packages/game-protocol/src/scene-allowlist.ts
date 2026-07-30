import { z } from 'zod';
import type { IntroState } from './intro-state.js';
import { introEventAllowedInState } from './scene-events.js';

export const sceneAllowlistSchema = z.object({
  sceneKey: z.string().min(1).max(64),
  state: z.string().min(1).max(64),
  visibleObjectIds: z.array(z.string().max(64)).max(64),
  interactiveObjectIds: z.array(z.string().max(64)).max(64),
  allowedEventIds: z.array(z.string().max(64)).max(64),
  allowedToolNames: z.array(z.string().max(64)).max(32),
  allowedGestureIds: z.array(z.string().max(64)).max(16).optional(),
});
export type SceneAllowlist = z.infer<typeof sceneAllowlistSchema>;

const INTRO_BASE_TOOLS = [
  'character_emote',
  'character_look_at',
  'character_gesture',
  'scene_highlight_object',
  'scene_request_event',
  'request_parent_attention',
] as const;

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

function introObjectsFor(state: IntroState): {
  visible: string[];
  interactive: string[];
  gestures: string[];
  tools: string[];
} {
  const ship = ['ship_hull', 'ship_floor', 'ambient_panel'];
  const capsule = ['capsule', 'capsule_glass', 'voice_light'];
  const console = ['ship_console'];
  const power = ['power_cell', 'power_slot'];
  const character = ['character'];

  switch (state) {
    case 'SHIP_DARK':
      return {
        visible: [...ship, 'capsule'],
        interactive: ['ship_console'],
        gestures: [],
        tools: ['scene_highlight_object', 'request_parent_attention'],
      };
    case 'SHIP_POWERED':
      return {
        visible: [...ship, ...capsule, ...console],
        interactive: ['ship_console'],
        gestures: [],
        tools: ['character_emote', 'scene_highlight_object', 'request_parent_attention'],
      };
    case 'VOICE_CONNECTION_READY':
      return {
        visible: [...ship, ...capsule, ...console, 'voice_indicator'],
        interactive: ['ship_console'],
        gestures: [],
        tools: [
          'character_emote',
          'character_look_at',
          'scene_highlight_object',
          'request_parent_attention',
        ],
      };
    case 'FIRST_VOICE_CONTACT':
      return {
        visible: [...ship, ...capsule, 'voice_indicator'],
        interactive: ['power_cell_hidden'],
        gestures: ['nod'],
        tools: [
          'character_emote',
          'character_gesture',
          'scene_highlight_object',
          'request_parent_attention',
        ],
      };
    case 'POWER_CELL_DISCOVERED':
      return {
        visible: [...ship, ...capsule, ...power],
        interactive: [...power, 'power_slot'],
        gestures: ['nod', 'point'],
        tools: [
          'character_emote',
          'character_gesture',
          'character_look_at',
          'scene_highlight_object',
          'scene_request_event',
          'request_parent_attention',
        ],
      };
    case 'POWER_RESTORED':
      return {
        visible: [...ship, ...capsule, ...power, 'capsule_seal'],
        interactive: ['capsule', 'power_slot'],
        gestures: ['nod', 'point'],
        tools: [
          'character_emote',
          'character_gesture',
          'character_look_at',
          'scene_highlight_object',
          'scene_request_event',
          'request_parent_attention',
        ],
      };
    case 'CAPSULE_OPENING':
      return {
        visible: [...ship, ...capsule, ...character],
        interactive: ['capsule'],
        gestures: ['wave', 'nod'],
        tools: [
          'character_emote',
          'character_gesture',
          'character_look_at',
          'scene_highlight_object',
          'request_parent_attention',
        ],
      };
    case 'FIRST_MEETING':
      return {
        visible: [...ship, ...capsule, ...character],
        interactive: ['character', 'capsule'],
        gestures: ['wave', 'nod', 'point', 'look_around'],
        tools: [...INTRO_BASE_TOOLS],
      };
    case 'INTRO_COMPLETED':
      return {
        visible: [...ship, ...character],
        interactive: ['character'],
        gestures: ['wave', 'nod'],
        tools: ['character_emote', 'character_gesture', 'request_parent_attention'],
      };
    default:
      return { visible: ship, interactive: [], gestures: [], tools: ['request_parent_attention'] };
  }
}

function allowedEventsFor(state: IntroState): string[] {
  return ['RESTORE_POWER', 'OPEN_CAPSULE', 'COMPLETE_INTRO'].filter((eventId) =>
    introEventAllowedInState(state, eventId),
  );
}

/** Per-state allowlists for ship-capsule intro (E5.4). */
export function introAllowlistFor(state: IntroState): SceneAllowlist {
  const objects = introObjectsFor(state);
  return {
    sceneKey: 'ship-capsule-intro',
    state,
    visibleObjectIds: objects.visible,
    interactiveObjectIds: objects.interactive,
    allowedEventIds: allowedEventsFor(state),
    allowedToolNames: objects.tools,
    allowedGestureIds: objects.gestures.length > 0 ? objects.gestures : undefined,
  };
}
