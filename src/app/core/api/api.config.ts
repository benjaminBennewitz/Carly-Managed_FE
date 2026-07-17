// src/app/core/api/api.config.ts

export const API_BASE_URL = '/api/v1';

/** Liefert die Basisadresse für authentifizierte WebSocket-Verbindungen. */
export function getWebSocketBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}
