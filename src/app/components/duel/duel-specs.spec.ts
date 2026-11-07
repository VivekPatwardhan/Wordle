import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DuelHub } from './duel-hub/duel-hub';
import { DuelLobby } from './duel-lobby/duel-lobby';
import { InviteLanding } from './invite-landing/invite-landing';
import { DuelApi } from '../../services/duel-api';
import { AuthApi } from '../../services/auth-api';
import { AuthService } from '../../services/auth-service';
import { RealtimeService } from '../../services/realtime-service';
import { FakeRealtime } from '../../testing/fake-realtime';
import { CurrentRound, Duel, DuelGame, DuelHub as DuelHubData, InvitePreview } from '../../models/duel';
import { User } from '../../models/auth';
import { takeReturnUrl } from '../../services/return-url';
import { FriendsApi } from '../../services/friends-api';

const TOKEN = 'a'.repeat(64);
const alice = { userId: 1, username: 'Alice', seat: 1 as const };
const bob = { userId: 2, username: 'Bob', seat: 2 as const };

function makeDuel(overrides: Partial<Duel> = {}): Duel {
  return {
    id: 10,
    source: 'invite',
    mode: 'duel',
    status: 'waiting',
    lobbyState: 'waiting_for_opponent',
    totalRounds: 4,
    currentRound: 0,
    createdAt: '2026-10-27T10:00:00.000Z',
    startedAt: null,
    isCreator: true,
    players: [alice],
    invite: { token: TOKEN, expiresAt: new Date(Date.now() + 23 * 3_600_000).toISOString(), isLink: true },
    game: null,
    ...overrides,
  };
}

const emptyHub: DuelHubData = { incoming: [], outgoing: [], active: [], opponents: [] };

