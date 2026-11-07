/** "expires in 23 h" / "expires in 40 min" / "expired" for an invite. */
export function formatExpiresIn(expiresAt: string, now = Date.now()): string {
  const minutes = Math.floor((new Date(expiresAt).getTime() - now) / 60_000);
  if (minutes <= 0) return 'expired';
  if (minutes < 60) return `expires in ${minutes} min`;
  return `expires in ${Math.floor(minutes / 60)} h`;
}

/** The shareable link for an invite token, on whatever host the app runs. */
export function inviteLink(token: string): string {
  return `${window.location.origin}/duel/invite/${token}`;
}
