import { describe, expect, it } from 'vitest';
import { MAX_SCENE_SPEC_BYTES, parseSceneSpec } from './scene-spec.js';

const validScene = {
  version: 1,
  title: 'Meadow',
  backgroundAssetKey: 'bg_meadow',
  objects: [{ id: 'obj-1', assetKey: 'char_fox', x: 100, y: 100, scale: 1, rotationDegrees: 0 }],
};

describe('parseSceneSpec', () => {
  it('accepts a valid scene', () => {
    const result = parseSceneSpec(JSON.stringify(validScene));
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = parseSceneSpec('not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('invalid_json');
  });

  it('rejects payloads exceeding the size limit', () => {
    const huge = JSON.stringify({ ...validScene, title: 'x'.repeat(MAX_SCENE_SPEC_BYTES) });
    const result = parseSceneSpec(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('too_large');
  });

  it('rejects disallowed asset keys', () => {
    const result = parseSceneSpec(JSON.stringify({ ...validScene, backgroundAssetKey: 'evil.js' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('schema_error');
  });

  it('rejects more objects than allowed', () => {
    const objects = Array.from({ length: 41 }, (_, i) => ({
      id: `obj-${i}`,
      assetKey: 'prop_star',
      x: 1,
      y: 1,
      scale: 1,
      rotationDegrees: 0,
    }));
    const result = parseSceneSpec(JSON.stringify({ ...validScene, objects }));
    expect(result.ok).toBe(false);
  });

  it('rejects object ids containing script-like characters', () => {
    const result = parseSceneSpec(
      JSON.stringify({
        ...validScene,
        objects: [{ ...validScene.objects[0], id: '<script>' }],
      }),
    );
    expect(result.ok).toBe(false);
  });
});
