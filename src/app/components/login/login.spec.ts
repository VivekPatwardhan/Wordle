import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { Login } from './login';
import { AuthApi } from '../../services/auth-api';
import { AuthService } from '../../services/auth-service';
import { User } from '../../models/auth';
import { rememberReturnUrl } from '../../services/return-url';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authApi: jasmine.SpyObj<AuthApi>;
  let authService: {
    currentUser: ReturnType<typeof signal<User | null>>;
    isLoggedIn: boolean;
    setSession: jasmine.Spy;
    clearSession: jasmine.Spy;
  };
  let router: Router;

  beforeEach(async () => {
    authApi = jasmine.createSpyObj<AuthApi>('AuthApi', [
      'login',
      'register',
      'verifyOtp',
      'resendOtp',
      'checkUsernameAvailability',
      'logout',
    ]);
    authApi.checkUsernameAvailability.and.returnValue(of({ available: true }));
    authService = {
      currentUser: signal<User | null>(null),
      isLoggedIn: false,
      setSession: jasmine.createSpy('setSession'),
      clearSession: jasmine.createSpy('clearSession'),
    };
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        // The real router is needed because the header uses routerLink.
        provideRouter([]),
        { provide: AuthApi, useValue: authApi },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submits the email-or-username login contract and stores the returned user', () => {
    const user = { id: 7, email: 'player@example.com', username: 'Player' };
    authApi.login.and.returnValue(of({ user }));
    component.authForm.setValue({
      username: '',
      email: 'Player',
      password: 'password123',
    });

    component.onSubmit();

    expect(authApi.login).toHaveBeenCalledWith({
      emailOrUsername: 'Player',
      password: 'password123',
    });
    expect(authService.setSession).toHaveBeenCalledWith(user);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('moves registration to OTP verification without logging in', fakeAsync(() => {
    authApi.register.and.returnValue(of({
      user: { id: 19, email: 'player@example.com', username: 'Player' },
    }));
    component.toggleMode();
    component.authForm.setValue({
      username: 'Player',
      email: 'player@example.com',
      password: 'password123',
    });
    tick(1000); // let the debounced username check finish

    component.onSubmit();

    expect(authApi.register).toHaveBeenCalledWith({
      username: 'Player',
      email: 'player@example.com',
      password: 'password123',
    });
    expect(component.isOtpStep).toBeTrue();
    expect(component.pendingEmail).toBe('player@example.com');
    expect(authService.setSession).not.toHaveBeenCalled();
  }));

  it('checks the username only once, 1 second after typing stops', fakeAsync(() => {
    component.toggleMode();
    component.username.setValue('Pla');
    tick(500);
    component.username.setValue('Player');
    tick(999);
    expect(authApi.checkUsernameAvailability).not.toHaveBeenCalled();

    tick(1);
    expect(authApi.checkUsernameAvailability).toHaveBeenCalledOnceWith('Player');
  }));

  it('marks a taken username as invalid', fakeAsync(() => {
    authApi.checkUsernameAvailability.and.returnValue(of({ available: false }));
    component.toggleMode();
    component.username.setValue('Player');
    tick(1000);

    expect(component.username.hasError('usernameTaken')).toBeTrue();
  }));

  it('sends an unverified user who signs in to the code-entry step', () => {
    authApi.login.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 403,
      error: {
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email. We sent a new code to player@example.com.' },
        user: { email: 'player@example.com' },
      },
    })));
    component.authForm.setValue({ username: '', email: 'Player', password: 'password123' });

    component.onSubmit();

    expect(component.isOtpStep).toBeTrue();
    expect(component.pendingEmail).toBe('player@example.com');
    expect(component.isErrorMessage).toBeFalse();
    expect(authService.setSession).not.toHaveBeenCalled();
  });

  it('verifies the six-character code, stores the user, and navigates home', () => {
    const user = { id: 19, email: 'player@example.com', username: 'Player' };
    authApi.verifyOtp.and.returnValue(of({ user }));
    component.isOtpStep = true;
    component.pendingEmail = user.email;
    ['A', '2', 'B', '3', 'C', '4'].forEach((character, index) => {
      component.otpDigits.at(index).setValue(character);
    });

    component.verifyOtp();

    expect(authApi.verifyOtp).toHaveBeenCalledWith({ otp: 'A2B3C4' });
    expect(authService.setSession).toHaveBeenCalledWith(user);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });
});

describe('Login when the server is unreachable', () => {
  it('explains it and retries the page the guard stopped', async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: Login }]),
        { provide: AuthApi, useValue: jasmine.createSpyObj<AuthApi>('AuthApi', ['logout']) },
        { provide: AuthService, useValue: { currentUser: signal(null), isLoggedIn: false } },
      ],
    }).compileComponents();
    const harness = await RouterTestingHarness.create();
    const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

    await harness.navigateByUrl('/');
    expect(text()).not.toContain("Can't reach the server");

    const login = await harness.navigateByUrl('/?offline=1', Login);
    harness.detectChanges();
    expect(text()).toContain("Can't reach the server");

    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    rememberReturnUrl('/profile');
    login.retryConnection();
    expect(navigate).toHaveBeenCalledWith('/profile');
  });
});
