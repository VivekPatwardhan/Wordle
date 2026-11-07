import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  UsernameAvailabilityResponse,
  VerifyOtpRequest,
} from '../models/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly defaultOptions = { withCredentials: true };

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.baseUrl}/api/auth/register`,
      payload,
      this.defaultOptions
    );
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.baseUrl}/api/auth/login`,
      payload,
      this.defaultOptions
    );
  }

  me(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(
      `${this.baseUrl}/api/auth/me`,
      this.defaultOptions
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/api/auth/logout`,
      null,
      this.defaultOptions
    );
  }

  verifyOtp(payload: VerifyOtpRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.baseUrl}/api/auth/verify-otp`,
      payload,
      this.defaultOptions
    );
  }

  verifyByToken(token: string): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(
      `${this.baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`,
      this.defaultOptions
    );
  }

  resendOtp(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.baseUrl}/api/auth/resend-otp`,
      {},
      this.defaultOptions
    );
  }

  checkUsernameAvailability(username: string): Observable<UsernameAvailabilityResponse> {
    return this.http.get<UsernameAvailabilityResponse>(
      `${this.baseUrl}/api/auth/username-available`,
      { ...this.defaultOptions, params: { username } }
    );
  }
}
