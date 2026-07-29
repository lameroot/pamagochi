import type { AgeBand } from '@pamagochi/contracts';

/**
 * Convert birth year/date to a coarse age band for game bootstrap.
 * Never expose full birth date to apps/game or voice-agent.
 */
export function ageBandFromBirth(input: {
  birthYear?: number | null;
  birthDate?: Date | null;
  now?: Date;
}): AgeBand {
  const now = input.now ?? new Date();
  let age: number | null = null;

  if (input.birthDate) {
    age = now.getUTCFullYear() - input.birthDate.getUTCFullYear();
    const hadBirthday =
      now.getUTCMonth() > input.birthDate.getUTCMonth() ||
      (now.getUTCMonth() === input.birthDate.getUTCMonth() &&
        now.getUTCDate() >= input.birthDate.getUTCDate());
    if (!hadBirthday) age -= 1;
  } else if (input.birthYear != null) {
    age = now.getUTCFullYear() - input.birthYear;
  }

  if (age == null || age < 6) return '3-5';
  if (age < 9) return '6-8';
  return '9-12';
}
