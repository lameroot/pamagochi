import { describe, expect, it } from 'vitest';
import { applyDirectionalMove, clampToBounds } from './coordinates.js';

const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

describe('clampToBounds', () => {
  it('keeps points inside bounds unchanged', () => {
    expect(clampToBounds({ x: 50, y: 50 }, bounds)).toEqual({ x: 50, y: 50 });
  });

  it('clamps points outside bounds', () => {
    expect(clampToBounds({ x: -10, y: 200 }, bounds)).toEqual({ x: 0, y: 100 });
  });

  it('throws on invalid bounds', () => {
    expect(() => clampToBounds({ x: 1, y: 1 }, { minX: 10, maxX: 0, minY: 0, maxY: 10 })).toThrow();
  });
});

describe('applyDirectionalMove', () => {
  it('moves in each of the four directions', () => {
    const origin = { x: 10, y: 10 };
    expect(applyDirectionalMove(origin, 'up', 5)).toEqual({ x: 10, y: 5 });
    expect(applyDirectionalMove(origin, 'down', 5)).toEqual({ x: 10, y: 15 });
    expect(applyDirectionalMove(origin, 'left', 5)).toEqual({ x: 5, y: 10 });
    expect(applyDirectionalMove(origin, 'right', 5)).toEqual({ x: 15, y: 10 });
  });
});
