import { describe, expect, it } from 'vitest';
import { DEFAULT_SAFETY_POLICY, safetyPolicyDocumentSchema } from './policy.js';

describe('safety policy', () => {
  it('validates default policy', () => {
    expect(safetyPolicyDocumentSchema.parse(DEFAULT_SAFETY_POLICY).version).toBe('0.1.0');
  });
});
