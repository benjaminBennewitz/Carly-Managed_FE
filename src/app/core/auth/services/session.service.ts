// src/app/core/auth/services/session.service.ts

import { computed, Injectable, signal } from '@angular/core';

import { CurrentUser } from '../models/current-user.model';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private readonly userState = signal<CurrentUser | null>(null);

  readonly currentUser = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => this.userState() !== null);

  /**
   * Setzt den aktuellen Nutzer nach einer erfolgreichen Authentifizierung.
   */
  startSession(user: CurrentUser): void {
    this.userState.set(user);
  }

  /**
   * Entfernt alle ausschließlich im Arbeitsspeicher gehaltenen Sitzungsdaten.
   */
  clearSession(): void {
    this.userState.set(null);
  }
}
