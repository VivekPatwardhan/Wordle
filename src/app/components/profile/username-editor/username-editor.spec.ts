import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UsernameEditor } from './username-editor';
import { AuthApi } from '../../../services/auth-api';
import { AuthService } from '../../../services/auth-service';
import { ProfileApi } from '../../../services/profile-api';
import { User } from '../../../models/auth';

describe('UsernameEditor', () => {
  let fixture: ComponentFixture<UsernameEditor>;
  let component: UsernameEditor;
  let authApi: jasmine.SpyObj<AuthApi>;
  let profileApi: jasmine.SpyObj<ProfileApi>;
  let currentUser: ReturnType<typeof signal<User | null>>;
  let setSession: jasmine.Spy;

  beforeEach(async () => {
    authApi = jasmine.createSpyObj<AuthApi>('AuthApi', ['checkUsernameAvailability']);
    authApi.checkUsernameAvailability.and.returnValue(of({ available: true }));
    profileApi = jasmine.createSpyObj<ProfileApi>('ProfileApi', ['changeUsername']);
    currentUser = signal<User | null>({ id: 1, email: 'player@example.com', username: 'Player' });
    setSession = jasmine.createSpy('setSession').and.callFake((user: User) => currentUser.set(user));

    await TestBed.configureTestingModule({
      imports: [UsernameEditor],
      providers: [
        { provide: AuthApi, useValue: authApi },
        { provide: ProfileApi, useValue: profileApi },
        { provide: AuthService, useValue: { currentUser, setSession } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsernameEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the 7-day caution while editing', () => {
    component.startEditing();
    fixture.detectChanges();

    expect(text()).toContain('once every 7 days');
  });

  it('checks the new name only once, 1 second after typing stops', fakeAsync(() => {
    component.startEditing();
    component.username.setValue('Word');
    tick(400);
    component.username.setValue('Word Smith');
    tick(999);
    expect(authApi.checkUsernameAvailability).not.toHaveBeenCalled();

    tick(1);
    expect(authApi.checkUsernameAvailability).toHaveBeenCalledOnceWith('Word Smith');
  }));

  it('never calls the server for your own name', fakeAsync(() => {
    component.startEditing();
    component.username.setValue('Player');
    tick(1000);

    expect(component.username.hasError('sameAsCurrent')).toBeTrue();
    expect(authApi.checkUsernameAvailability).not.toHaveBeenCalled();
  }));

  it('saves the new name and updates the signed-in user', fakeAsync(() => {
    const updated: User = {
      id: 1,
      email: 'player@example.com',
      username: 'Word Smith',
      next_username_change_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    profileApi.changeUsername.and.returnValue(of({ user: updated }));
    component.startEditing();
    component.username.setValue('Word Smith');
    tick(1000);

    component.save();
    fixture.detectChanges();

    expect(profileApi.changeUsername).toHaveBeenCalledWith('Word Smith');
    expect(setSession).toHaveBeenCalledWith(updated);
    expect(component.isEditing()).toBeFalse();
    expect(text()).toContain('You can change your username again on');
  }));

  it('switches to the cooldown message when the server rejects a rename', fakeAsync(() => {
    const nextChangeAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    profileApi.changeUsername.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 429,
      error: { error: { code: 'USERNAME_CHANGE_COOLDOWN', message: 'Cooldown', nextChangeAt } },
    })));
    component.startEditing();
    component.username.setValue('Word Smith');
    tick(1000);

    component.save();
    fixture.detectChanges();

    expect(component.nextChangeAt()?.toISOString()).toBe(nextChangeAt);
    expect(text()).not.toContain('Change username');
  }));
});
