import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatchmakingService } from './matchmaking-service';
import { RealtimeService } from './realtime-service';
import { FakeRealtime } from '../testing/fake-realtime';

describe('MatchmakingService', () => {
  let service: MatchmakingService;
  let realtime: FakeRealtime;
  let router: Router;

  beforeEach(() => {
    realtime = new FakeRealtime();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: RealtimeService, useValue: realtime }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    service = TestBed.inject(MatchmakingService);
    TestBed.tick();
  });

  it('joins the queue and shows that it is searching', async () => {
    realtime.request.and.resolveTo({ status: 'waiting', waitingCount: 1 });

    await (service as any).join(4, 1000);

    expect(realtime.request).toHaveBeenCalledWith('match:join', { totalRounds: 4, mode: 'duel' });
    expect(service.state()).toEqual({ status: 'searching', mode: 'duel', totalRounds: 4, startedAt: 1000, waitingCount: 1 });
  });

  it('opens the duel straight away when an opponent was already waiting', async () => {
    realtime.request.and.resolveTo({ status: 'matched', duelId: 42 });

    await (service as any).join(4, 1000);

    expect(router.navigate).toHaveBeenCalledWith(['/duel', 42]);
    expect(service.state().status).toBe('idle');
  });

  it('opens the duel when a match is found later (pushed by the server)', async () => {
    await (service as any).join(6, 1000);

    realtime.push('match:found', { duelId: 77, totalRounds: 6 });

    expect(router.navigate).toHaveBeenCalledWith(['/duel', 77]);
    expect(service.state().status).toBe('idle');
  });

  it('shows why the server refused the search', async () => {
    realtime.request.and.resolveTo({ error: { code: 'ALREADY_IN_DUEL', message: 'Finish your current duel first.' } });

    await (service as any).join(4, 1000);

    expect(service.state()).toEqual({ status: 'error', message: 'Finish your current duel first.' });
  });

  it('cancelling leaves the queue', async () => {
    await (service as any).join(4, 1000);

    service.cancel();

    expect(realtime.send).toHaveBeenCalledWith('match:leave', {});
    expect(service.state().status).toBe('idle');
  });

  it('re-joins after the connection comes back', async () => {
    await (service as any).join(4, 1000);
    realtime.request.calls.reset();

    realtime.status.set('connecting');
    TestBed.tick();
    realtime.status.set('online');
    TestBed.tick();

    expect(realtime.request).toHaveBeenCalledWith('match:join', { totalRounds: 4, mode: 'duel' });
  });
});

describe('MatchmakingService duplicate match messages', () => {
  it('opens a matched duel once, even when it arrives as reply and push', async () => {
    const realtime = new FakeRealtime();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: RealtimeService, useValue: realtime }],
    });
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const service = TestBed.inject(MatchmakingService);
    realtime.request.and.resolveTo({ status: 'matched', duelId: 9 });

    await (service as any).join(4, 1000);
    realtime.push('match:found', { duelId: 9, totalRounds: 4 }); // same match, also pushed

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/duel', 9]);
  });
});
