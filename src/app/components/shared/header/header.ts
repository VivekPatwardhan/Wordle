import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { AuthService } from '../../../services/auth-service';
import { AuthApi } from '../../../services/auth-api';
import { RealtimeService } from '../../../services/realtime-service';
import { StatusDot } from '../status-dot/status-dot';
import { InviteNotice } from '../invite-notice/invite-notice';
import { AchievementToast } from '../achievement-toast/achievement-toast';
import { PlayerCard } from '../player-card/player-card';
import { PlayerCardService } from '../../../services/player-card-service';

const CONNECTION_LABELS = {
  online: 'You are online',
  connecting: 'Connecting…',
  offline: 'Offline — live features unavailable',
} as const;

@Component({
  selector: 'app-header',
  imports: [RouterLink, UpperCasePipe, StatusDot, InviteNotice, AchievementToast, PlayerCard],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private authApi = inject(AuthApi);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);
  authService = inject(AuthService);
  readonly realtime = inject(RealtimeService);
  /** The player card is only created while open. */
  readonly playerCard = inject(PlayerCardService);

  readonly isMenuOpen = signal(false);
  readonly connectionLabel = computed(() => CONNECTION_LABELS[this.realtime.status()]);

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  /** Closes the menu when the user clicks anywhere outside the header. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMenuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  logOut() {
    this.closeMenu();
    return this.authApi.logout().subscribe({
      next: () => {
        this.authService.clearSession();
        this.router.navigate(['/']);
      },
      error: (err) => console.error('Logout failed.', err),
    });
  }
}
