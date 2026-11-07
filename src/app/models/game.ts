export type GameMode = 'daily' | 'practice';
export type GameStatus = 'in_progress' | 'won' | 'lost';
export type LetterFeedback = 'correct' | 'present' | 'absent';

export interface Guess {
  attemptNumber: number;
  guessWord: string;
  submittedAt?: string;
  feedback: LetterFeedback[];
}

export interface Game {
  id: number | string;
  mode: GameMode;
  status: GameStatus;
  puzzleDate?: string | null;
  startedAt?: string;
  completedAt?: string | null;
  /** Only sent by the server once the game is won or lost. */
  answer?: string;
  guesses: Guess[];
}

export interface CreateGameRequest {
  mode: GameMode;
}

export interface CreateGameResponse {
  game: Game;
}

export interface GameResponse {
  game: Game;
}

export interface SubmitGuessRequest {
  guessWord: string;
}

export interface SubmitGuessResponse {
  game: {
    id: number | string;
    status: GameStatus;
    completedAt?: string | null;
    answer?: string;
  };
  guess: Guess;
}

export interface WordMeaning {
  partOfSpeech: string;
  definitions: string[];
}

/** Dictionary entry for a finished game's answer (content from Wiktionary, CC BY-SA 4.0). */
export interface WordDefinition {
  word: string;
  /** False when the dictionary doesn't know the word; `meanings` is then empty. */
  found: boolean;
  meanings: WordMeaning[];
  source: {
    name: string;
    url: string;
    license: string;
    licenseUrl: string;
  };
}

export interface WordDefinitionResponse {
  definition: WordDefinition;
}

/** What the result popup shows while the definition loads, after it loads, or if it fails. */
export type DefinitionState =
  | { status: 'loading' }
  | { status: 'ready'; definition: WordDefinition }
  | { status: 'unavailable' };
