import { describe, expect, it, vi } from 'vitest';
import { InlineJobDispatcher } from './inline-job-dispatcher.js';

describe('InlineJobDispatcher', () => {
  it('runs the registered handler synchronously in-process', async () => {
    const dispatcher = new InlineJobDispatcher();
    const handler = vi.fn();
    dispatcher.registerHandler<{ value: number }>('sum', handler);

    const result = await dispatcher.dispatch('sum', { value: 42 });

    expect(handler).toHaveBeenCalledWith({ value: 42 });
    expect(result.status).toBe('completed');
  });

  it('reports failure when no handler is registered', async () => {
    const dispatcher = new InlineJobDispatcher();
    const result = await dispatcher.dispatch('missing', {});
    expect(result.status).toBe('failed');
  });

  it('reports failure when the handler throws', async () => {
    const dispatcher = new InlineJobDispatcher();
    dispatcher.registerHandler('boom', () => {
      throw new Error('boom');
    });
    const result = await dispatcher.dispatch('boom', {});
    expect(result.status).toBe('failed');
  });
});
