export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clampToBounds(point: Point, bounds: Bounds): Point {
  if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
    throw new RangeError('Invalid bounds: min must be <= max');
  }
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
  };
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export function applyDirectionalMove(point: Point, direction: Direction, step: number): Point {
  switch (direction) {
    case 'up':
      return { x: point.x, y: point.y - step };
    case 'down':
      return { x: point.x, y: point.y + step };
    case 'left':
      return { x: point.x - step, y: point.y };
    case 'right':
      return { x: point.x + step, y: point.y };
  }
}
