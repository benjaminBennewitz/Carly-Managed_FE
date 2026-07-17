// src/app/core/security/frontend-input.utils.ts

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const ANGLE_BRACKETS = /[<>]/g;

/**
 * Normalisiert einen einzeiligen Freitext für Suche und kurzlebige UI-Zustände.
 */
export function normalizeSingleLineInput(value: string, maxLength: number): string {
  return value
    .normalize('NFKC')
    .replace(CONTROL_CHARACTERS, '')
    .replace(ANGLE_BRACKETS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Normalisiert mehrzeiligen Freitext ohne HTML-Fragmente zu übernehmen.
 */
export function normalizeMultilineInput(value: string, maxLength: number): string {
  return value
    .normalize('NFKC')
    .replace(CONTROL_CHARACTERS, '')
    .replace(ANGLE_BRACKETS, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/**
 * Erzeugt einen vergleichbaren Suchwert ohne Diakritika.
 */
export function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de')
    .replace(/\s+/g, ' ')
    .trim();
}
