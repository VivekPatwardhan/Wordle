import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { RealtimeService } from './services/realtime-service';

describe('App', () => {
  let realtime: { start: jasmine.Spy };

  beforeEach(async () => {
    realtime = { start: jasmine.createSpy('start') };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compileComponents();
  });

  it('opens the live connection manager on startup', () => {
    TestBed.createComponent(App);
    expect(realtime.start).toHaveBeenCalled();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the router outlet that hosts every page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
