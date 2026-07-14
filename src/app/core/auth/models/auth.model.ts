// src/app/core/auth/models/auth.model.ts

import { CurrentUser } from './current-user.model';

/**
 * Enthält die Anmeldedaten für den Authentifizierungsdienst.
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Enthält die notwendigen Daten für die Registrierung.
 */
export interface RegistrationData {
  displayName: string;
  email: string;
  password: string;
  privacyAcknowledged: boolean;
}

/**
 * Einheitliches Ergebnis einer erfolgreichen Authentifizierungsaktion.
 */
export interface AuthenticationResult {
  user: CurrentUser;
}

/**
 * Beschreibt einen feldbezogenen Validierungsfehler des Backends.
 */
export interface FieldValidationError {
  code: string;
  message: string;
}

/**
 * Beschreibt die erwartete Fehlerstruktur der Authentifizierungs-API.
 */
export interface AuthenticationError {
  code: string;
  message: string;
  fields?: Record<string, FieldValidationError[]>;
}
