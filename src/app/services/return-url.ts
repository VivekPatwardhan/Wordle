/**
 * Remembers where to go after signing in — e.g. back to an invite link after a
 * new player registers. Uses localStorage so it also survives the email
 * magic link, which opens in a new tab.
 */
const STORAGE_KEY = 'wordle.returnUrl';
const MAX_AGE_MS = 60 * 60 * 1000;

/** Only same-app paths: "/duel/…", never "//evil.com" or "https://…". */
export function isSafeReturnUrl(url: unknown): url is string {
  return typeof url === 'string'
    && url.startsWith('/')
    && !url.startsWith('//')
    && !url.startsWith('/\\');
}

export function rememberReturnUrl(url: string): void {
  if (!isSafeReturnUrl(url) || url === '/') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, savedAt: Date.now() }));
  } catch {
    // Storage unavailable (private mode etc.): the player just lands on Home.
  }
}

/** Returns the remembered URL once (it is cleared), or null if none / too old. */
export function takeReturnUrl(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const { url, savedAt } = JSON.parse(raw);
    return isSafeReturnUrl(url) && Date.now() - Number(savedAt) < MAX_AGE_MS ? url : null;
  } catch {
    return null;
  }
}
