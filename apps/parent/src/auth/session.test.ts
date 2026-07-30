import { describe, expect, it, beforeEach, vi } from 'vitest';
import { clearSession, getSession, setSession } from './session.js';

describe('parent session storage', () => {
  beforeEach(() => {
    clearSession();
    localStorage.clear();
  });

  it('stores token in memory and localStorage', () => {
    setSession('test-token', 900);
    expect(getSession()?.accessToken).toBe('test-token');
    expect(localStorage.getItem('pamagochi.parent.session')).toContain('test-token');
  });

  it('clears expired sessions', () => {
    vi.useFakeTimers();
    setSession('expired', 1);
    vi.advanceTimersByTime(10_000);
    expect(getSession()).toBeNull();
    vi.useRealTimers();
  });

  it('clearSession removes stored data', () => {
    setSession('token', 900);
    clearSession();
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('pamagochi.parent.session')).toBeNull();
  });
});
