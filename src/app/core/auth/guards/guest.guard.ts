// src/app/core/auth/guards/guest.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { SessionService } from '../services/session.service';

/** Hält angemeldete Nutzer von Login und Registrierung fern. */
export const guestGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  return sessionService
    .loadCurrentUser()
    .pipe(map((user) => (user ? router.createUrlTree(['/dashboard']) : true)));
};
