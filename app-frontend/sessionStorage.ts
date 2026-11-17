const sessionKey = 'doodledungeon.session';

export async function loadSession(): Promise<string | null> {
  return window.localStorage.getItem(sessionKey);
}

export async function saveSession(session: string): Promise<void> {
  window.localStorage.setItem(sessionKey, session);
}

export async function clearSession(): Promise<void> {
  window.localStorage.removeItem(sessionKey);
}
