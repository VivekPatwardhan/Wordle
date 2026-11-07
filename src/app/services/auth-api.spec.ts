import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthApi } from './auth-api';
import { environment } from '../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth';

describe('AuthApi', () => {
  let service: AuthApi;
  let httpTesting: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthApi,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should post register request with credentials', () => {
    const payload: RegisterRequest = { email: 'test@example.com', password: 'password123' };
    const mockResponse: AuthResponse = { user: { id: 1, email: 'test@example.com' } };

    service.register(payload).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/auth/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(mockResponse);
  });

  it('should post login request with credentials', () => {
    const payload: LoginRequest = { emailOrUsername: 'test@example.com', password: 'password123' };
    const mockResponse: AuthResponse = { user: { id: 1, email: 'test@example.com' } };

    service.login(payload).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(mockResponse);
  });

  it('should get current session user with credentials', () => {
    const mockResponse: AuthResponse = { user: { id: 1, email: 'test@example.com' } };

    service.me().subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/auth/me`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(mockResponse);
  });

  it('should post logout request with credentials', () => {
    service.logout().subscribe();

    const req = httpTesting.expectOne(`${baseUrl}/api/auth/logout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null);
  });

  it('should post an OTP verification request with credentials', () => {
    const payload = { otp: 'A2B3C4' };
    const mockResponse: AuthResponse = { user: { id: 4, email: 'test@example.com' } };

    service.verifyOtp(payload).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/auth/verify-otp`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(mockResponse);
  });

  it('should verify a magic-link token with credentials', () => {
    const token = 'abc123';
    const mockResponse: AuthResponse = { user: { id: 4, email: 'test@example.com' } };

    service.verifyByToken(token).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/auth/verify?token=abc123`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(mockResponse);
  });

  it('should resend a verification code with credentials', () => {
    service.resendOtp().subscribe((res) => {
      expect(res.message).toBe('Verification email resent.');
    });

    const req = httpTesting.expectOne(`${baseUrl}/api/auth/resend-otp`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ message: 'Verification email resent.' });
  });

  it('should check username availability with an encoded query parameter', () => {
    service.checkUsernameAvailability('Word Player').subscribe((res) => {
      expect(res.available).toBeTrue();
    });

    const req = httpTesting.expectOne(
      (request) => request.url === `${baseUrl}/api/auth/username-available`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('username')).toBe('Word Player');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ available: true });
  });
});
