// src/app/shared/validation/auth.validators.spec.ts

import { FormControl } from '@angular/forms';

import {
  matchesControlValidator,
  personalDataPasswordValidator,
  uncommonPasswordValidator,
} from './auth.validators';

/**
 * Prüft die fachlichen Validatoren der Authentifizierungsformulare.
 */
describe('Auth-Validatoren', () => {
  it('erkennt ein häufig verwendetes Passwort', () => {
    const control = new FormControl('password1234', { nonNullable: true });

    expect(uncommonPasswordValidator()(control)).toEqual({ commonPassword: true });
  });

  it('erkennt persönliche Daten im Passwort', () => {
    const displayName = new FormControl('Mira Sommer', { nonNullable: true });
    const email = new FormControl('mira@example.com', { nonNullable: true });
    const password = new FormControl('mira-ist-toll-2026', { nonNullable: true });

    expect(personalDataPasswordValidator(displayName, email)(password)).toEqual({
      containsPersonalData: true,
    });
  });

  it('erkennt abweichende Passwortfelder', () => {
    const password = new FormControl('Ein langes Passwort', { nonNullable: true });
    const confirmation = new FormControl('Ein anderes Passwort', { nonNullable: true });

    expect(matchesControlValidator(password)(confirmation)).toEqual({ mismatch: true });
  });
});
