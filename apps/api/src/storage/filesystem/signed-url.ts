import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignedUrlParams {
  key: string;
  method: 'GET' | 'PUT';
  expiresAtEpochSeconds: number;
}

function computeSignature(secret: string, params: SignedUrlParams): string {
  const message = `${params.method}:${params.key}:${params.expiresAtEpochSeconds}`;
  return createHmac('sha256', secret).update(message).digest('hex');
}

export function signUrlParams(secret: string, params: SignedUrlParams): string {
  return computeSignature(secret, params);
}

export function verifyUrlSignature(
  secret: string,
  params: SignedUrlParams,
  providedSignature: string,
): boolean {
  if (Date.now() / 1000 > params.expiresAtEpochSeconds) {
    return false;
  }

  const expected = computeSignature(secret, params);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(providedSignature, 'hex');
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
