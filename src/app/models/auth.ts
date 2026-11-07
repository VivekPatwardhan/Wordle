export interface User {
  id: number;
  email: string;
  created_at?: string;
  username?: string;
  email_verified?: boolean | 0 | 1;
  username_changed_at?: string | null;
  /** Set while the 7-day rename cooldown is running; null when a rename is allowed. */
  next_username_change_at?: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

/** The user being verified is kept in the server session, so only the code is sent. */
export interface VerifyOtpRequest {
  otp: string;
}

export interface MessageResponse {
  message: string;
}

export interface AuthResponse {
  user: User;
}

export interface UsernameAvailabilityResponse {
  available: boolean;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    retryAfterSeconds?: number;
    attemptsLeft?: number;
  };
  /** Present on EMAIL_NOT_VERIFIED so the login form can show where the code went. */
  user?: { email: string };
}
