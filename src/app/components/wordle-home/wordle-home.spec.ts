import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { WordleHome } from './wordle-home';
import { GameApi } from '../../services/game-api';
import { AuthApi } from '../../services/auth-api';
import { AuthService } from '../../services/auth-service';

describe('WordleHome', () => {
  let component: WordleHome;
  let fixture: ComponentFixture<WordleHome>;
  let gameApi: jasmine.SpyObj<GameApi>;
  let router: Router;

  beforeEach(async () => {
    gameApi = jasmine.createSpyObj<GameApi>('GameApi', ['createGame']);

    await TestBed.configureTestingModule({
      imports: [WordleHome],
      providers: [
        provideRouter([]),
        { provide: GameApi, useValue: gameApi },
        // The header shows the signed-in user and a log-out action.
        { provide: AuthApi, useValue: { logout: jasmine.createSpy('logout') } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 1, email: 'player@example.com', username: 'Player' }),
            isLoggedIn: true,
            clearSession: jasmine.createSpy('clearSession'),
          },
        },
      ],
    })
    .compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(WordleHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates a daily game and opens it', () => {
    gameApi.createGame.and.returnValue(of({
      game: { id: 12, mode: 'daily', status: 'in_progress', guesses: [] },
    }));

    component.dailyGame('daily');

    expect(gameApi.createGame).toHaveBeenCalledWith({ mode: 'daily' });
    expect(router.navigate).toHaveBeenCalledWith(['/game', 12], jasmine.anything());
  });
});
