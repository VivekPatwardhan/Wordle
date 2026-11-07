import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, QueryList, ViewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Footer } from '../shared/footer/footer';
import { Header } from '../shared/header/header';
import { AuthApi } from '../../services/auth-api';
import { AuthService } from '../../services/auth-service';
import { takeReturnUrl } from '../../services/return-url';
import { USERNAME_PATTERN, usernameAvailableValidator } from '../../validators/username-validators';

@Component({
  selector: 'app-login',
  imports: [Header, Footer, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  /** The auth guard sends `?offline=1` when it couldn't reach the server at all. */
  readonly serverUnreachable = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.has('offline'))),
    { initialValue: false }
  );

  @ViewChildren('otpInput') private otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  isLoginMode = true;
  isOtpStep = false;
  isSubmitting = false;
  statusMessage = '';
  isErrorMessage = false;
  /** Email the verification code went to. The server session knows which user it is. */
  pendingEmail = '';

  authForm = this.fb.group({
    username: [''],
    email: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  otpForm = this.fb.group({
    otp: this.fb.array(
      Array.from({ length: 6 }, () =>
        this.fb.control('', [Validators.required, Validators.pattern(/^[A-Za-z0-9]$/)])
      )
    ),
  });

  constructor() {
    this.updateValidators();
  }

  get username() {
    return this.authForm.controls.username;
  }

  get email() {
    return this.authForm.controls.email;
  }

  get password() {
    return this.authForm.controls.password;
  }

  get otpDigits(): FormArray {
    return this.otpForm.controls.otp;
  }

  onSubmit(): void {
    if (this.isSubmitting || this.authForm.pending) return;

    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      return;
    }

    this.clearStatus();
    this.isSubmitting = true;

    if (this.isLoginMode) {
      const { email, password } = this.authForm.getRawValue();
      this.authApi.login({ emailOrUsername: email ?? '', password: password ?? '' }).subscribe({
        next: ({ user }) => {
          this.authService.setSession(user);
          this.router.navigateByUrl(takeReturnUrl() ?? '/home');
          this.isSubmitting = false;
        },
        error: (error: unknown) => {
          this.isSubmitting = false;
          if (this.isEmailNotVerified(error)) {
            // Correct password, unverified email: the server has sent a code,
            // so continue straight to the code-entry step.
            this.startOtpStep(error.error?.user?.email ?? email ?? '');
            this.statusMessage = error.error?.error?.message ?? '';
            this.isErrorMessage = false;
            return;
          }
          this.showError(error, 'Unable to sign in. Please try again.');
        },
      });
      return;
    }

    const { username, email, password } = this.authForm.getRawValue();
    this.authApi.register({
      username: username ?? '',
      email: email ?? '',
      password: password ?? '',
    }).subscribe({
      next: ({ user }) => {
        this.startOtpStep(user?.email ?? email ?? '');
        this.isSubmitting = false;
      },
      error: (error: unknown) => {
        this.showError(error, 'Unable to create your account. Please try again.');
        this.isSubmitting = false;
      },
    });
  }

  verifyOtp(): void {
    if (!this.isOtpStep || this.isSubmitting) return;

    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.clearStatus();
    this.isSubmitting = true;
    const otp = this.otpDigits.getRawValue().join('').toUpperCase();
    this.authApi.verifyOtp({ otp }).subscribe({
      next: ({ user }) => {
        this.authService.setSession(user);
        this.router.navigateByUrl(takeReturnUrl() ?? '/home');
        this.isSubmitting = false;
      },
      error: (error: unknown) => {
        this.showError(error, 'Unable to verify the code. Please try again.');
        this.isSubmitting = false;
      },
    });
  }

  resendOtp(): void {
    if (!this.isOtpStep || this.isSubmitting) return;

    this.clearStatus();
    this.isSubmitting = true;
    this.authApi.resendOtp().subscribe({
      next: ({ message }) => {
        this.statusMessage = message;
        this.isErrorMessage = false;
        this.otpForm.reset();
        this.isSubmitting = false;
        this.otpInputs.first?.nativeElement.focus();
      },
      error: (error: unknown) => {
        this.showError(error, 'Unable to resend the code. Please try again.');
        this.isSubmitting = false;
      },
    });
  }

  onOtpInput(event: Event, index: number): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const value = target.value.replace(/[^A-Za-z0-9]/g, '').slice(-1).toUpperCase();
    this.otpDigits.at(index).setValue(value);
    target.value = value;
    if (value) this.focusOtp(index + 1);
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    const target = event.target;
    if (
      event.key === 'Backspace'
      && target instanceof HTMLInputElement
      && target.value.length === 0
      && index > 0
    ) {
      this.focusOtp(index - 1);
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    const digits = pasted.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    if (digits.length === 0) return;

    event.preventDefault();
    for (let index = 0; index < 6; index += 1) {
      this.otpDigits.at(index).setValue(digits[index] ?? '');
    }
    this.focusOtp(Math.min(digits.length, 5));
  }

  /** Goes back to the page the guard stopped; it checks the session again. */
  retryConnection(): void {
    this.router.navigateByUrl(takeReturnUrl() ?? '/home');
  }

  toggleMode(): void {
    this.isLoginMode = !this.isLoginMode;
    this.authForm.reset();
    this.clearStatus();
    this.updateValidators();
  }

  /** Leaves the code-entry step, e.g. to sign in with a different account. */
  backToSignIn(): void {
    this.isOtpStep = false;
    this.pendingEmail = '';
    this.otpForm.reset();
    this.clearStatus();
    if (!this.isLoginMode) {
      this.toggleMode();
    }
  }

  private startOtpStep(email: string): void {
    this.pendingEmail = email;
    this.otpForm.reset();
    this.isOtpStep = true;
    this.clearStatus();
  }

  private isEmailNotVerified(error: unknown): error is HttpErrorResponse {
    return error instanceof HttpErrorResponse
      && error.status === 403
      && error.error?.error?.code === 'EMAIL_NOT_VERIFIED';
  }

  private focusOtp(index: number): void {
    this.otpInputs.get(index)?.nativeElement.focus();
  }

  private updateValidators(): void {
    if (this.isLoginMode) {
      this.username.clearValidators();
      this.username.clearAsyncValidators();
      this.email.setValidators([Validators.required]);
    } else {
      this.username.setValidators([
        Validators.required,
        Validators.pattern(USERNAME_PATTERN),
      ]);
      // Async validators only run once the sync validators above pass.
      this.username.setAsyncValidators(usernameAvailableValidator(this.authApi));
      this.email.setValidators([Validators.required, Validators.email]);
    }
    this.username.updateValueAndValidity();
    this.email.updateValueAndValidity();
  }

  private showError(error: unknown, fallback: string): void {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error?.error?.message;
      this.statusMessage = typeof apiMessage === 'string' ? apiMessage : fallback;
    } else if (error instanceof Error && error.message) {
      this.statusMessage = error.message;
    } else {
      this.statusMessage = fallback;
    }
    this.isErrorMessage = true;
  }

  private clearStatus(): void {
    this.statusMessage = '';
    this.isErrorMessage = false;
  }
}
