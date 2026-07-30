import { authTokenResponseSchema } from '@pamagochi/contracts';
import { clearSession, getAccessToken, setSession } from '../auth/session.js';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiBase(): string {
  return import.meta.env.VITE_API_URL ?? '';
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join('; ');
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function devLogin(): Promise<void> {
  const response = await fetch(`${apiBase()}/api/dev/login`, { method: 'POST' });
  if (!response.ok) {
    throw new ApiError('Dev login failed', response.status);
  }
  const body = authTokenResponseSchema.parse(await response.json());
  setSession(body.accessToken, body.expiresIn);
}

export async function devRegister(email: string): Promise<void> {
  const response = await fetch(`${apiBase()}/api/dev/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new ApiError('Registration failed', response.status);
  }
  const body = authTokenResponseSchema.parse(await response.json());
  setSession(body.accessToken, body.expiresIn);
}

export function logout(): void {
  clearSession();
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export function appProfile(): string {
  return import.meta.env.VITE_APP_PROFILE ?? 'local';
}

export function gameLaunchUrl(launchPath: string): string {
  const base = import.meta.env.VITE_GAME_URL ?? 'http://localhost:5174';
  const normalized = launchPath.startsWith('/') ? launchPath : `/${launchPath}`;
  return `${base.replace(/\/$/, '')}${normalized}`;
}
