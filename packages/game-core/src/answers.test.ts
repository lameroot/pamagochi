import { describe, expect, it } from 'vitest';
import { isAnswerCorrect } from './answers.js';

describe('isAnswerCorrect', () => {
  it('is case-insensitive by default', () => {
    expect(isAnswerCorrect({ expected: 'Cat', actual: 'cat' })).toBe(true);
  });

  it('trims and collapses whitespace', () => {
    expect(isAnswerCorrect({ expected: 'cat', actual: '  cat  ' })).toBe(true);
    expect(isAnswerCorrect({ expected: 'big cat', actual: 'big   cat' })).toBe(true);
  });

  it('respects caseSensitive flag', () => {
    expect(isAnswerCorrect({ expected: 'Cat', actual: 'cat', caseSensitive: true })).toBe(false);
  });
});
