// src/app/features/auth/pages/verify-email-page/verify-email-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../../core/auth/services/auth.service';

@Component({
  selector: 'cm-verify-email-page',
  imports: [RouterLink],
  templateUrl: './verify-email-page.component.html',
  styleUrl: '../login-page/login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPageComponent {
  protected readonly pending = signal(true);
  protected readonly verified = signal(false);
  protected readonly errorMessage = signal('');

  constructor(
    authService: AuthService,
    route: ActivatedRoute,
  ) {
    const fragmentToken = new URLSearchParams(route.snapshot.fragment ?? '').get('token')?.trim() ?? '';
    const token = fragmentToken || route.snapshot.queryParamMap.get('token')?.trim() || '';
    if (token && typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
    if (!token) {
      this.pending.set(false);
      this.errorMessage.set('Der Bestätigungslink ist unvollständig.');
      return;
    }

    authService
      .confirmEmailVerification(token)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => this.verified.set(true),
        error: () =>
          this.errorMessage.set('Der Bestätigungslink ist ungültig oder abgelaufen. Fordere in den Einstellungen einen neuen Link an.'),
      });
  }
}
