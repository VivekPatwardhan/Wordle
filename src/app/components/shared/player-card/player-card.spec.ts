import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PlayerCard } from './player-card';
import { PlayerCardService } from '../../../services/player-card-service';
import { PlayersApi } from '../../../services/players-api';
import { DuelApi } from '../../../services/duel-api';
import { FriendsApi } from '../../../services/friends-api';
import { AuthService } from '../../../services/auth-service';
import { RealtimeService } from '../../../services/realtime-service';
import { FakeRealtime } from '../../../testing/fake-realtime';
import { PlayerCard as PlayerCardData } from '../../../models/player-card';

const bob: PlayerCardData = {
  userId: 2,
  username: 'Bob',
  memberSince: '2026-10-17T00:00:00.000Z',
  solo: { played: 12, won: 9, winRate: 75, bestStreak: 4 },
  duel: { played: 5, won: 3, winRate: 60 },
  race: { played: 2, won: 1, winRate: 50 },
  achievements: {
    unlockedCount: 1,
    totalCount: 23,
    unlocked: [{ key: 'race-first-win', icon: '🏁', title: 'Photo Finish', description: 'Win your first race', unlockedAt: '2026-10-27T09:00:00.000Z' }],
  },
  headToHead: { duel: { won: 2, lost: 1, drawn: 0 }, race: { won: 0, lost: 1, drawn: 1 } },
};

describe('PlayerCard', () => {
  let fixture: ComponentFixture<PlayerCard>;
  let service: PlayerCardService;
  let playersApi: jasmine.SpyObj<PlayersApi>;
  let duelApi: jasmine.SpyObj<DuelApi>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    playersApi = jasmine.createSpyObj<PlayersApi>('PlayersApi', ['getCard']);
    playersApi.getCard.and.returnValue(of({ card: bob }));
    duelApi = jasmine.createSpyObj<DuelApi>('DuelApi', ['createDuel']);
    await TestBed.configureTestingModule({
      imports: [PlayerCard],
      providers: [
        provideRouter([]),
        { provide: PlayersApi, useValue: playersApi },
        { provide: DuelApi, useValue: duelApi },
        { provide: FriendsApi, useValue: { getFriends: () => of({ friends: [], incoming: [], outgoing: [] }), sendRequest: () => of({ status: 'pending', friend: { userId: 2, username: 'Bob' } }) } },
        { provide: AuthService, useValue: { currentUser: signal({ id: 1, email: 'me@example.com', username: 'Me' }) } },
        { provide: RealtimeService, useValue: new FakeRealtime() },
      ],
    }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    service = TestBed.inject(PlayerCardService);
    fixture = TestBed.createComponent(PlayerCard);
  });

  afterEach(() => fixture.destroy());

  it("shows a player's records, head-to-head and achievements", () => {
    service.open(2);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(playersApi.getCard).toHaveBeenCalledWith(2);
    expect(text()).toContain('Bob');
    expect(text()).toContain('Games · 75% won');
    expect(text()).toContain('Duels · 60% won');
    expect(text()).toContain('Races · 50% won');
    expect(text()).toContain('You vs Bob');
    expect(text()).toContain('Achievements · 1 of 23');
    expect(text()).toContain('+ Friend');
  });

  it('challenges straight from the card', () => {
    duelApi.createDuel.and.returnValue(of({ duel: { id: 77 } as never }));
    service.open(2);
    fixture.detectChanges();

    fixture.componentInstance.challenge('race');

    expect(duelApi.createDuel).toHaveBeenCalledWith({ mode: 'race', totalRounds: 3, opponentId: 2 });
    expect(service.openUserId()).toBeNull(); // closes after starting the challenge
  });

  it("says so when you're not allowed to see the player", () => {
    playersApi.getCard.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 404, error: { error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found.' } },
    })));
    service.open(9);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(text()).toContain('Player not found.');
  });
});
