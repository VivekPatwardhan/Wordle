export type StatsMode = 'all' | 'daily' | 'practice';

export interface PlayerStats {
  mode: StatsMode;
  played: number;
  won: number;
  lost: number;
  /** Whole percentage, 0–100. */
  winRate: number;
  /** Average guesses over won games, or null with no wins yet. */
  averageGuesses: number | null;
  /** Wins in 1..6 guesses (index 0 = solved in one). */
  guessDistribution: number[];
  openingWord: { word: string; timesUsed: number } | null;
  /** Daily-mode win streaks, regardless of the selected mode. */
  streak: { current: number; best: number };
}

export interface PlayerStatsResponse {
  stats: PlayerStats;
}

/* ---------------- PvP ---------------- */

export interface PvpStats {
  mode: 'duel' | 'race';
  /** Duels (or races) played / won / lost / drawn. */
  duels: { played: number; won: number; lost: number; drawn: number; forfeits: number; winRate: number };
  /** Duel mode only. */
  asGuesser?: { rounds: number; solved: number; solveRate: number; averageGuesses: number | null };
  asSetter?: { rounds: number; survived: number; survivalRate: number };
  /** Race mode only. */
  raceRounds?: {
    rounds: number;
    won: number;
    drawn: number;
    winRate: number;
    averageGuesses: number | null;
    fastestSolve: number | null;
  };
  headToHead: {
    userId: number;
    username: string;
    won: number;
    lost: number;
    drawn: number;
    lastPlayedAt: string;
  }[];
  recent: {
    duelId: number;
    source: 'random' | 'invite' | 'direct';
    totalRounds: number;
    result: 'won' | 'lost' | 'draw' | 'forfeit';
    myRounds: number;
    opponentRounds: number;
    opponent: { userId: number; username: string };
    finishedAt: string;
  }[];
}

export interface PvpStatsResponse {
  stats: PvpStats;
}
