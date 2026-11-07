import { Component, computed, ElementRef, HostListener, inject, input, OnDestroy, OnInit, Renderer2, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Header } from '../shared/header/header';
import { Footer } from '../shared/footer/footer';
import { ModalComponent } from '../shared/modal/modal';
import { Router } from '@angular/router';
import { ModalService } from '../../services/modal-service';
import { catchError, filter, finalize, map, of, Subscription, switchMap, tap } from 'rxjs';
import { Loader } from '../shared/loader/loader';
import { GameApi } from '../../services/game-api';
import { DefinitionState, Game, Guess } from '../../models/game';
import { NgClass } from '@angular/common';

type LoadResult = { game: Game } | { error: unknown };

@Component({
  selector: 'app-game-board',
  imports: [Header, Footer, ModalComponent, Loader, NgClass],
  templateUrl: './game-board.html',
  styleUrl: './game-board.css',
})
export class GameBoard implements OnInit, OnDestroy {
  private router = inject(Router);
  private gameApi = inject(GameApi);
  private modalService = inject(ModalService);
  private actionSubscription?: Subscription;
  private definitionSubscription?: Subscription;
  private toastTimer?: ReturnType<typeof setTimeout>;

  gameId = input<string>();
  game = signal<Game | null>(null);
  guess = signal<Guess | null>(null);
  currentDraft = signal<string[]>([]);
  isLoading = signal(false);
  isSubmitting = signal(false);
  loadError = signal('');
  /** Definition of the answer, shown in the result popup once the game is finished. */
  readonly wordDefinition = signal<DefinitionState>({ status: 'loading' });

  readonly MAX_ROWS = 6;
  readonly MAX_COLS = 5;
  readonly RESULT_MODAL_DELAY_MS = 1800;
  readonly TOAST_DURATION_MS = 2000;
  private resultModalTimer?: ReturnType<typeof setTimeout>;
  currentRow = computed(() => this.game()?.guesses.length ?? 0);
  currentCol = computed(() => this.currentDraft().length);
  isRowFull = computed(() => this.currentCol() === this.MAX_COLS);
  /** Input is only accepted for a loaded, unfinished game with no request in flight. */
  isWordReady = computed(() => {
    const game = this.game();
    return !!game
      && game.status === 'in_progress'
      && this.currentRow() < this.MAX_ROWS
      && !this.isLoading()
      && !this.isSubmitting();
  });
  displayGrid = computed(() => {
    const grid = Array.from({ length: this.MAX_ROWS }, () => Array(this.MAX_COLS).fill(''));
    const guesses = this.game()?.guesses ?? [];
    const current = this.currentRow();
    const draft = this.currentDraft();
    // Populate past guesses
    guesses.forEach((guess, r) => {
      grid[r] = guess.guessWord.toUpperCase().split('');
    });
    // Populate current draft
    if (current < this.MAX_ROWS) {
      draft.forEach((letter, c) => {
        grid[current][c] = letter;
      });
    }
    return grid;
  });
  keyboardStatus = computed(() => {
    const statusMap: Record<string, string> = {};
    const guesses = this.game()?.guesses ?? [];
    for (const guess of guesses) {
      const letters = guess.guessWord.toUpperCase().split('');
      guess.feedback.forEach((feedback, i) => {
        const letter = letters[i];
        const existing = statusMap[letter];
        // Green ('matched-Letter') has highest priority and never gets overwritten
        if (feedback === 'correct') {
          statusMap[letter] = 'matched-Letter';
        } else if (feedback === 'present') {
          if (existing !== 'matched-Letter') {
            statusMap[letter] = 'has-Letter';
          }
        } else if (feedback === 'absent') {
          if (!existing) {
            statusMap[letter] = 'wrong-Letter';
          }
        }
      });
    }
    return statusMap;
  });

