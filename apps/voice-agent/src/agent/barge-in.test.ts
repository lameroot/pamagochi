import { describe, expect, it } from 'vitest';
import { BargeInTracker } from './barge-in.js';

describe('BargeInTracker', () => {
  it('excludes unplayed tail on interrupt', () => {
    const tracker = new BargeInTracker();
    tracker.beginSpeaking('Привет! Я рядом и слушаю.');
    tracker.updatePlayedLength(8);

    const snap = tracker.handleInterrupt();
    expect(snap.wasInterrupted).toBe(true);
    expect(snap.playedTextLength).toBe(8);
    expect(snap.heardText).toBe('Привет! ');
    expect(snap.heardText).not.toContain('слушаю');
  });

  it('ignores duplicate interrupt events', () => {
    const tracker = new BargeInTracker();
    tracker.beginSpeaking('Длинная фраза для теста.');
    tracker.updatePlayedLength(6);

    const first = tracker.handleInterrupt();
    const second = tracker.handleInterrupt();

    expect(first.wasInterrupted).toBe(true);
    expect(second.wasInterrupted).toBe(false);
  });

  it('returns no interrupt when not speaking (pause case)', () => {
    const tracker = new BargeInTracker();
    const snap = tracker.handleInterrupt();
    expect(snap.wasInterrupted).toBe(false);
    expect(snap.heardText).toBe('');
  });

  it('records full text on normal completion', () => {
    const tracker = new BargeInTracker();
    tracker.beginSpeaking('Готово.');
    const snap = tracker.completeSpeaking();
    expect(snap.wasInterrupted).toBe(false);
    expect(snap.heardText).toBe('Готово.');
    expect(snap.playedTextLength).toBe(7);
  });
});
