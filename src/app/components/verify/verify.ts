import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Footer } from '../shared/footer/footer';
import { Header } from '../shared/header/header';
import { AuthApi } from '../../services/auth-api';
import { AuthService } from '../../services/auth-service';
import { takeReturnUrl } from '../../services/return-url';

@Component({
  selector: 'app-verify',
  imports: [Header, Footer, RouterLink],
  templateUrl: './verify.html',
  styleUrl: './verify.css',
})
export class Verify implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly authService = inject(AuthService);

  message = 'Checking your verification link…';
  isError = false;
  isLoading = true;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.message = 'This verification link is missing its token. Please request a new code.';
      this.isError = true;
      this.isLoading = false;
      return;
    }

    this.authApi.verifyByToken(token).subscribe({
      next: ({ user }) => {
        this.authService.setSession(user);
        this.message = 'Email verified. Redirecting to your game…';
        this.isLoading = false;
        this.router.navigateByUrl(takeReturnUrl() ?? '/home');
      },
      error: (error: unknown) => {
        const apiMessage = error instanceof HttpErrorResponse
          ? error.error?.error?.message
          : undefined;
        this.message = typeof apiMessage === 'string'
          ? apiMessage
          : 'This link is invalid or expired. Please request a new code.';
        this.isError = true;
        this.isLoading = false;
      },
    });
  }
}
