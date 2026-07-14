// src/app/shared/validation/auth.validators.ts

import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const COMMON_PASSWORDS = new Set([
  '123456789012',
  'password1234',
  'qwertzuiop12',
  'letmein123456',
  'carlymanaged',
]);

const EMAIL_ALLOWED_CHARACTERS = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~@-]+$/;
const DISPLAY_NAME_ALLOWED_CHARACTERS = /^[\p{L}\p{M}\p{N} .'-]+$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * Lehnt Zeichen ab, die in den unterstützten E-Mail-Adressen nicht vorkommen dürfen.
 */
export function emailCharactersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = control.value;

    if (!value || EMAIL_ALLOWED_CHARACTERS.test(value)) {
      return null;
    }

    return { emailCharacters: true };
  };
}

/**
 * Beschränkt Anzeigenamen auf sichtbare, für Personennamen geeignete Zeichen.
 */
export function displayNameCharactersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = control.value;

    if (!value || DISPLAY_NAME_ALLOWED_CHARACTERS.test(value)) {
      return null;
    }

    return { displayNameCharacters: true };
  };
}

/**
 * Verhindert unsichtbare Steuerzeichen, ohne sichere Passwortsonderzeichen einzuschränken.
 */
export function noControlCharactersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    if (!control.value || !CONTROL_CHARACTERS.test(control.value)) {
      return null;
    }

    return { controlCharacters: true };
  };
}

/**
 * Verhindert besonders häufig verwendete oder leicht erratbare Passwörter.
 */
export function uncommonPasswordValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const normalizedValue = control.value.trim().toLowerCase();

    if (!normalizedValue || !COMMON_PASSWORDS.has(normalizedValue)) {
      return null;
    }

    return { commonPassword: true };
  };
}

/**
 * Prüft, ob das Passwort wesentliche Teile persönlicher Eingaben enthält.
 */
export function personalDataPasswordValidator(
  displayNameControl: FormControl<string>,
  emailControl: FormControl<string>,
): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const password = control.value.trim().toLowerCase();

    if (!password) {
      return null;
    }

    const personalFragments = [
      ...displayNameControl.value.toLowerCase().split(/\s+/),
      emailControl.value.toLowerCase().split('@')[0] ?? '',
    ].filter((fragment) => fragment.length >= 4);

    return personalFragments.some((fragment) => password.includes(fragment))
      ? { containsPersonalData: true }
      : null;
  };
}

/**
 * Prüft, ob ein Kontrollwert mit einem anderen Feld übereinstimmt.
 */
export function matchesControlValidator(referenceControl: FormControl<string>): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    if (!control.value || control.value === referenceControl.value) {
      return null;
    }

    return { mismatch: true };
  };
}