  @ViewChild('boardElement', { static: false }) boardEleRef!: ElementRef;
  @ViewChild('kbElement', { static: false }) kbEleRef!: ElementRef;
  toastMessage = signal<string>('');

  keyboardRows: { label: string; wide: boolean; backspace: boolean; ariaLabel: string }[][] = [
    'QWERTYUIOP'.split('').map((label) => ({ label, wide: false, backspace: false, ariaLabel: label })),
    'ASDFGHJKL'.split('').map((label) => ({ label, wide: false, backspace: false, ariaLabel: label })),
    [
      { label: 'ENTER', wide: true, backspace: false, ariaLabel: 'Enter' },
      ...'ZXCVBNM'.split('').map((label) => ({ label, wide: false, backspace: false, ariaLabel: label })),
      { label: '⌫', wide: true, backspace: true, ariaLabel: 'Backspace' },
    ],
  ];

  constructor(public renderer: Renderer2) {
    // Load whenever the :gameId in the URL changes. The router reuses this
    // component for /game/1 → /game/2 (and for browser back/forward), so
    // loading only in ngOnInit would leave the old game on screen.
    // switchMap drops the response of a game the user has already left.
    toObservable(this.gameId).pipe(
      filter((id): id is string => !!id),
      tap(() => this.resetBoard()),
      switchMap((id) => this.gameApi.getGame(id).pipe(
        map((res): LoadResult => ({ game: res.game })),
        catchError((error: unknown) => of<LoadResult>({ error })),
      )),
      takeUntilDestroyed(),
    ).subscribe((result) => this.applyLoadedGame(result));
  }

  @HostListener('window:keydown', ['$event'])
  handlePhysicalKeyboard(event: KeyboardEvent) {
    if (!this.isWordReady()) return;
    const key = event.key;
    if (key === 'Enter') {
      this.btnClicked('Enter');
    } else if (key === 'Backspace') {
      this.btnClicked('Backspace');
    } else {
      const uppercaseLetter = key.toUpperCase();
      const isValidLetter = 'QWERTYUIOPASDFGHJKLZXCVBNM'.includes(uppercaseLetter);
      if (isValidLetter && key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        this.btnClicked(uppercaseLetter);
      }
    }
  }

  get rowIndexes(): number[] {
    return Array.from({ length: this.MAX_ROWS }, (_, index) => index);
  }
  get colIndexes(): number[] {
    return Array.from({ length: this.MAX_COLS }, (_, index) => index);
  }

  ngOnInit(): void {
    this.actionSubscription = this.modalService.selectedAction$.subscribe((actionId) => {
      switch (actionId) {
        case "home":
          this.modalService.close();
          this.router.navigate(['/home']);
          break;
        case "next-word":
          this.modalService.close();
          this.newGame();
          break;
      }
    });
  }

  ngOnDestroy() {
    this.actionSubscription?.unsubscribe();
    this.definitionSubscription?.unsubscribe();
    // Don't pop the result dialog up on another page after navigating away.
    clearTimeout(this.resultModalTimer);
    clearTimeout(this.toastTimer);
    this.modalService.close();
  }

  /** Clears everything that belongs to the previously shown game. */
  private resetBoard(): void {
    clearTimeout(this.resultModalTimer);
    this.modalService.close();
    this.definitionSubscription?.unsubscribe();
    this.wordDefinition.set({ status: 'loading' });
    this.game.set(null);
    this.currentDraft.set([]);
    this.loadError.set('');
    this.isSubmitting.set(false);
    this.isLoading.set(true);
    // Flip classes are added straight to the DOM, so they survive a route change.
    const boardEle = this.boardEleRef?.nativeElement as HTMLElement | undefined;
    boardEle?.querySelectorAll('.flipCell').forEach(el => el.classList.remove('flipCell'));
  }

