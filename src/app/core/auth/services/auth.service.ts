// src/app/core/auth/services/auth.service.ts

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';

import { API_BASE_URL } from '../../api/api.config';
import { AuthenticationResult, LoginCredentials, RegistrationData } from '../models/auth.model';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private readonly http: HttpClient,
    private readonly sessionService: SessionService,
  ) {}

  /** Meldet einen Nutzer über eine serverseitige Django-Sitzung an. */
  login(credentials: LoginCredentials): Observable<AuthenticationResult> {
    return this.ensureCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<AuthenticationResult>(`${API_BASE_URL}/auth/login/`, credentials),
      ),
      tap(({ user }) => this.sessionService.startSession(user)),
    );
  }

  /** Registriert ein Konto und übernimmt die vom Backend gestartete Sitzung. */
  register(data: RegistrationData): Observable<AuthenticationResult> {
    return this.ensureCsrfCookie().pipe(
      switchMap(() => this.http.post<AuthenticationResult>(`${API_BASE_URL}/auth/register/`, data)),
      tap(({ user }) => this.sessionService.startSession(user)),
    );
  }

  /** Beendet die Sitzung serverseitig und entfernt den lokalen Nutzerzustand. */
  logout(): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/auth/logout/`, {}).pipe(
      tap({
        next: () => this.sessionService.clearSession(),
        error: () => this.sessionService.clearSession(),
      }),
    );
  }

  /** Fordert eine generische Passwort-Reset-E-Mail an, ohne Konten offenzulegen. */
  requestPasswordReset(email: string): Observable<void> {
    return this.ensureCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<void>(`${API_BASE_URL}/auth/password/reset/request/`, { email }),
      ),
    );
  }

  /** Setzt vor der ersten schreibenden Anfrage das lesbare CSRF-Cookie. */
  private ensureCsrfCookie(): Observable<{ csrfToken: string }> {
    return this.http.get<{ csrfToken: string }>(`${API_BASE_URL}/auth/csrf/`);
  }
}
