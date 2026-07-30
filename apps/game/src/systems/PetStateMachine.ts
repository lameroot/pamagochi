export const PET_STATES = [
  'spawning',
  'idle',
  'walking',
  'listening',
  'thinking',
  'speaking',
  'curious',
  'happy',
  'afraid',
  'tired',
  'sleeping',
  'interacting',
] as const;
export type PetState = (typeof PET_STATES)[number];

const TRANSITIONS: Record<PetState, readonly PetState[]> = {
  spawning: ['idle', 'afraid'],
  idle: [
    'walking',
    'listening',
    'thinking',
    'speaking',
    'curious',
    'happy',
    'afraid',
    'tired',
    'sleeping',
    'interacting',
  ],
  walking: ['idle', 'interacting', 'afraid'],
  listening: ['idle', 'thinking', 'speaking'],
  thinking: ['idle', 'speaking', 'afraid'],
  speaking: ['idle', 'listening'],
  curious: ['idle', 'walking', 'interacting'],
  happy: ['idle', 'walking'],
  afraid: ['idle', 'walking'],
  tired: ['idle', 'sleeping'],
  sleeping: ['idle'],
  interacting: ['idle', 'speaking', 'happy', 'curious'],
};

export class PetStateMachine {
  private state: PetState;
  constructor(initial: PetState = 'spawning') {
    this.state = initial;
  }
  getState(): PetState {
    return this.state;
  }
  transition(next: PetState): boolean {
    if (!TRANSITIONS[this.state].includes(next)) return false;
    this.state = next;
    return true;
  }
  interrupt(): PetState {
    this.state = 'idle';
    return this.state;
  }
}
