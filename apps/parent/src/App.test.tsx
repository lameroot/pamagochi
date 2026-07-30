import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('App scaffold', () => {
  it('exports a component', () => {
    expect(typeof App).toBe('function');
  });
});
