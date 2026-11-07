import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ProfileApi } from '../../../services/profile-api';
import { AchievementsOverview } from '../../../models/achievements';

/** The Awards tab: every achievement as a badge, with progress towards the locked ones. */
@Component({
  selector: 'app-profile-achievements',
  imports: [DatePipe],
  template: `
    @if (errorMessage()) {
      <div class="box error" role="alert">
        <p>{{ errorMessage() }}</p>
        <button type="button" (click)="load()">Retry</button>
      </div>
    } @else if (overview(); as o) {
      <p class="summary"><strong>{{ o.unlockedCount }}</strong> of {{ o.totalCount }} achievements unlocked</p>
      @for (category of o.categories; track category.id) {
        <section class="category" [attr.aria-labelledby]="'cat-' + category.id">
          <h2 [id]="'cat-' + category.id">{{ category.title }}</h2>
          <ul class="badges">
            @for (a of category.achievements; track a.key) {
              <li class="badge" [class.unlocked]="a.unlocked">
                <span class="icon" aria-hidden="true">{{ a.icon }}</span>
                <strong>{{ a.title }}</strong>
                <span class="desc">{{ a.description }}</span>
                @if (a.unlocked) {
                  <span class="when">Unlocked {{ a.unlockedAt | date: 'MMM d, y' }}</span>
                } @else {
                  <span class="bar" role="progressbar" [attr.aria-valuenow]="a.progress"
                        aria-valuemin="0" [attr.aria-valuemax]="a.threshold"
                        [attr.aria-label]="a.title + ' progress'">
                    <span [style.width.%]="(a.progress / a.threshold) * 100"></span>
                  </span>
                  <span class="when">{{ a.progress }} / {{ a.threshold }}</span>
                }
              </li>
            }
          </ul>
        </section>
      }
    } @else {
      <div class="box"><p>Loading achievements…</p></div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .box { padding: 18px; text-align: center; color: var(--text-muted, #64748b); background: #fff; border: 1px solid var(--border-light, #e2e8f0); border-radius: 16px; }
    .box.error { color: #dc2626; }
    .box button { padding: 8px 14px; border: none; border-radius: 10px; background: var(--color-indigo, #6366f1); color: #fff; font-weight: 700; }
    .summary { margin: 0; text-align: center; color: var(--text-muted, #64748b); }
    .summary strong { color: var(--text-main, #0f172a); font-size: 1.1rem; }
    .category h2 { margin: 0 0 8px; font-size: 0.95rem; font-weight: 800; }
    .badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
    .badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 12px 8px;
      border: 1px solid var(--border-light, #e2e8f0);
      border-radius: 14px;
      background: #f8fafc;
      text-align: center;
      color: var(--text-muted, #64748b);
    }
    .badge .icon { font-size: 2rem; filter: grayscale(1); opacity: 0.45; }
    .badge strong { font-size: 0.85rem; }
    .desc { font-size: 0.72rem; }
    .when { font-size: 0.68rem; }
    .badge.unlocked { background: linear-gradient(160deg, #fffbeb, #fef3c7); border-color: #fcd34d; color: var(--text-main, #0f172a); }
    .badge.unlocked .icon { filter: none; opacity: 1; }
    .badge.unlocked .when { color: #b45309; font-weight: 700; }
    .bar { display: block; width: 100%; height: 6px; margin-top: 4px; overflow: hidden; border-radius: 999px; background: #e2e8f0; }
    .bar span { display: block; height: 100%; background: var(--color-indigo, #6366f1); }
  `,
})
export class ProfileAchievements implements OnInit {
  private readonly profileApi = inject(ProfileApi);

  readonly overview = signal<AchievementsOverview | null>(null);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.errorMessage.set('');
    this.profileApi.getMyAchievements().subscribe({
      next: ({ achievements }) => this.overview.set(achievements),
      error: () => this.errorMessage.set('Could not load your achievements. Please try again.'),
    });
  }
}
