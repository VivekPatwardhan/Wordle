import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { formatLastSeen, PresenceDot } from './presence-dot';
import { PresenceStatus, RealtimeService } from '../../../services/realtime-service';

describe('PresenceDot', () => {
  let fixture: ComponentFixture<PresenceDot>;
  let presence: ReturnType<typeof signal<ReadonlyMap<number, PresenceStatus>>>;
  let realtime: { presence: typeof presence; watch: jasmine.Spy; unwatch: jasmine.Spy };

  beforeEach(async () => {
    presence = signal<ReadonlyMap<number, PresenceStatus>>(new Map());
    realtime = {
      presence,
      watch: jasmine.createSpy('watch'),
      unwatch: jasmine.createSpy('unwatch'),
    };

    await TestBed.configureTestingModule({
      imports: [PresenceDot],
      providers: [{ provide: RealtimeService, useValue: realtime }],
    }).compileComponents();

    fixture = TestBed.createComponent(PresenceDot);
    fixture.componentRef.setInput('userId', 2);
    fixture.detectChanges();
  });

  function dot(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.dot');
  }

  it('watches the player while shown and unwatches when removed', () => {
    expect(realtime.watch).toHaveBeenCalledWith([2]);

    fixture.destroy();

    expect(realtime.unwatch).toHaveBeenCalledWith([2]);
  });

  it('shows nothing when the player\'s status is not visible to us', () => {
    expect(dot()).toBeNull();
  });

  it('shows a green dot for an online player', () => {
    presence.set(new Map([[2, { online: true, lastSeenAt: null }]]));
    fixture.detectChanges();

    expect(dot()?.classList).toContain('online');
    expect(dot()?.getAttribute('aria-label')).toBe('Online');
  });

  it('shows when an offline player was last seen', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    presence.set(new Map([[2, { online: false, lastSeenAt: tenMinutesAgo }]]));
    fixture.detectChanges();

    expect(dot()?.classList).toContain('offline');
    expect(dot()?.getAttribute('aria-label')).toBe('Last seen 10 min ago');
  });
});

describe('formatLastSeen', () => {
  const now = new Date('2026-10-27T12:00:00.000Z').getTime();

  it('describes how long ago a player was online', () => {
    expect(formatLastSeen('2026-10-27T11:59:40.000Z', now)).toBe('Last seen just now');
    expect(formatLastSeen('2026-10-27T11:15:00.000Z', now)).toBe('Last seen 45 min ago');
    expect(formatLastSeen('2026-10-27T09:00:00.000Z', now)).toBe('Last seen 3 h ago');
    expect(formatLastSeen('2026-10-26T12:00:00.000Z', now)).toBe('Last seen 1 day ago');
    expect(formatLastSeen('2026-10-20T12:00:00.000Z', now)).toBe('Last seen 7 days ago');
  });
});
