import { nanoid } from 'nanoid';
import type { AssetOwnerKind } from '@pamagochi/contracts';

/** Strips anything that is not alphanumeric, dot, dash or underscore. */
export function sanitizeFileNameSegment(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'file';
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.slice(-100) || 'file';
}

/**
 * Builds a namespaced, collision-resistant object key. Object ids are
 * generated server-side (nanoid) — never derived from client input alone —
 * which also prevents path traversal since no user input becomes a path
 * segment by itself.
 */
export function buildObjectKey(
  ownerKind: AssetOwnerKind,
  ownerId: string,
  fileName: string,
): string {
  const objectId = nanoid();
  const safeName = sanitizeFileNameSegment(fileName);
  const namespace = ownerKind === 'parent' ? 'users' : 'children';
  return `${namespace}/${ownerId}/generated/${objectId}-${safeName}`;
}

/**
 * Defence in depth against path traversal: normalizes the key and rejects
 * it if normalization changes it or it tries to escape the storage root.
 */
export function assertSafeObjectKey(key: string): void {
  if (key.length === 0 || key.length > 512) {
    throw new Error('Object key has invalid length');
  }
  if (key.startsWith('/') || key.includes('\\')) {
    throw new Error('Object key must be a relative, forward-slash path');
  }

  const segments = key.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new Error('Object key contains an invalid path segment');
    }
  }
}
