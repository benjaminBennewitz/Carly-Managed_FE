// src/app/shared/validation/auth.validators.ts

import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const COMMON_PASSWORDS = new Set([
  '123456789012',
  'password1234',
  'qwertzuiop12',
  'letmein123456',
  'carlymanaged',
]);

const DISPLAY_NAME_PATTERN = /^[\p{L}\p{M}\p{N} .,'’\-]+$/u;
const INVALID_EMAIL_CHARACTERS = /[\u0000-\u0020\u007f<>{}\\]/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

/**
 * Beschränkt Anzeigenamen auf sichtbare, für Namen geeignete Zeichen.
 */
export function displayNameCharactersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = control.value;

    if (!value || DISPLAY_NAME_PATTERN.test(value)) {
      return null;
    }

    return { invalidDisplayNameCharacters: true };
  };
}

/**
 * Erkennt unsichtbare und für die E-Mail-Eingabe ungeeignete Zeichen.
 */
export function emailCharactersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = control.value;

    if (!value || !INVALID_EMAIL_CHARACTERS.test(value)) {
      return null;
    }

    return { invalidEmailCharacters: true };
  };
}

/**
 * Verhindert unsichtbare Steuerzeichen in Passwortfeldern.
 */
export function noControlCharactersValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = control.value;

    if (!value || !CONTROL_CHARACTERS.test(value)) {
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