describe('PvP pages', () => {
  let duelApi: jasmine.SpyObj<DuelApi>;
  let realtime: FakeRealtime;
  let router: Router;
  let currentUser: ReturnType<typeof signal<User | null>>;

  beforeEach(async () => {
    duelApi = jasmine.createSpyObj<DuelApi>('DuelApi', [
      'getHub', 'createDuel', 'getDuel', 'cancelDuel', 'getInvitePreview', 'acceptInvite', 'declineInvite',
    ]);
    duelApi.getHub.and.returnValue(of(emptyHub));
    realtime = new FakeRealtime();
    currentUser = signal<User | null>({ id: 1, email: 'alice@example.com', username: 'Alice' });

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DuelApi, useValue: duelApi },
        { provide: RealtimeService, useValue: realtime },
        { provide: FriendsApi, useValue: { getFriends: () => of({ friends: [], incoming: [], outgoing: [] }), sendRequest: jasmine.createSpy('sendRequest').and.returnValue(of({ status: 'pending', friend: { userId: 2, username: 'Bob' } })) } },
        { provide: AuthApi, useValue: { logout: jasmine.createSpy('logout') } },
        {
          provide: AuthService,
          useValue: {
            currentUser,
            get isLoggedIn() { return !!currentUser(); },
            checkSession: () => of(currentUser() ? 'signed-in' : 'signed-out'),
            clearSession: jasmine.createSpy('clearSession'),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    localStorage.removeItem('wordle.returnUrl');
  });

  describe('DuelHub', () => {
    function create() {
      const fixture = TestBed.createComponent(DuelHub);
      fixture.detectChanges();
      return fixture;
    }

    it('creates an invite link with the chosen rounds and opens its lobby', () => {
      duelApi.createDuel.and.returnValue(of({ duel: makeDuel({ totalRounds: 6 }) }));
      const fixture = create();

      fixture.componentInstance.rounds.set(6);
      fixture.componentInstance.createInviteLink();

      expect(duelApi.createDuel).toHaveBeenCalledWith({ mode: 'duel', totalRounds: 6 });
      expect(router.navigate).toHaveBeenCalledWith(['/duel', 10]);
    });

    it('searches for a random opponent with the chosen rounds', async () => {
      const fixture = create();
      fixture.componentInstance.rounds.set(8);

      fixture.componentInstance.findRandomOpponent();
      await Promise.resolve(); // the queue's reply
      fixture.detectChanges();

      expect(realtime.request).toHaveBeenCalledWith('match:join', { totalRounds: 8, mode: 'duel' });
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Looking for an opponent: 8-round duel');
      fixture.destroy(); // stops the "searching for 0:12" ticker
    });

    it('switches to Race mode: best-of choices and race challenges', () => {
      duelApi.createDuel.and.returnValue(of({ duel: makeDuel({ mode: 'race' }) }));
      const fixture = create();

      fixture.componentInstance.selectMode('race');
      fixture.detectChanges();
      const choices = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.round-picker button')].map((b) => b.textContent?.trim());
      expect(choices).toEqual(['1', '3', '5']);
      expect(fixture.componentInstance.rounds()).toBe(3);

      fixture.componentInstance.createInviteLink();
      expect(duelApi.createDuel).toHaveBeenCalledWith({ mode: 'race', totalRounds: 3 });
    });

    it('challenges a previous opponent with a direct invite', () => {
      duelApi.createDuel.and.returnValue(of({ duel: makeDuel({ source: 'direct' }) }));
      const fixture = create();

      fixture.componentInstance.challenge({ userId: 2, username: 'Bob', won: 1, lost: 0, drawn: 0, lastPlayedAt: '' });

      expect(duelApi.createDuel).toHaveBeenCalledWith({ mode: 'duel', totalRounds: 4, opponentId: 2 });
    });

    it('shows the API\'s reason when something is refused', () => {
      duelApi.createDuel.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 429,
        error: { error: { code: 'TOO_MANY_OPEN_INVITES', message: 'You can have at most 5 open invites.' } },
      })));
      const fixture = create();

      fixture.componentInstance.createInviteLink();

      expect(fixture.componentInstance.errorMessage()).toBe('You can have at most 5 open invites.');
    });

    it('lists incoming invites and refreshes when a new one arrives live', () => {
      const fixture = create();
      expect(duelApi.getHub).toHaveBeenCalledTimes(1);

      duelApi.getHub.and.returnValue(of({
        ...emptyHub,
        incoming: [{ mode: 'duel', token: TOKEN, duelId: 10, inviter: { userId: 2, username: 'Bob' }, totalRounds: 4, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }],
      }));
      realtime.push('duel:invited', {});
      fixture.detectChanges();

      expect(duelApi.getHub).toHaveBeenCalledTimes(2);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Invites for you');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bob');
    });
  });

  describe('DuelLobby', () => {
    function create(duel: Duel) {
      duelApi.getDuel.and.returnValue(of({ duel }));
      const fixture = TestBed.createComponent(DuelLobby);
      fixture.componentRef.setInput('duelId', '10');
      fixture.detectChanges();
      fixture.detectChanges();
      return fixture;
    }

    it('shows the creator the invite link to share', () => {
      const fixture = create(makeDuel());

      expect(fixture.componentInstance.link()).toBe(`${window.location.origin}/duel/invite/${TOKEN}`);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Invite your opponent');
    });

    it('updates live when the opponent accepts', () => {
      const fixture = create(makeDuel());

      realtime.push('duel:updated', { duel: makeDuel({ lobbyState: 'ready', players: [alice, bob], invite: null }) });
      fixture.detectChanges();

      expect(fixture.componentInstance.opponent()?.username).toBe('Bob');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Both players are here!');
    });

    describe('VS intro', () => {
      const startingGame = (current: Partial<CurrentRound> = {}): DuelGame => ({
        version: 1,
        rounds: [],
        score: [],
        result: null,
        current: {
          number: 1, setterId: 1, guesserId: 2, status: 'setting' as const, winnerId: null,
          secretWord: null, guesses: [], msLeft: 60_000, phaseMs: 60_000, ...current,
        },
      });

      beforeEach(() => localStorage.removeItem('wordle.duelIntrosSeen'));

      it('plays when an invite duel starts — live, as the opponent accepts', () => {
        const fixture = create(makeDuel());
        expect(fixture.componentInstance.showIntro()).toBeFalse();

        realtime.push('duel:updated', {
          duel: makeDuel({ status: 'setting', lobbyState: 'in_play', players: [alice, bob], invite: null, game: startingGame() }),
        });
        fixture.detectChanges();

        expect(fixture.componentInstance.showIntro()).toBeTrue();
        expect((fixture.nativeElement as HTMLElement).querySelector('app-versus-intro')).not.toBeNull();
        fixture.destroy();
      });

      it('plays only once per duel', () => {
        const fixture = create(makeDuel({ players: [alice, bob], status: 'setting', game: startingGame() }));
        expect(fixture.componentInstance.showIntro()).toBeTrue();

        fixture.componentInstance.introDone();

        expect(fixture.componentInstance.showIntro()).toBeFalse();
        expect(JSON.parse(localStorage.getItem('wordle.duelIntrosSeen')!)).toEqual([10]);
        fixture.destroy();
      });

      it('does not play in the middle of a duel', () => {
        const fixture = create(makeDuel({
          players: [alice, bob], status: 'guessing', game: startingGame({ status: 'guessing' }),
        }));

        expect(fixture.componentInstance.showIntro()).toBeFalse();
        fixture.destroy();
      });
    });

    it('ignores updates for other duels', () => {
      const fixture = create(makeDuel());

      realtime.push('duel:updated', { duel: makeDuel({ id: 99, lobbyState: 'cancelled' }) });

      expect(fixture.componentInstance.duel()?.lobbyState).toBe('waiting_for_opponent');
    });

    it('explains when the duel cannot be opened', () => {
      duelApi.getDuel.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 404, error: { error: { code: 'DUEL_NOT_FOUND', message: 'Duel not found.' } },
      })));
      const fixture = TestBed.createComponent(DuelLobby);
      fixture.componentRef.setInput('duelId', '10');
      fixture.detectChanges();
      fixture.detectChanges();

      expect(fixture.componentInstance.loadError()).toContain('does not exist');
    });
  });

  describe('InviteLanding', () => {
    function preview(overrides: Partial<InvitePreview> = {}): InvitePreview {
      return {
        mode: 'duel',
        inviter: { username: 'Alice' },
        totalRounds: 4,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        state: 'open',
        viewerRole: 'invitee',
        duelId: null,
        ...overrides,
      };
    }

    function create(invite: InvitePreview) {
      duelApi.getInvitePreview.and.returnValue(of({ invite }));
      const fixture = TestBed.createComponent(InviteLanding);
      fixture.componentRef.setInput('token', TOKEN);
      fixture.detectChanges();
      return fixture;
    }

    it('shows who invited you and how many rounds before you decide', () => {
      currentUser.set({ id: 2, email: 'bob@example.com', username: 'Bob' });
      const fixture = create(preview());

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Alice challenged you to a 4-round duel');
      expect(text).toContain('Accept duel');
      expect(text).toContain('Decline');
    });

    it('accepting opens the lobby', () => {
      currentUser.set({ id: 2, email: 'bob@example.com', username: 'Bob' });
      duelApi.acceptInvite.and.returnValue(of({ duel: makeDuel({ isCreator: false }) }));
      const fixture = create(preview());

      fixture.componentInstance.accept();

      expect(duelApi.acceptInvite).toHaveBeenCalledWith(TOKEN);
      expect(router.navigate).toHaveBeenCalledWith(['/duel', 10]);
    });

    it('sends a signed-out visitor to sign in and remembers the invite', () => {
      currentUser.set(null);
      const fixture = create(preview({ viewerRole: 'guest' }));
      spyOnProperty(router, 'url', 'get').and.returnValue(`/duel/invite/${TOKEN}`);

      fixture.componentInstance.signIn();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
      expect(takeReturnUrl()).toBe(`/duel/invite/${TOKEN}`);
    });

    it('takes the inviter straight to their own lobby', () => {
      create(preview({ viewerRole: 'inviter', duelId: 10 }));

      expect(router.navigate).toHaveBeenCalledWith(['/duel', 10], { replaceUrl: true });
    });
  });
});

describe('InviteNotice', () => {
  it('also announces friend requests', async () => {
    const { InviteNotice } = await import('../shared/invite-notice/invite-notice');
    const realtime = new FakeRealtime();
    TestBed.configureTestingModule({
      imports: [InviteNotice],
      providers: [provideRouter([]), { provide: RealtimeService, useValue: realtime }],
    });
    const fixture = TestBed.createComponent(InviteNotice);
    fixture.detectChanges();

    realtime.push('friend:request', { request: { requestId: 1, from: { userId: 2, username: 'Bob' }, createdAt: '' } });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bob sent you a friend request.');
    fixture.destroy();
  });
});
