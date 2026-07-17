// src/app/core/auth/services/session.service.ts

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';

import { API_BASE_URL } from '../../api/api.config';
import { AuthenticationResult } from '../models/auth.model';
import { CurrentUser } from '../models/current-user.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly userState = signal<CurrentUser | null>(null);
  private readonly loadedState = signal(false);
  private loadingRequest: Observable<CurrentUser | null> | null = null;

  readonly currentUser = this.userState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly isAuthenticated = computed(() => this.userState() !== null);

  /** Lädt die bestehende HttpOnly-Sitzung genau einmal vom Backend. */
  loadCurrentUser(force = false): Observable<CurrentUser | null> {
    if (!force && this.loadedState()) {
      return of(this.userState());
    }
    if (!force && this.loadingRequest) {
      return this.loadingRequest;
    }

    const request = this.http.get<AuthenticationResult>(`${API_BASE_URL}/auth/me/`).pipe(
      map(({ user }) => user),
      tap((user) => this.startSession(user)),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          this.clearSession();
          return of(null);
        }
        throw error;
      }),
      finalize(() => {
        this.loadedState.set(true);
        this.loadingRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.loadingRequest = request;
    return request;
  }

  /** Setzt den aktuellen Nutzer nach erfolgreicher Authentifizierung. */
  startSession(user: CurrentUser): void {
    this.userState.set(user);
    this.loadedState.set(true);
  }

  /** Entfernt den lokalen Spiegel der serverseitigen Sitzung. */
  clearSession(): void {
    this.userState.set(null);
    this.loadedState.set(true);
  }

  constructor(private readonly http: HttpClient) {}
}
