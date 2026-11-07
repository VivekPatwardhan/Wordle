import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { defer, Observable, of, throwError } from 'rxjs';
import { AuthService, SessionCheck } from './auth-service';
import { AuthApi } from './auth-api';
import { User } from '../models/auth';

const me: User = { id: 1, email: 'me@example.com', username: 'Me' } as User;
const httpError = (status: number) => new HttpErrorResponse({ status });

/** Like an HttpClient request: each (re)subscription is a new request. */
function requests(...responses: Array<() => Observable<unknown>>) {
  let sent = 0;
  const source = defer(() => responses[Math.min(sent++, responses.length - 1)]());
  return { source: source as Observable<never>, sent: () => sent };
}

describe('AuthService', () => {
  let service: AuthService;
  let authApi: jasmine.SpyObj<AuthApi>;

  const check = () => {
    let result: SessionCheck | undefined;
    service.checkSession().subscribe((r) => (result = r));
    return () => result;
  };

  beforeEach(() => {
    authApi = jasmine.createSpyObj<AuthApi>('AuthApi', ['me']);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthApi, useValue: authApi }],
    });
    service = TestBed.inject(AuthService);
    spyOn(console, 'error');
  });

  it('stores the user when the session is valid', () => {
    authApi.me.and.returnValue(of({ user: me }) as Observable<never>);

    expect(check()()).toBe('signed-in');
    expect(service.currentUser()).toEqual(me);
  });

  it('signs out on a 401, without retrying', () => {
    service.setSession(me);
    const http = requests(() => throwError(() => httpError(401)));
    authApi.me.and.returnValue(http.source);

    expect(check()()).toBe('signed-out');
    expect(service.currentUser()).toBeNull();
    expect(http.sent()).toBe(1);
  });

  for (const status of [0, 500, 503]) {
    it(`keeps the user when the server can't be reached (status ${status})`, fakeAsync(() => {
      service.setSession(me);
      const http = requests(() => throwError(() => httpError(status)));
      authApi.me.and.returnValue(http.source);

      const result = check();
      tick(3000); // the two retries

      expect(result()).toBe('unreachable');
      expect(service.currentUser()).toEqual(me);
      expect(http.sent()).toBe(3);
    }));
  }

  it('recovers when a retry succeeds', fakeAsync(() => {
    authApi.me.and.returnValue(requests(
      () => throwError(() => httpError(0)),
      () => of({ user: me }),
    ).source);

    const result = check();
    tick(1000);

    expect(result()).toBe('signed-in');
    expect(service.currentUser()).toEqual(me);
  }));

  describe('when the tab becomes visible again', () => {
    let navigate: jasmine.Spy;

    beforeEach(() => {
      navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      service.setSession(me);
    });

    const returnToTab = () => document.dispatchEvent(new Event('visibilitychange'));

    it('stays signed in after a network blip', fakeAsync(() => {
      authApi.me.and.returnValue(throwError(() => httpError(0)));

      returnToTab();
      tick(3000);

      expect(navigate).not.toHaveBeenCalled();
      expect(service.isLoggedIn).toBeTrue();
    }));

    it('goes to the login page when the session has ended', () => {
      authApi.me.and.returnValue(throwError(() => httpError(401)));

      returnToTab();

      expect(navigate).toHaveBeenCalledWith(['']);
      expect(service.isLoggedIn).toBeFalse();
    });
  });
});
