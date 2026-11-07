import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProfileApi } from '../../../services/profile-api';
import { PvpStats } from '../../../models/profile';
import { PresenceDot } from '../../shared/presence-dot/presence-dot';
import { PlayerCardService } from '../../../services/player-card-service';

const RESULT_LABELS: Record<PvpStats['recent'][number]['result'], string> = {
  won: 'Won',
  lost: 'Lost',
  draw: 'Draw',
  forfeit: 'Forfeited',
};

/** The PvP tab of the profile: duel record, role stats, head-to-heads, recent duels. */
@Component({
  selector: 'app-profile-pvp',
  imports: [DatePipe, RouterLink, PresenceDot],
  templateUrl: './profile-pvp.html',
  styleUrl: './profile-pvp.css',
})
export class ProfilePvp implements OnInit {
  private readonly profileApi = inject(ProfileApi);
  readonly playerCard = inject(PlayerCardService);

  /** Duel and race records are kept separate. */
  readonly mode = signal<'duel' | 'race'>('duel');

  readonly stats = signal<PvpStats | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly resultLabels = RESULT_LABELS;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.profileApi.getMyPvpStats(this.mode()).subscribe({
      next: ({ stats }) => {
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load your duel stats. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  selectMode(mode: 'duel' | 'race'): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    this.stats.set(null);
    this.load();
  }

  /** Width (%) of each part of the won / drawn / lost bar. */
  recordBar(stats: PvpStats): { won: number; drawn: number; lost: number } {
    const { played, won, drawn, lost } = stats.duels;
    if (played === 0) return { won: 0, drawn: 0, lost: 0 };
    return {
      won: (won / played) * 100,
      drawn: (drawn / played) * 100,
      lost: (lost / played) * 100,
    };
  }
}
