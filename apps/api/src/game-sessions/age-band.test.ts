import { describe, expect, it } from 'vitest';
import { ageBandFromBirth } from './age-band.js';

describe('ageBandFromBirth', () => {
  const now = new Date('2026-07-29T00:00:00.000Z');

  it('maps birth year into bands without exposing exact age', () => {
    expect(ageBandFromBirth({ birthYear: 2023, now })).toBe('3-5');
    expect(ageBandFromBirth({ birthYear: 2019, now })).toBe('6-8');
    expect(ageBandFromBirth({ birthYear: 2015, now })).toBe('9-12');
  });

  it('defaults young when birth data is missing', () => {
    expect(ageBandFromBirth({ now })).toBe('3-5');
  });
});
