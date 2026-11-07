import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AchievementToast } from './achievement-toast';
import { RealtimeService } from '../../../services/realtime-service';
import { FakeRealtime } from '../../../testing/fake-realtime';

const badge = (key: string, title: string) => ({
  key, title, icon: '🏆', category: 'duels', description: `${title} description`, threshold: 1,
});

describe('AchievementToast', () => {
  let fixture: ComponentFixture<AchievementToast>;
  let realtime: FakeRealtime;

  beforeEach(() => {
    realtime = new FakeRealtime();
    TestBed.configureTestingModule({
      imports: [AchievementToast],
      providers: [provideRouter([]), { provide: RealtimeService, useValue: realtime }],
    });
    fixture = TestBed.createComponent(AchievementToast);
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('celebrates each unlocked achievement in turn', fakeAsync(() => {
    realtime.push('achievement:unlocked', { achievements: [badge('a', 'Duelist'), badge('b', 'Nemesis')] });
    fixture.detectChanges();
    expect(text()).toContain('Achievement unlocked!');
    expect(text()).toContain('Duelist');

    tick(5000);
    fixture.detectChanges();
    expect(text()).toContain('Nemesis');

    tick(5000);
    fixture.detectChanges();
    expect(text()).not.toContain('Achievement unlocked!');
  }));

  it('opens the profile when tapped', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    realtime.push('achievement:unlocked', { achievements: [badge('a', 'Duelist')] });
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.toast')!.click();

    expect(navigate).toHaveBeenCalledWith(['/profile']);
    fixture.destroy();
  });
});
