// src/app/core/auth/services/auth-preview.service.ts

import { Injectable } from '@angular/core';
import { map, Observable, timer } from 'rxjs';

import { AuthenticationResult, LoginCredentials, RegistrationData } from '../models/auth.model';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root',
})
export class AuthPreviewService {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Erstellt ausschließlich für die lokale UI-Entwicklung eine flüchtige Sitzung.
   * Der Dienst speichert weder Passwörter noch Tokens und wird durch die echte API ersetzt.
   */
  login(credentials: LoginCredentials): Observable<AuthenticationResult> {
    return timer(450).pipe(
      map(() => {
        const user = {
          id: 'preview-user',
          displayName: this.createDisplayName(credentials.email),
          email: credentials.email,
          emailVerified: true,
          avatarUrl: null,
        };

        this.sessionService.startSession(user);

        return { user };
      }),
    );
  }

  /**
   * Erstellt eine lokale Vorschau-Sitzung für den Registrierungsablauf.
   */
  register(data: RegistrationData): Observable<AuthenticationResult> {
    return timer(550).pipe(
      map(() => {
        const user = {
          id: 'preview-user',
          displayName: data.displayName,
          email: data.email,
          emailVerified: false,
          avatarUrl: null,
        };

        this.sessionService.startSession(user);

        return { user };
      }),
    );
  }

  /**
   * Beendet die flüchtige Vorschau-Sitzung.
   */
  logout(): void {
    this.sessionService.clearSession();
  }

  private createDisplayName(email: string): string {
    const localPart = email.split('@')[0]?.trim();

    if (!localPart) {
      return 'Carly Nutzer';
    }

    return localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
