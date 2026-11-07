import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Profile } from './profile';
import { ProfileApi } from '../../services/profile-api';
import { AuthApi } from '../../services/auth-api';
import { AuthService } from '../../services/auth-service';
import { PlayerStats } from '../../models/profile';

const stats: PlayerStats = {
  mode: 'all',
  played: 4,
  won: 3,
  lost: 1,
  winRate: 75,
  averageGuesses: 3.67,
  guessDistribution: [0, 0, 1, 2, 0, 0],
  openingWord: { word: 'slate', timesUsed: 3 },
  streak: { current: 2, best: 5 },
};

describe('Profile', () => {
  let fixture: ComponentFixture<Profile>;
  let component: Profile;
  let profileApi: jasmine.SpyObj<ProfileApi>;

  beforeEach(async () => {
    profileApi = jasmine.createSpyObj<ProfileApi>('ProfileApi', ['getMyStats']);
    profileApi.getMyStats.and.returnValue(of({ stats }));

    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        { provide: ProfileApi, useValue: profileApi },
        { provide: AuthApi, useValue: { logout: jasmine.createSpy('logout') } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 1, email: 'player@example.com', username: 'Word Player' }),
            isLoggedIn: true,
            clearSession: jasmine.createSpy('clearSession'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads all-mode stats and shows the summary tiles', () => {
    expect(profileApi.getMyStats).toHaveBeenCalledWith('all');
    const tiles = [...fixture.nativeElement.querySelectorAll('.tile strong')]
      .map((tile: Element) => tile.textContent?.trim());
    expect(tiles).toEqual(['4', '75%', '2', '5']);
  });

  it('sizes distribution bars relative to the most common result', () => {
    const bars = component.distributionBars();
    expect(bars.map((bar) => bar.widthPercent)).toEqual([0, 0, 50, 100, 0, 0]);
    expect(bars[3].isMostCommon).toBeTrue();
  });

  it('shows the favourite opening word as tiles', () => {
    const letters = [...fixture.nativeElement.querySelectorAll('.opener-tile')]
      .map((tile: Element) => tile.textContent?.trim());
    expect(letters).toEqual(['S', 'L', 'A', 'T', 'E']);
  });

  it('reloads when the mode toggle changes', () => {
    component.selectMode('daily');
    expect(profileApi.getMyStats).toHaveBeenCalledWith('daily');
    expect(component.mode()).toBe('daily');
  });

  it('shows a retry message when loading fails', () => {
    profileApi.getMyStats.and.returnValue(throwError(() => new Error('offline')));
    component.selectMode('practice');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe('Profile PvP tab', () => {
  it('shows the PvP record without loading solo stats again', async () => {
    const profileApi = jasmine.createSpyObj<ProfileApi>('ProfileApi', ['getMyStats', 'getMyPvpStats']);
    profileApi.getMyStats.and.returnValue(of({ stats }));
    profileApi.getMyPvpStats.and.returnValue(of({
      stats: {
        mode: 'duel' as const,
        duels: { played: 3, won: 2, lost: 1, drawn: 0, forfeits: 0, winRate: 67 },
        asGuesser: { rounds: 4, solved: 3, solveRate: 75, averageGuesses: 3.67 },
        asSetter: { rounds: 4, survived: 1, survivalRate: 25 },
        headToHead: [{ userId: 2, username: 'Bob', won: 2, lost: 1, drawn: 0, lastPlayedAt: '2026-10-27T04:49:22.000Z' }],
        recent: [{
          duelId: 13, source: 'random', totalRounds: 4, result: 'won', myRounds: 3, opponentRounds: 1,
          opponent: { userId: 2, username: 'Bob' }, finishedAt: '2026-10-27T04:49:22.000Z',
        }],
      },
    }));

    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        { provide: ProfileApi, useValue: profileApi },
        { provide: AuthApi, useValue: { logout: jasmine.createSpy('logout') } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 1, email: 'player@example.com', username: 'Word Player' }),
            isLoggedIn: true,
            clearSession: jasmine.createSpy('clearSession'),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    fixture.componentInstance.selectMode('pvp');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(profileApi.getMyStats).toHaveBeenCalledTimes(1); // only the initial 'all' load
    expect(profileApi.getMyPvpStats).toHaveBeenCalled();
    expect(text).toContain('67%');
    expect(text).toContain('Head to head');
    expect(text).toContain('vs Bob');
    expect(text).toContain('Won 3–1');
  });
});
