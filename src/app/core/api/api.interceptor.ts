// src/app/core/api/api.interceptor.ts

import { HttpInterceptorFn } from '@angular/common/http';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_COOKIE_NAME = 'cm_csrftoken';

/** Liest einen Cookie-Wert ohne Zugriff auf HttpOnly-Sitzungsdaten. */
function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

/** Sendet Sitzungs-Cookies und CSRF-Header ausschließlich an die eigene API. */
export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  let headers = request.headers;
  if (UNSAFE_METHODS.has(request.method.toUpperCase())) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers = headers.set('X-CSRFToken', csrfToken);
    }
  }

  return next(
    request.clone({
      headers,
      withCredentials: true,
    }),
  );
};
