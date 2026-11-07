import { effect, inject, Injectable, InjectionToken, Injector, signal, untracked } from '@angular/core';
import { filter, map, Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth-service';

/** Server events that pages can subscribe to with `realtime.on(...)`. */
export const RELAYED_EVENTS = ['duel:invited', 'duel:updated', 'duel:draft', 'duel:reaction', 'match:found', 'achievement:unlocked', 'friend:request', 'friends:updated'] as const;
export type RelayedEvent = (typeof RELAYED_EVENTS)[number];

/** Connection state of this browser's live link to the server. */
export type ConnectionStatus = 'offline' | 'connecting' | 'online';

export interface PresenceStatus {
  online: boolean;
  /** ISO time the player was last online; null while online or never seen. */
  lastSeenAt: string | null;
}

interface PresenceUpdate extends PresenceStatus {
  userId: number;
}

interface WatchAck {
  statuses?: PresenceUpdate[];
  error?: { code: string };
}

/** The part of a Socket.IO client socket this app uses (lets tests pass a fake). */
export interface RealtimeSocket {
  on(event: string, listener: (...args: any[]) => void): unknown;
  emit(event: string, ...args: any[]): unknown;
  disconnect(): unknown;
}

export type SocketFactory = (url: string) => Promise<RealtimeSocket>;

/**
 * Creates the Socket.IO connection. socket.io-client is imported lazily, so its
 * ~40 kB only downloads after sign-in instead of with the login page.
 * `withCredentials` sends the session cookie, which is how the server knows who we are.
 */
export const SOCKET_FACTORY = new InjectionToken<SocketFactory>('SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => async (url: string) => {
    const { io } = await import('socket.io-client');
    return io(url, { withCredentials: true }) as unknown as RealtimeSocket;
  },
});

/**
 * One live connection per browser tab while a player is signed in. It powers
 * online dots now, and PvP duels later.
 */
@Injectable({
  providedIn: 'root',
})
export class RealtimeService {
  private readonly authService = inject(AuthService);
  private readonly createSocket = inject(SOCKET_FACTORY);
  private readonly injector = inject(Injector);

  readonly status = signal<ConnectionStatus>('offline');
  private readonly presenceMap = signal<ReadonlyMap<number, PresenceStatus>>(new Map());
  /** Online status of watched players the server allows us to see. */
  readonly presence = this.presenceMap.asReadonly();

  private socket: RealtimeSocket | null = null;
  private connectedUserId: number | null = null;
  /** Bumped on every connect/disconnect, so a slow socket from an old login is discarded. */
  private generation = 0;
  private started = false;
  /** How many components watch each player (several dots may show the same player). */
  private readonly watchCounts = new Map<number, number>();
  private readonly serverEvents = new Subject<{ event: RelayedEvent; payload: unknown }>();

  /**
   * Events pushed by the server (e.g. 'duel:updated'). The stream survives
   * reconnects, so subscribers never need to re-subscribe.
   */
  on<T>(event: RelayedEvent): Observable<T> {
    return this.serverEvents.pipe(
      filter((message) => message.event === event),
      map((message) => message.payload as T),
    );
  }

  /** Called once at app start: connect while signed in, disconnect on sign-out. */
  start(): void {
    if (this.started) return;
    this.started = true;
    effect(() => {
      const userId = this.authService.currentUser()?.id ?? null;
      untracked(() => (userId ? this.connect(userId) : this.disconnect()));
    }, { injector: this.injector });
  }

  /**
   * Sends a fire-and-forget event (live key taps, reactions). Dropped while
   * offline — these are throw-away signals; real moves go over HTTP.
   */
  send(event: 'duel:draft' | 'duel:reaction' | 'match:leave', payload: unknown): void {
    if (this.status() === 'online') this.socket?.emit(event, payload);
  }

  /** Sends an event and waits for the server's reply (Socket.IO acknowledgement). */
  request<T>(event: 'match:join', payload: unknown, timeoutMs = 8000): Promise<T> {
    const socket = this.socket;
    if (!socket || this.status() !== 'online') {
      return Promise.reject(new Error('OFFLINE'));
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
      socket.emit(event, payload, (reply: T) => {
        clearTimeout(timer);
        resolve(reply);
      });
    });
  }

  /** Start receiving online/offline updates for these players. */
  watch(userIds: number[]): void {
    const added = userIds.filter((id) => {
      const count = this.watchCounts.get(id) ?? 0;
      this.watchCounts.set(id, count + 1);
      return count === 0;
    });
    if (added.length > 0 && this.status() === 'online') {
      this.requestStatuses(added);
    }
  }

  unwatch(userIds: number[]): void {
    const removed = userIds.filter((id) => {
      const count = this.watchCounts.get(id) ?? 0;
      if (count <= 1) {
        this.watchCounts.delete(id);
        return count === 1;
      }
      this.watchCounts.set(id, count - 1);
      return false;
    });
    if (removed.length === 0) return;

    this.socket?.emit('presence:unwatch', { userIds: removed });
    this.presenceMap.update((map) => {
      const next = new Map(map);
      for (const id of removed) next.delete(id);
      return next;
    });
  }

  private connect(userId: number): void {
    if (this.connectedUserId === userId) return; // e.g. only the username changed
    this.disconnect();

    this.connectedUserId = userId;
    const generation = ++this.generation;
    this.status.set('connecting');

    this.createSocket(environment.apiUrl).then((socket) => {
      if (generation !== this.generation) {
        socket.disconnect();
        return;
      }
      this.socket = socket;

      socket.on('connect', () => {
        this.status.set('online');
        // After a reconnect the server has forgotten our subscriptions.
        this.requestStatuses([...this.watchCounts.keys()]);
      });

      socket.on('disconnect', (reason: string) => {
        // The client retries by itself, except after the server closed us
        // (logout elsewhere) or we closed it ourselves.
        const retrying = reason !== 'io server disconnect' && reason !== 'io client disconnect';
        this.status.set(retrying ? 'connecting' : 'offline');
      });

      socket.on('connect_error', (error: Error) => {
        // The server refused our session (expired / logged out): stop trying.
        this.status.set(error?.message === 'UNAUTHENTICATED' ? 'offline' : 'connecting');
      });

      socket.on('presence:update', (update: PresenceUpdate) => {
        if (!this.watchCounts.has(update.userId)) return;
        this.setPresence([update]);
      });

      for (const event of RELAYED_EVENTS) {
        socket.on(event, (payload: unknown) => this.serverEvents.next({ event, payload }));
      }
    }).catch(() => {
      if (generation === this.generation) this.status.set('offline');
    });
  }

  private disconnect(): void {
    this.generation++;
    this.socket?.disconnect();
    this.socket = null;
    this.connectedUserId = null;
    this.status.set('offline');
    this.presenceMap.set(new Map());
  }

  private requestStatuses(userIds: number[]): void {
    if (!this.socket || userIds.length === 0) return;
    this.socket.emit('presence:watch', { userIds }, (ack: WatchAck) => {
      if (ack?.statuses) this.setPresence(ack.statuses);
    });
  }

  private setPresence(updates: PresenceUpdate[]): void {
    this.presenceMap.update((map) => {
      const next = new Map(map);
      for (const { userId, online, lastSeenAt } of updates) {
        next.set(userId, { online, lastSeenAt });
      }
      return next;
    });
  }
}