  private applyLoadedGame(result: LoadResult): void {
    this.isLoading.set(false);

    if ('error' in result) {
      const status = result.error instanceof HttpErrorResponse ? result.error.status : 0;
      this.loadError.set(status === 404
        ? 'This game could not be found.'
        : 'Could not load this game. Please check your connection and try again.');
      return;
    }

    const game = result.game;
    this.game.set(game);
    game.guesses.forEach((guess: Guess, rowIndex: number) => {
      // Apply feedback colors for this row
      this.wordRowStyle("Flip&Colors", guess.guessWord.toUpperCase().split(''), guess.feedback, rowIndex);
    });
    // A finished game (e.g. reopened from a link, refresh or back button) shows its result again.
    if (game.status === 'won' || game.status === 'lost') {
      this.showResultModal();
    }
  }

  btnClicked(ariaLabel: any) {
    if (!this.isWordReady()) return;

    if (ariaLabel === "Enter") {
      if (this.isRowFull()) {
        this.guessHelper();
      }
      return;
    }

    if (ariaLabel === "Backspace") {
      this.currentDraft.update(draft => draft.slice(0, -1));
      return;
    }

    if (!this.isRowFull()) {
      this.currentDraft.update(draft => [...draft, ariaLabel.toUpperCase()]);
    }
  }

  guessHelper() {
    const gameId = this.gameId();
    if (!gameId || this.isSubmitting()) return;

    const currentGuessedWord = this.currentDraft().join('').toLowerCase();
    const isRepeated = this.game()?.guesses.some((guess) => guess.guessWord === currentGuessedWord);
    if (isRepeated) {
      this.rejectDraft('You have already used this word!');
      return;
    }

    // Locks the keyboard until the server answers, so a double Enter can't
    // submit the same guess twice and burn an extra attempt.
    this.isSubmitting.set(true);
    this.gameApi.submitGuess(gameId, { guessWord: currentGuessedWord }).pipe(
      finalize(() => this.isSubmitting.set(false)),
    ).subscribe({
      next: (res) => {
        // The player navigated to another game while this request was in flight.
        if (this.gameId() !== gameId) return;

        this.guess.set(res.guess);
        this.wordRowStyle("Flip&Colors", [...this.currentDraft()], res.guess.feedback, this.currentRow());
        this.game.update(g => g ? {
          ...g,
          status: res.game.status,
          answer: res.game.answer,
          guesses: [...g.guesses, res.guess]
        } : null);
        this.currentDraft.set([]);

        if (res.game.status === 'won' || res.game.status === 'lost') {
          this.showResultModal();
        }
      },
      error: (err: unknown) => {
        if (this.gameId() !== gameId) return;
        this.handleGuessError(err, gameId);
      }
    });
  }

  /** Maps the API's error codes to what the player should see. */
  private handleGuessError(err: unknown, gameId: string): void {
    const code = err instanceof HttpErrorResponse ? err.error?.error?.code : undefined;

    switch (code) {
      case 'INVALID_GUESS_WORD':
        this.rejectDraft('Not in word list');
        break;
      case 'INVALID_GUESS_FORMAT':
        this.rejectDraft('Guess must be exactly five letters');
        break;
      case 'GAME_ALREADY_FINISHED':
      case 'NO_ATTEMPTS_REMAINING':
        // Our copy of the game is stale (e.g. finished in another tab) — reload the truth.
        this.showToast('This game is already finished');
        this.reloadGame(gameId);
        break;
      case 'GAME_NOT_FOUND':
        this.loadError.set('This game could not be found.');
        break;
      default:
        // Network or server failure: keep the draft so the player can retry.
        this.showToast('Could not submit your guess. Please try again.');
    }
  }

  private reloadGame(gameId: string): void {
    this.resetBoard();
    this.gameApi.getGame(gameId).pipe(
      map((res): LoadResult => ({ game: res.game })),
      catchError((error: unknown) => of<LoadResult>({ error })),
    ).subscribe((result) => {
      if (this.gameId() === gameId) this.applyLoadedGame(result);
    });
  }

