import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthApi } from '../../../services/auth-api';
import { AuthService } from '../../../services/auth-service';
import { ProfileApi } from '../../../services/profile-api';
import { USERNAME_PATTERN, usernameAvailableValidator } from '../../../validators/username-validators';

/** Display only — the backend enforces the real rule and reports the exact date. */
const RENAME_COOLDOWN_DAYS = 7;

@Component({
  selector: 'app-username-editor',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './username-editor.html',
  styleUrl: './username-editor.css',
})
export class UsernameEditor {
  private readonly authApi = inject(AuthApi);
  private readonly profileApi = inject(ProfileApi);
  private readonly authService = inject(AuthService);

  readonly cooldownDays = RENAME_COOLDOWN_DAYS;
  readonly isEditing = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  /** When the next rename would be allowed if the player saves right now. */
  readonly nextChangeIfSavedNow = signal<Date | null>(null);

  readonly currentUsername = computed(() => this.authService.currentUser()?.username ?? '');

  /** Set while the cooldown from the last rename is still running. */
  readonly nextChangeAt = computed(() => {
    const value = this.authService.currentUser()?.next_username_change_at;
    const date = value ? new Date(value) : null;
    return date && date.getTime() > Date.now() ? date : null;
  });

  readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(USERNAME_PATTERN)],
      asyncValidators: [usernameAvailableValidator(this.authApi, () => this.currentUsername())],
    }),
  });

  get username() {
    return this.form.controls.username;
  }

  startEditing(): void {
    this.form.reset({ username: this.currentUsername() });
    this.errorMessage.set('');
    this.successMessage.set('');
    this.nextChangeIfSavedNow.set(new Date(Date.now() + RENAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000));
    this.isEditing.set(true);
  }

  cancel(): void {
    this.isEditing.set(false);
    this.errorMessage.set('');
  }

  save(): void {
    if (this.isSaving() || this.form.pending || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.profileApi.changeUsername(this.username.value.trim()).subscribe({
      next: ({ user }) => {
        // Updates the header and profile name everywhere at once.
        this.authService.setSession(user);
        this.isSaving.set(false);
        this.isEditing.set(false);
        this.successMessage.set(`Your username is now ${user.username}.`);
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.handleError(error);
      },
    });
  }

  private handleError(error: unknown): void {
    const apiError = error instanceof HttpErrorResponse ? error.error?.error : undefined;

    if (apiError?.code === 'USERNAME_CHANGE_COOLDOWN' && apiError.nextChangeAt) {
      // Our copy of the user was stale (e.g. renamed in another tab): store the
      // server's date so the page switches to the "you can change it on…" state.
      const user = this.authService.currentUser();
      if (user) {
        this.authService.setSession({ ...user, next_username_change_at: apiError.nextChangeAt });
      }
      this.isEditing.set(false);
      return;
    }

    if (apiError?.code === 'USERNAME_IN_USE') {
      this.username.setErrors({ usernameTaken: true });
      return;
    }

    this.errorMessage.set(
      typeof apiError?.message === 'string'
        ? apiError.message
        : 'Could not change your username. Please try again.'
    );
  }
}
