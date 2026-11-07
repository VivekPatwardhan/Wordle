import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProfileAchievements } from './profile-achievements';
import { ProfileApi } from '../../../services/profile-api';

describe('ProfileAchievements', () => {
  it('shows unlocked badges and progress towards locked ones', () => {
    const profileApi = { getMyAchievements: () => of({ achievements: {
      unlockedCount: 1,
      totalCount: 3,
      categories: [{
        id: 'games',
        title: 'Games',
        achievements: [
          { key: 'games-10', category: 'games', icon: '🎯', title: 'Getting Started', description: 'Complete 10 games', threshold: 10, progress: 10, unlocked: true, unlockedAt: '2026-10-27T06:00:00.000Z' },
          { key: 'games-100', category: 'games', icon: '🧠', title: 'Word Enthusiast', description: 'Complete 100 games', threshold: 100, progress: 42, unlocked: false, unlockedAt: null },
        ],
      }],
    } }) };
    TestBed.configureTestingModule({
      imports: [ProfileAchievements],
      providers: [{ provide: ProfileApi, useValue: profileApi }],
    });

    const fixture = TestBed.createComponent(ProfileAchievements);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('1 of 3 achievements unlocked');
    expect(el.querySelectorAll('.badge.unlocked').length).toBe(1);
    expect(el.textContent).toContain('Unlocked Oct 27, 2026');
    expect(el.textContent).toContain('42 / 100');
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('42');
  });
});
