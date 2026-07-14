// src/app/shared/validation/auth.validators.spec.ts

import { FormControl } from '@angular/forms';

import {
  displayNameCharactersValidator,
  emailCharactersValidator,
  matchesControlValidator,
  noControlCharactersValidator,
  personalDataPasswordValidator,
  uncommonPasswordValidator,
} from './auth.validators';

/**
 * Prüft die fachlichen Validatoren der Authentifizierungsformulare.
 */
describe('Auth-Validatoren', () => {
  it('erkennt nicht unterstützte Zeichen in E-Mail-Adressen', () => {
    const control = new FormControl('name<script>@example.com', { nonNullable: true });

    expect(emailCharactersValidator()(control)).toEqual({ emailCharacters: true });
  });

  it('erlaubt gebräuchliche Sonderzeichen in E-Mail-Adressen', () => {
    const control = new FormControl("name+projekt.o'neil@example.com", { nonNullable: true });

    expect(emailCharactersValidator()(control)).toBeNull();
  });

  it('erkennt nicht unterstützte Zeichen in Anzeigenamen', () => {
    const control = new FormControl('Mira <Sommer>', { nonNullable: true });

    expect(displayNameCharactersValidator()(control)).toEqual({
      displayNameCharacters: true,
    });
  });

  it('erkennt unsichtbare Steuerzeichen', () => {
    const control = new FormControl('Sicheres\nPasswort', { nonNullable: true });

    expect(noControlCharactersValidator()(control)).toEqual({ controlCharacters: true });
  });

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
