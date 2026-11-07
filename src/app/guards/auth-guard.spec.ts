import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot, CanActivateFn, provideRouter, Router, RouterStateSnapshot, UrlTree,
} from '@angular/router';
import { Observable, of } from 'rxjs';

import { authGuard } from './auth-guard';
import { AuthService, SessionCheck } from '../services/auth-service';

describe('authGuard', () => {
  let loggedIn: boolean;
  let sessionResult: SessionCheck;

  const executeGuard: CanActivateFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  const run = () => {
    let outcome: boolean | UrlTree | undefined;
    const result = executeGuard({} as ActivatedRouteSnapshot, { url: '/profile' } as RouterStateSnapshot);
    if (result instanceof Observable) {
      result.subscribe((value) => (outcome = value as boolean | UrlTree));
    } else {
      outcome = result as boolean | UrlTree;
    }
    return outcome;
  };
  const url = (outcome: unknown) => TestBed.inject(Router).serializeUrl(outcome as UrlTree);

  beforeEach(() => {
    loggedIn = false;
    sessionResult = 'signed-in';
    localStorage.removeItem('wordle.returnUrl');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            get isLoggedIn() { return loggedIn; },
            checkSession: () => of(sessionResult),
          },
        },
      ],
    });
  });

  afterEach(() => localStorage.removeItem('wordle.returnUrl'));

  it('lets a signed-in player straight through', () => {
    loggedIn = true;
    expect(run()).toBeTrue();
  });

  it('allows the page when the server confirms the session', () => {
    expect(run()).toBeTrue();
  });

  it('sends a signed-out visitor to the login page', () => {
    sessionResult = 'signed-out';
    expect(url(run())).toBe('/');
  });

  it("explains instead of logging out when the server can't be reached", () => {
    sessionResult = 'unreachable';
    expect(url(run())).toBe('/?offline=1');
  });
});