  /** Shakes the current row and explains why the draft was not accepted. */
  private rejectDraft(message: string): void {
    this.wordRowStyle("Invalid", this.currentDraft(), [], this.currentRow());
    this.showToast(message);
  }

  /**
   * Opens the won/lost dialog for the current game. Waits for the row flip
   * animation (5 tiles × 300ms) so the board's final colours are seen first.
   */
  showResultModal(): void {
    clearTimeout(this.resultModalTimer);
    // Start the lookup now so it usually arrives during the flip animation.
    this.loadDefinition();
    this.resultModalTimer = setTimeout(() => {
      const game = this.game();
      if (!game) return;

      const nextLabel = game.mode === 'daily' ? 'Practice Mode' : 'Play Again';
      const definition = this.wordDefinition.asReadonly();
      if (game.status === 'won') {
        this.modalService.open({
          message: 'Splendid! You won! 🎉',
          definition,
          actions: [
            { id: 'home', label: 'Home' },
            { id: 'next-word', label: nextLabel }
          ]
        });
      } else if (game.status === 'lost') {
        const reveal = game.answer ? ` The word was ${game.answer.toUpperCase()}.` : '';
        this.modalService.open({
          message: `Game Over!${reveal} Better luck next time.`,
          definition,
          actions: [
            { id: 'home', label: 'Home' },
            { id: 'next-word', label: game.mode === 'daily' ? nextLabel : 'Try Again' }
          ]
        });
      }
    }, this.RESULT_MODAL_DELAY_MS);
  }

  /** Fetches the answer's definition; the open popup updates as soon as it arrives. */
  private loadDefinition(): void {
    const gameId = this.gameId();
    if (!gameId) return;

    this.definitionSubscription?.unsubscribe();
    this.wordDefinition.set({ status: 'loading' });
    this.definitionSubscription = this.gameApi.getDefinition(gameId).subscribe({
      next: ({ definition }) => this.wordDefinition.set({ status: 'ready', definition }),
      // A missing definition must never block the result itself.
      error: () => this.wordDefinition.set({ status: 'unavailable' }),
    });
  }

  wordRowStyle(action: string, currentGuess: string[], feedback: string[], rowCount: number) {
    const boardEle = this.boardEleRef?.nativeElement as HTMLElement | undefined;
    if (!boardEle) return;
    switch (action) {
      case "Flip&Colors":
        for (let i = 0; i < feedback.length; i++) {
          let currentRow = boardEle.querySelector(`.board-row:nth-of-type(${rowCount + 1})`);
          let currentCell = currentRow?.querySelector(`.squareBlock:nth-of-type(${i + 1})`);
          setTimeout(() => {
            this.renderer.addClass(currentCell, 'flipCell');
          }, i * 300);
        }
        break;
      case "Invalid":
        let currentRow = boardEle.querySelector(`.board-row:nth-of-type(${rowCount + 1})`);
        this.renderer.addClass(currentRow, 'shake-row');
        setTimeout(() => {
          this.renderer.removeClass(currentRow, 'shake-row');
        }, 500);
        break;
    }
  }

  newGame(): void {
    // Only navigate: the gameId subscription in the constructor resets and loads the board.
    this.gameApi.createGame({ mode: 'practice' }).subscribe({
      next: (res) => this.router.navigate(['/game', res.game.id]),
      error: () => this.showToast('Could not start a new game. Please try again.'),
    });
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  getCellClass(row: number, col: number): string {
    const guess = this.game()?.guesses[row];
    if (!guess) return '';
    const feedback = guess.feedback[col];
    if (feedback === 'correct') return 'matched-Letter';
    if (feedback === 'present') return 'has-Letter';
    if (feedback === 'absent') return 'wrong-Letter';
    return '';
  }

  showToast(message: string) {
    clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), this.TOAST_DURATION_MS);
  }

  hideToast() {
    clearTimeout(this.toastTimer);
    this.toastMessage.set('');
  }
}
