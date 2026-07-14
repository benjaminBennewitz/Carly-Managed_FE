// src/app/core/auth/guards/guest.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionService } from '../services/session.service';

/**
 * Verhindert den erneuten Aufruf öffentlicher Auth-Seiten bei aktiver Sitzung.
 */
export const guestGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  return sessionService.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};
