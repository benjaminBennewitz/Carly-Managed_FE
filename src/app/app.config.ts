// src/app/app.config.ts

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';

const AUTH_ROUTE_ORDER = ['login', 'register'];

/**
 * Ermittelt den Pfad der tiefsten aktiven Route.
 */
function getLeafRoutePath(snapshot: ActivatedRouteSnapshot): string {
  let currentSnapshot = snapshot;

  while (currentSnapshot.firstChild) {
    currentSnapshot = currentSnapshot.firstChild;
  }

  return currentSnapshot.routeConfig?.path ?? '';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ from, to, transition }) => {
          const fromIndex = AUTH_ROUTE_ORDER.indexOf(getLeafRoutePath(from));
          const toIndex = AUTH_ROUTE_ORDER.indexOf(getLeafRoutePath(to));

          if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
            return;
          }

          const rootElement = document.documentElement;
          rootElement.dataset['authTransitionDirection'] =
            toIndex > fromIndex ? 'forward' : 'backward';

          void transition.finished.finally(() => {
            delete rootElement.dataset['authTransitionDirection'];
          });
        },
      }),
    ),
  ],
};
