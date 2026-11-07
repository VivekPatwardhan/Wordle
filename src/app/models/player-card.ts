export interface PlayerRecord {
  played: number;
  won: number;
  winRate: number;
}

export interface HeadToHead {
  won: number;
  lost: number;
  drawn: number;
}

/** Another player's basic records and achievements (friends and opponents only). */
export interface PlayerCard {
  userId: number;
  username: string;
  memberSince: string | null;
  solo: PlayerRecord & { bestStreak: number };
  duel: PlayerRecord;
  race: PlayerRecord;
  achievements: {
    unlockedCount: number;
    totalCount: number;
    unlocked: { key: string; icon: string; title: string; description: string; unlockedAt: string }[];
  };
  /** Your record against them; null on your own card. */
  headToHead: { duel: HeadToHead; race: HeadToHead } | null;
}
