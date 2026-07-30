const STORAGE_KEY = 'pamagochi.parent.session';

export interface ParentSession {
  accessToken: string;
  expiresAt: number;
}

let memorySession: ParentSession | null = null;

function readStored(): ParentSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParentSession;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(session: ParentSession | null): void {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): ParentSession | null {
  if (memorySession && memorySession.expiresAt > Date.now()) {
    return memorySession;
  }
  const stored = readStored();
  if (stored && stored.expiresAt > Date.now()) {
    memorySession = stored;
    return stored;
  }
  clearSession();
  return null;
}

export function setSession(accessToken: string, expiresInSeconds: number): ParentSession {
  const session: ParentSession = {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000 - 5000,
  };
  memorySession = session;
  writeStored(session);
  return session;
}

export function clearSession(): void {
  memorySession = null;
  writeStored(null);
}

export function getAccessToken(): string | null {
  return getSession()?.accessToken ?? null;
}
