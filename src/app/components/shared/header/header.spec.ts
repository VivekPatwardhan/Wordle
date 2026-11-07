import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Header } from './header';
import { AuthApi } from '../../../services/auth-api';
import { AuthService } from '../../../services/auth-service';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  const currentUser = signal({
    id: 1,
    email: 'player@example.com',
    username: 'Word Player',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        { provide: AuthApi, useValue: { logout: jasmine.createSpy('logout') } },
        {
          provide: AuthService,
          useValue: { currentUser, isLoggedIn: true, clearSession: jasmine.createSpy('clearSession') },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the username as the player display name', () => {
    const name = fixture.nativeElement.querySelector('.user-name') as HTMLElement;
    expect(name.textContent.trim()).toBe('Word Player');
  });

  it('opens the user menu with profile and log out options', () => {
    const chip = fixture.nativeElement.querySelector('.user-chip') as HTMLButtonElement;
    expect(fixture.nativeElement.querySelector('.user-menu')).toBeNull();

    chip.click();
    fixture.detectChanges();

    const items = [...fixture.nativeElement.querySelectorAll('.menu-item')] as HTMLElement[];
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(items.map((item) => item.textContent?.trim())).toEqual(['My profile', 'Log out']);
  });

  it('closes the menu on Escape and on a click outside the header', () => {
    component.toggleMenu();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.isMenuOpen()).toBeFalse();

    component.toggleMenu();
    document.body.click();
    expect(component.isMenuOpen()).toBeFalse();
  });
});
