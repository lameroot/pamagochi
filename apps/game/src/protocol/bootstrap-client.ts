import { gameBootstrapResponseSchema, type GameBootstrapResponse } from '@pamagochi/contracts';

export function readLimitedGameTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const token = new URLSearchParams(window.location.search).get('token');
  return token?.trim() ? token.trim() : null;
}

export async function fetchGameBootstrap(
  limitedGameToken: string,
  apiBaseUrl?: string,
): Promise<GameBootstrapResponse> {
  const base = (apiBaseUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const response = await fetch(`${base}/api/game/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ limitedGameToken }),
  });
  if (!response.ok) {
    throw new Error('bootstrap_failed');
  }
  const json: unknown = await response.json();
  return gameBootstrapResponseSchema.parse(json);
}
