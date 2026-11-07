import { signal } from '@angular/core';
import { filter, map, Observable, Subject } from 'rxjs';
import { PresenceStatus, RelayedEvent } from '../services/realtime-service';

/** Test stand-in for RealtimeService: lets a spec push server events by hand. */
export class FakeRealtime {
  private readonly events = new Subject<{ event: RelayedEvent; payload: unknown }>();
  readonly status = signal<'offline' | 'connecting' | 'online'>('online');
  readonly presence = signal<ReadonlyMap<number, PresenceStatus>>(new Map());
  readonly watch = jasmine.createSpy('watch');
  readonly unwatch = jasmine.createSpy('unwatch');
  readonly start = jasmine.createSpy('start');
  readonly send = jasmine.createSpy('send');
  /** Resolve with `request.and.resolveTo(reply)` in a spec. */
  readonly request = jasmine.createSpy('request').and.resolveTo({ status: 'waiting', waitingCount: 1 });

  on<T>(event: RelayedEvent): Observable<T> {
    return this.events.pipe(
      filter((message) => message.event === event),
      map((message) => message.payload as T),
    );
  }

  /** Simulates the server pushing an event. */
  push(event: RelayedEvent, payload: unknown): void {
    this.events.next({ event, payload });
  }
}
