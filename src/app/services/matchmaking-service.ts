import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { RealtimeService } from './realtime-service';
import { PvpMode, RoundCount } from '../models/duel';

export type MatchmakingState =
  | { status: 'idle' }
  | { status: 'searching'; mode: PvpMode; totalRounds: RoundCount; startedAt: number; waitingCount: number }
  | { status: 'error'; message: string };

interface JoinReply {
  status?: 'waiting' | 'matched';
  duelId?: number;
  waitingCount?: number;
  error?: { code: string; message: string };
}

/**
 * Random opponent search. Lives for the whole app, so the search keeps going
 * while the player looks at other pages; when a match is found (here or in
 * another tab) the duel opens. The server forgets the search if the
 * connection drops, so it is re-sent after every reconnect.
 */
@Injectable({
  providedIn: 'root',
})
export class MatchmakingService {
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);

  readonly state = signal<MatchmakingState>({ status: 'idle' });
  private lastOpenedDuelId: number | null = null;

  constructor() {
    this.realtime.on<{ duelId: number }>('match:found').subscribe(({ duelId }) => this.openMatch(duelId));

    // Back online while searching → join again (the server dropped us with the old socket).
    effect(() => {
      const online = this.realtime.status() === 'online';
      untracked(() => {
        const state = this.state();
        if (online && state.status === 'searching') this.join(state.totalRounds, state.startedAt, state.mode);
      });
    });
  }

  search(totalRounds: RoundCount, mode: PvpMode = 'duel'): void {
    this.join(totalRounds, Date.now(), mode);
  }

  private openMatch(duelId: number): void {
    // The joining player gets both the reply and the push: open the duel once.
    if (this.lastOpenedDuelId === duelId) return;
    this.lastOpenedDuelId = duelId;
    this.state.set({ status: 'idle' });
    this.router.navigate(['/duel', duelId]);
  }

  cancel(): void {
    if (this.state().status === 'searching') this.realtime.send('match:leave', {});
    this.state.set({ status: 'idle' });
  }

  private async join(totalRounds: RoundCount, startedAt: number, mode: PvpMode = 'duel'): Promise<void> {
    this.state.set({ status: 'searching', mode, totalRounds, startedAt, waitingCount: 1 });
    let reply: JoinReply;
    try {
      reply = await this.realtime.request<JoinReply>('match:join', { totalRounds, mode });
    } catch {
      // Offline: stay "searching"; the reconnect effect above retries.
      return;
    }

    if (reply.error) {
      this.state.set({ status: 'error', message: reply.error.message });
      return;
    }
    if (reply.status === 'matched' && reply.duelId) {
      this.openMatch(reply.duelId);
      return;
    }
    const current = this.state();
    if (current.status === 'searching') {
      this.state.set({ ...current, waitingCount: reply.waitingCount ?? 1 });
    }
  }
}
