import type { IntroState } from './intro-state.js';
import { isIntroCompleted } from './intro-state.js';

export const SHIP_CAPSULE_SCENE_KEY = 'ship-capsule-intro' as const;

export interface IntroWorldContext {
  sceneKey: typeof SHIP_CAPSULE_SCENE_KEY;
  introState: IntroState;
  capsuleOpen: boolean;
  powerRestored: boolean;
  voiceLinkActive: boolean;
  canSeeRoom: boolean;
  canSeeChild: boolean;
  knowsChildIdentity: boolean;
  perceptionNotes: string;
}

const CAPSULE_OPEN_STATES: readonly IntroState[] = [
  'CAPSULE_OPENING',
  'FIRST_MEETING',
  'INTRO_COMPLETED',
];

const POWER_RESTORED_STATES: readonly IntroState[] = [
  'POWER_RESTORED',
  'CAPSULE_OPENING',
  'FIRST_MEETING',
  'INTRO_COMPLETED',
];

const VOICE_ACTIVE_STATES: readonly IntroState[] = [
  'VOICE_CONNECTION_READY',
  'FIRST_VOICE_CONTACT',
  'POWER_CELL_DISCOVERED',
  'POWER_RESTORED',
  'CAPSULE_OPENING',
  'FIRST_MEETING',
  'INTRO_COMPLETED',
];

const SEE_ROOM_STATES: readonly IntroState[] = ['FIRST_MEETING', 'INTRO_COMPLETED'];

function perceptionNotesFor(state: IntroState): string {
  switch (state) {
    case 'SHIP_DARK':
      return 'Ship is dark. You are not connected yet.';
    case 'SHIP_POWERED':
      return 'Ship lights are on. Voice channel is not ready.';
    case 'VOICE_CONNECTION_READY':
      return 'Voice link is ready but you have not spoken with the child yet.';
    case 'FIRST_VOICE_CONTACT':
      return 'You hear a child through the comms but cannot see the room or capsule interior. Do not claim the capsule is open. You do not know their name or whether power is restored.';
    case 'POWER_CELL_DISCOVERED':
      return 'You hear the child. They may be near a power cell. Capsule remains closed; do not describe seeing them.';
    case 'POWER_RESTORED':
      return 'Ship power is restored. Capsule is still closed until the game confirms opening.';
    case 'CAPSULE_OPENING':
      return 'Capsule is opening. You may hear movement; visual contact is not fully established.';
    case 'FIRST_MEETING':
      return 'Capsule is open. You can see the child for the first time. Free conversation — no scripted phrases required.';
    case 'INTRO_COMPLETED':
      return 'First meeting is complete.';
    default:
      return 'Unknown intro state.';
  }
}

/** Validated world snapshot for PromptAssembler — never trust LLM text for these flags. */
export function introWorldContextFor(state: IntroState): IntroWorldContext {
  return {
    sceneKey: SHIP_CAPSULE_SCENE_KEY,
    introState: state,
    capsuleOpen: CAPSULE_OPEN_STATES.includes(state),
    powerRestored: POWER_RESTORED_STATES.includes(state),
    voiceLinkActive: VOICE_ACTIVE_STATES.includes(state),
    canSeeRoom: SEE_ROOM_STATES.includes(state),
    canSeeChild: SEE_ROOM_STATES.includes(state),
    knowsChildIdentity: isIntroCompleted(state),
    perceptionNotes: perceptionNotesFor(state),
  };
}

export function introRoleDescriptionFor(state: IntroState): string {
  const base =
    'You are Pamagochi, a warm voice inside a spaceship rescue capsule. Speak briefly in the child language.';
  if (state === 'FIRST_VOICE_CONTACT' || state === 'POWER_CELL_DISCOVERED') {
    return `${base} You hear the child but cannot see them or the room. Never say the capsule is open. Never invent their name.`;
  }
  if (state === 'POWER_RESTORED' || state === 'CAPSULE_OPENING') {
    return `${base} Wait for the game to open the capsule — you cannot open it yourself.`;
  }
  if (state === 'FIRST_MEETING') {
    return `${base} The capsule is open and you meet the child. Be curious and kind; no menu choices or magic phrases.`;
  }
  return base;
}
