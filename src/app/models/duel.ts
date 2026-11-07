import { LetterFeedback } from './game';

/** Duel: you set the word for each other, swapping each round. Race: same word, first to solve wins. */
export type PvpMode = 'duel' | 'race';

export type RoundCount = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10;
export const ROUND_OPTIONS: readonly RoundCount[] = [2, 4, 6, 8, 10];
/** Round choices per mode: duels need an even count (both set equally often); races are best of 1, 3 or 5. */
export const ROUND_OPTIONS_BY_MODE: Record<PvpMode, readonly RoundCount[]> = {
  duel: [2, 4, 6, 8, 10],
  race: [1, 3, 5],
};

/** Where a duel stands, as the lobby shows it. 'in_play'/'finished' come with the round loop. */
export type LobbyState =
  | 'waiting_for_opponent'
  | 'ready'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'in_play'
  | 'finished';

export interface DuelPlayer {
  userId: number;
  username: string;
  seat: 1 | 2;
}

export interface Duel {
  id: number;
  source: 'random' | 'invite' | 'direct';
  mode: PvpMode;
  status: 'waiting' | 'setting' | 'guessing' | 'finished' | 'abandoned';
  lobbyState: LobbyState;
  totalRounds: number;
  currentRound: number;
  createdAt: string;
  startedAt: string | null;
  isCreator: boolean;
  players: DuelPlayer[];
  /** Only for the creator while nobody has answered: the link to share. */
  invite: { token: string; expiresAt: string; isLink: boolean } | null;
  /** The round loop; null until both players are in. */
  game: DuelGame | RaceGame | null;
}

export interface PlayerRef {
  userId: number;
  username: string;
}

export interface IncomingInvite {
  mode: PvpMode;
  token: string;
  duelId: number;
  inviter: PlayerRef;
  totalRounds: number;
  expiresAt: string;
}

export interface OutgoingInvite {
  mode: PvpMode;
  duelId: number;
  totalRounds: number;
  expiresAt: string;
  /** null for a shareable link. */
  invitee: PlayerRef | null;
}

export interface ActiveDuel {
  mode: PvpMode;
  duelId: number;
  totalRounds: number;
  opponent: PlayerRef | null;
}

export interface PreviousOpponent {
  userId: number;
  username: string;
  won: number;
  lost: number;
  drawn: number;
  lastPlayedAt: string;
}

export interface DuelHub {
  incoming: IncomingInvite[];
  outgoing: OutgoingInvite[];
  active: ActiveDuel[];
  opponents: PreviousOpponent[];
}

export interface InvitePreview {
  mode: PvpMode;
  inviter: { username: string };
  totalRounds: number;
  expiresAt: string;
  state: 'open' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  viewerRole: 'guest' | 'inviter' | 'invitee' | 'not_for_you';
  /** Only for people in the duel. */
  duelId: number | null;
}

export interface DuelResponse {
  duel: Duel;
}

export interface CreateDuelRequest {
  mode?: PvpMode;
  totalRounds: RoundCount;
  /** Set for a direct invite to a previous opponent; omit for a shareable link. */
  opponentId?: number;
}

/* ---------------- Round loop ---------------- */

export type RoundStatus = 'setting' | 'guessing' | 'solved' | 'failed' | 'forfeited' | 'timed_out';

export interface DuelGuess {
  word: string;
  feedback: LetterFeedback[];
}

export interface DuelRound {
  number: number;
  setterId: number;
  guesserId: number;
  status: RoundStatus;
  winnerId: number | null;
  /** The setter always sees it; the guesser only once the round is over. */
  secretWord: string | null;
  guesses: DuelGuess[];
}

export interface CurrentRound extends DuelRound {
  /** Time left in this phase, measured by the server when the view was sent. */
  msLeft: number | null;
  /** Full length of this phase (60 s / 70 s to set, 180 s to guess). */
  phaseMs: number;
}

export interface DuelScore {
  userId: number;
  roundWins: number;
  /** Tie-breaker: guesses used across the rounds this player guessed (lower is better). */
  guessesUsed: number;
}

export interface DuelGame {
  mode?: 'duel';
  /** Grows with every move; a view with a lower version is older and is ignored. */
  version: number;
  current: CurrentRound | null;
  /** Finished rounds, oldest first. */
  rounds: DuelRound[];
  score: DuelScore[];
  result: { winnerId: number | null; reason: 'rounds' | 'tiebreak' | 'draw' | 'forfeit' } | null;
}

export interface DuelDraft {
  duelId: number;
  roundNumber: number;
  letters: string;
}

export interface DuelReaction {
  duelId: number;
  fromUserId: number;
  emoji: string;
}

export const DUEL_REACTIONS = ['👏', '😮', '😂', '🔥', '🤔', '😅', '👍', '🎉'] as const;

export interface SubmitDuelGuessResponse {
  guess: { attemptNumber: number; word: string; feedback: LetterFeedback[] };
  roundOver: boolean;
  duel: Duel;
}

/* ---------------- Race ---------------- */

export interface RaceCurrentRound {
  number: number;
  status: 'playing';
  msLeft: number | null;
  /** Both players start together when this reaches 0. */
  msUntilStart: number;
  phaseMs: number;
  myGuesses: DuelGuess[];
  /** The opponent's submitted rows — colours only, never letters. */
  opponentRows: { feedback: LetterFeedback[] }[];
}

export interface RaceRound {
  number: number;
  status: 'won' | 'draw' | 'forfeited';
  winnerId: number | null;
  secretWord: string;
  myGuesses: DuelGuess[];
  opponentGuesses: DuelGuess[];
}

export interface RaceGame {
  mode: 'race';
  version: number;
  current: RaceCurrentRound | null;
  rounds: RaceRound[];
  score: DuelScore[];
  result: { winnerId: number | null; reason: 'rounds' | 'draw' | 'forfeit' } | null;
}
