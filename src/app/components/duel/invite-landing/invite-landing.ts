import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';
import { DuelApi } from '../../../services/duel-api';
import { AuthService } from '../../../services/auth-service';
import { apiErrorMessage } from '../../../services/api-error';
import { rememberReturnUrl } from '../../../services/return-url';
import { InvitePreview } from '../../../models/duel';
import { formatExpiresIn } from '../duel-format';

/**
 * Where an invite link lands (public route). Shows who invited you and how many
 * rounds, then Accept / Decline. Signed-out visitors are sent to sign in or
 * register and come back here afterwards.
 */
@Component({
  selector: 'app-invite-landing',
  imports: [Header, Footer, RouterLink],
  templateUrl: './invite-landing.html',
  styleUrl: '../duel-page.css',
})
export class InviteLanding implements OnInit {
  private readonly duelApi = inject(DuelApi);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** From the route /duel/invite/:token. */
  readonly token = input.required<string>();

  readonly invite = signal<InvitePreview | null>(null);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly busy = signal(false);
  readonly declined = signal(false);
  readonly formatExpiresIn = formatExpiresIn;

  ngOnInit(): void {
    // This page has no auth guard, so restore a signed-in session ourselves
    // (it also fills the header). The preview works either way.
    if (this.authService.isLoggedIn) {
      this.loadPreview();
    } else {
      this.authService.checkSession().subscribe(() => this.loadPreview());
    }
  }

  private loadPreview(): void {
    this.duelApi.getInvitePreview(this.token()).subscribe({
      next: ({ invite }) => {
        // Opening your own link just takes you to the lobby.
        if (invite.viewerRole === 'inviter' && invite.duelId) {
          this.router.navigate(['/duel', invite.duelId], { replaceUrl: true });
          return;
        }
        this.invite.set(invite);
      },
      error: (error: unknown) => {
        this.loadError.set(apiErrorMessage(error, 'Could not open this invite. Please try again.'));
      },
    });
  }

  /** Sign in or register, then come back to this invite. */
  signIn(): void {
    rememberReturnUrl(this.router.url);
    this.router.navigate(['/']);
  }

  accept(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.duelApi.acceptInvite(this.token()).subscribe({
      next: ({ duel }) => this.router.navigate(['/duel', duel.id]),
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(apiErrorMessage(error, 'Could not accept the invite. Please try again.'));
      },
    });
  }

  decline(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.duelApi.declineInvite(this.token()).subscribe({
      next: () => {
        this.busy.set(false);
        this.declined.set(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(apiErrorMessage(error, 'Could not decline the invite. Please try again.'));
      },
    });
  }
}
