import { describe, expect, it } from 'vitest';
import { PetStateMachine } from './PetStateMachine.js';
describe('PetStateMachine', () => {
  it('allows only declared state transitions and safely interrupts to idle', () => {
    const machine = new PetStateMachine();
    expect(machine.transition('idle')).toBe(true);
    expect(machine.transition('walking')).toBe(true);
    expect(machine.transition('sleeping')).toBe(false);
    expect(machine.interrupt()).toBe('idle');
  });
});
