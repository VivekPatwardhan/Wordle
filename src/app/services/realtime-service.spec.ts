import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RealtimeService, RealtimeSocket, SOCKET_FACTORY } from './realtime-service';
import { AuthService } from './auth-service';
import { User } from '../models/auth';

/** Records what the service sends and lets the test play the server's part. */
class FakeSocket implements RealtimeSocket {
  private readonly handlers = new Map<string, ((...args: any[]) => void)[]>();
  readonly emitted: { event: string; args: any[] }[] = [];
  disconnected = false;

  on(event: string, listener: (...args: any[]) => void): void {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), listener]);
  }

  emit(event: string, ...args: any[]): void {
    this.emitted.push({ event, args });
  }

  disconnect(): void {
    this.disconnected = true;
  }

  /** Simulates an event arriving from the server. */
  receive(event: string, ...args: any[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }

  /** Answers the last presence:watch request. */
  ackLastWatch(statuses: unknown[]): void {
    const request = [...this.emitted].reverse().find((entry) => entry.event === 'presence:watch');
    request?.args[1]({ statuses });
  }
}

describe('RealtimeService', () => {
  let service: RealtimeService;
  let currentUser: ReturnType<typeof signal<User | null>>;
  let sockets: FakeSocket[];

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
  }

  function latestSocket(): FakeSocket {
    return sockets[sockets.length - 1];
  }

  beforeEach(() => {
    sockets = [];
    currentUser = signal<User | null>(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser } },
        {
          provide: SOCKET_FACTORY,
          useValue: async () => {
            const socket = new FakeSocket();
            sockets.push(socket);
            return socket;
          },
        },
      ],
    });
    service = TestBed.inject(RealtimeService);
    service.start();
  });

  it('stays offline while signed out', async () => {
    await settle();

    expect(sockets.length).toBe(0);
    expect(service.status()).toBe('offline');
  });

  it('connects when a player signs in and disconnects when they sign out', async () => {
    currentUser.set({ id: 1, email: 'a@example.com', username: 'Alice' });
    await settle();
    expect(service.status()).toBe('connecting');

    latestSocket().receive('connect');
    expect(service.status()).toBe('online');

    currentUser.set(null);
    await settle();
    expect(latestSocket().disconnected).toBeTrue();
    expect(service.status()).toBe('offline');
  });

  it('keeps the same connection when only the username changes', async () => {
    currentUser.set({ id: 1, email: 'a@example.com', username: 'Alice' });
    await settle();
    currentUser.set({ id: 1, email: 'a@example.com', username: 'Alice B' });
    await settle();

    expect(sockets.length).toBe(1);
    expect(sockets[0].disconnected).toBeFalse();
  });

  it('asks for watched players once connected and stores their status', async () => {
    service.watch([2]);
    currentUser.set({ id: 1, email: 'a@example.com' });
    await settle();
    const socket = latestSocket();

    socket.receive('connect');
    expect(socket.emitted[0].event).toBe('presence:watch');
    expect(socket.emitted[0].args[0]).toEqual({ userIds: [2] });

    socket.ackLastWatch([{ userId: 2, online: true, lastSeenAt: null }]);
    expect(service.presence().get(2)).toEqual({ online: true, lastSeenAt: null });

    socket.receive('presence:update', { userId: 2, online: false, lastSeenAt: '2026-10-27T08:00:00.000Z' });
    expect(service.presence().get(2)?.online).toBeFalse();
  });

  it('ignores updates for players nobody is watching', async () => {
    currentUser.set({ id: 1, email: 'a@example.com' });
    await settle();
    latestSocket().receive('connect');

    latestSocket().receive('presence:update', { userId: 9, online: true, lastSeenAt: null });

    expect(service.presence().has(9)).toBeFalse();
  });

  it('stops watching a player only when the last dot for them goes away', async () => {
    currentUser.set({ id: 1, email: 'a@example.com' });
    await settle();
    const socket = latestSocket();
    socket.receive('connect');

    service.watch([2]);
    service.watch([2]); // a second dot for the same player
    expect(socket.emitted.filter((e) => e.event === 'presence:watch').length).toBe(1);

    service.unwatch([2]);
    expect(socket.emitted.some((e) => e.event === 'presence:unwatch')).toBeFalse();

    service.unwatch([2]);
    expect(socket.emitted.at(-1)).toEqual({ event: 'presence:unwatch', args: [{ userIds: [2] }] });
  });

  it('goes offline and stops when the server rejects the session', async () => {
    currentUser.set({ id: 1, email: 'a@example.com' });
    await settle();

    latestSocket().receive('connect_error', new Error('UNAUTHENTICATED'));

    expect(service.status()).toBe('offline');
  });

  it('shows "connecting" while the client retries after a dropped connection', async () => {
    currentUser.set({ id: 1, email: 'a@example.com' });
    await settle();
    latestSocket().receive('connect');

    latestSocket().receive('disconnect', 'transport close');
    expect(service.status()).toBe('connecting');

    latestSocket().receive('disconnect', 'io server disconnect');
    expect(service.status()).toBe('offline');
  });
});
