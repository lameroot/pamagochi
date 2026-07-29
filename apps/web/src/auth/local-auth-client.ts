import { webEnv } from '../lib/env.js';
import type { AuthClient } from './auth-client.js';

const STORAGE_KEY = 'pamagochi.local.devToken';

interface StoredToken {
  accessToken: string;
  expiresAtMs: number;
}

function decodeExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : Date.now() + 60_000;
  } catch {
    return Date.now() + 60_000;
  }
}

/**
 * Local-profile auth adapter: fetches a short-lived dev JWT from
 * `/api/dev/login` and stores it in sessionStorage, scoped to the current
 * local origin only, refreshing automatically on expiry.
 */
export class LocalAuthClient implements AuthClient {
  readonly mode = 'local' as const;

  isDevMode(): boolean {
    return true;
  }

  private readStoredToken(): StoredToken | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredToken;
    } catch {
      return null;
    }
  }

  private writeStoredToken(token: StoredToken): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token));
  }

  private async fetchNewToken(): Promise<StoredToken> {
    const response = await fetch(`${webEnv.apiUrl}/api/dev/login`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Failed to obtain local dev token (status ${response.status})`);
    }
    const body = (await response.json()) as { accessToken: string };
    const token: StoredToken = {
      accessToken: body.accessToken,
      expiresAtMs: decodeExpiry(body.accessToken),
    };
    this.writeStoredToken(token);
    return token;
  }

  async getAccessToken(): Promise<string | null> {
    const existing = this.readStoredToken();
    const safetyMarginMs = 5_000;
    if (existing && existing.expiresAtMs - safetyMarginMs > Date.now()) {
      return existing.accessToken;
    }
    const fresh = await this.fetchNewToken();
    return fresh.accessToken;
  }
}
