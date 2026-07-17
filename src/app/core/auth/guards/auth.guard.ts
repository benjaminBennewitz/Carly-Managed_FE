// src/app/core/auth/guards/auth.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { SessionService } from '../services/session.service';

/** Schützt App-Routen über die serverseitig wiederhergestellte Sitzung. */
export const authGuard: CanActivateFn = (_route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  return sessionService.loadCurrentUser().pipe(
    map((user) =>
      user
        ? true
        : router.createUrlTree(['/auth/login'], {
            queryParams: { redirect: state.url },
          }),
    ),
  );
};
