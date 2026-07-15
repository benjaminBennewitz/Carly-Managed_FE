// src/app/app.config.ts

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ActivatedRouteSnapshot, provideRouter, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';

const AUTH_ROUTE_ORDER = ['login', 'register'];
const APP_ROUTE_ORDER = [
  'dashboard',
  'board',
  'members',
  'inbox',
  'pool',
  'archive',
  'projects',
  'projects/:projectId/board',
  'projects/:projectId/settings',
  'carly',
  'settings',
];

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

/**
 * Setzt eine temporäre Richtungsinformation für einen Seitenübergang.
 */
function setTransitionDirection(
  attributeName: 'authTransitionDirection' | 'appTransitionDirection',
  direction: 'forward' | 'backward',
  transition: { finished: Promise<void> },
): void {
  const rootElement = document.documentElement;
  rootElement.dataset[attributeName] = direction;

  void transition.finished.finally(() => {
    delete rootElement.dataset[attributeName];
  });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ from, to, transition }) => {
          const fromPath = getLeafRoutePath(from);
          const toPath = getLeafRoutePath(to);

          const fromAuthIndex = AUTH_ROUTE_ORDER.indexOf(fromPath);
          const toAuthIndex = AUTH_ROUTE_ORDER.indexOf(toPath);

          if (fromAuthIndex >= 0 && toAuthIndex >= 0 && fromAuthIndex !== toAuthIndex) {
            setTransitionDirection(
              'authTransitionDirection',
              toAuthIndex > fromAuthIndex ? 'forward' : 'backward',
              transition,
            );
            return;
          }

          const fromAppIndex = APP_ROUTE_ORDER.indexOf(fromPath);
          const toAppIndex = APP_ROUTE_ORDER.indexOf(toPath);

          if (fromAppIndex >= 0 && toAppIndex >= 0 && fromAppIndex !== toAppIndex) {
            setTransitionDirection(
              'appTransitionDirection',
              toAppIndex > fromAppIndex ? 'forward' : 'backward',
              transition,
            );
          }
        },
      }),
    ),
  ],
};
