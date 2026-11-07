/**
 * Remembers which duels already played their "You VS Opponent" intro in this
 * browser, so a refresh or re-opening the duel doesn't replay it.
 */
const STORAGE_KEY = 'wordle.duelIntrosSeen';
const MAX_REMEMBERED = 50;

export function loadSeenIntros(): Set<number> {
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(ids) ? ids.map(Number) : []);
  } catch {
    return new Set();
  }
}

export function rememberIntroSeen(seen: Set<number>, duelId: number): Set<number> {
  const next = new Set([...seen, duelId].slice(-MAX_REMEMBERED));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Storage unavailable: the intro may replay after a refresh, nothing worse.
  }
  return next;
}
