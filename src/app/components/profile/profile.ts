import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Header } from '../shared/header/header';
import { Footer } from '../shared/footer/footer';
import { AuthService } from '../../services/auth-service';
import { ProfileApi } from '../../services/profile-api';
import { PlayerStats, StatsMode } from '../../models/profile';
import { UsernameEditor } from './username-editor/username-editor';
import { ProfilePvp } from './profile-pvp/profile-pvp';
import { ProfileAchievements } from './profile-achievements/profile-achievements';

/** Solo stats per mode, plus a separate PvP tab (setter-chosen words aren't comparable). */
type ProfileTab = StatsMode | 'pvp' | 'awards';

@Component({
  selector: 'app-profile',
  imports: [Header, Footer, DatePipe, UpperCasePipe, UsernameEditor, ProfilePvp, ProfileAchievements],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit, OnDestroy {
  private readonly profileApi = inject(ProfileApi);
  readonly authService = inject(AuthService);
  private statsSubscription?: Subscription;

  readonly modes: { id: ProfileTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'daily', label: 'Daily' },
    { id: 'practice', label: 'Practice' },
    { id: 'pvp', label: 'PvP' },
    { id: 'awards', label: 'Awards' },
  ];

  readonly mode = signal<ProfileTab>('all');
  readonly stats = signal<PlayerStats | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly user = computed(() => this.authService.currentUser());
  readonly displayName = computed(
    () => this.user()?.username ?? this.user()?.email?.split('@')[0] ?? 'Player'
  );

  /** One bar per guess count, sized relative to the most common result. */
  readonly distributionBars = computed(() => {
    const counts = this.stats()?.guessDistribution ?? [];
    const max = Math.max(...counts, 0);
    return counts.map((count, index) => ({
      guesses: index + 1,
      count,
      // Keep a small stub for zero so every row still shows its count.
      widthPercent: max === 0 ? 0 : Math.round((count / max) * 100),
      isMostCommon: max > 0 && count === max,
    }));
  });

  readonly openingLetters = computed(
    () => this.stats()?.openingWord?.word.toUpperCase().split('') ?? []
  );

  ngOnInit(): void {
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.statsSubscription?.unsubscribe();
  }

  selectMode(mode: ProfileTab): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    // The PvP and Awards tabs load their own data.
    if (mode !== 'pvp' && mode !== 'awards') this.loadStats();
  }

  loadStats(): void {
    const mode = this.mode();
    if (mode === 'pvp' || mode === 'awards') return;
    // Switching tabs quickly must not let an older response overwrite a newer one.
    this.statsSubscription?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.statsSubscription = this.profileApi.getMyStats(mode).subscribe({
      next: ({ stats }) => {
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load your stats. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
