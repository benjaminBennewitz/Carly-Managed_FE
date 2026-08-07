// src/app/core/theme/theme-color-vision.spec.ts

import { describe, expect, it } from 'vitest';

import { calculateContrastRatio, parseCssColor } from './theme-contrast';
import { getColorVisionVariables, isColorVisionMode, type ColorVisionMode } from './theme-color-vision';
import type { ThemeMode } from './theme.service';

const CHROMATIC_MODES: readonly Exclude<ColorVisionMode, 'standard' | 'monochrome'>[] = [
  'protanopia',
  'deuteranopia',
  'tritanopia',
];
const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'];
const PRIMARY_ACTION_STATES = [
  '--color-action-primary',
  '--color-action-primary-hover',
  '--color-action-primary-active',
] as const;

/** Parst einen direkten Hex-Farbwert aus einer Farbsehpalette. */
function parseRequiredColor(value: string | undefined): NonNullable<ReturnType<typeof parseCssColor>> {
  const color = value ? parseCssColor(value) : null;
  if (!color) {
    throw new Error(`Nicht parsbarer Farbwert: ${String(value)}`);
  }

  return color;
}

describe('Farbsehmodi', () => {
  it.each(['standard', 'protanopia', 'deuteranopia', 'tritanopia', 'monochrome'])(
    'erkennt %s als unterstützten Farbsehmodus',
    (mode) => {
      expect(isColorVisionMode(mode)).toBe(true);
    },
  );

  it('liefert für Standard keinen zusätzlichen Theme-Layer', () => {
    expect(getColorVisionVariables('standard', 'light')).toEqual({});
    expect(getColorVisionVariables('standard', 'dark')).toEqual({});
  });

  for (const colorVisionMode of CHROMATIC_MODES) {
    for (const mode of THEME_MODES) {
      it(`liefert für ${colorVisionMode} ${mode} einen vollständigen Interaktions-Layer`, () => {
        const variables = getColorVisionVariables(colorVisionMode, mode);

        expect(variables['--color-surface-hover']).toBeTruthy();
        expect(variables['--color-surface-active']).toBeTruthy();
        expect(variables['--color-action-primary']).toBeTruthy();
        expect(variables['--color-action-primary-hover']).toBeTruthy();
        expect(variables['--color-action-primary-active']).toBeTruthy();
        expect(variables['--color-action-secondary-hover']).toBeTruthy();
        expect(variables['--color-accent']).toBeTruthy();
        expect(variables['--color-accent-subtle']).toBeTruthy();
        expect(variables['--color-success']).toBeTruthy();
        expect(variables['--color-warning']).toBeTruthy();
        expect(variables['--color-danger']).toBeTruthy();
        expect(variables['--color-info']).toBeTruthy();
        expect(variables['--color-field-border-focus']).toBeTruthy();
      });

      it(`hält direkte Primäraktionen für ${colorVisionMode} ${mode} bei mindestens 4,5:1`, () => {
        const variables = getColorVisionVariables(colorVisionMode, mode);
        const foreground = parseRequiredColor(variables['--color-action-primary-text']);

        PRIMARY_ACTION_STATES.forEach((backgroundToken) => {
          const background = parseRequiredColor(variables[backgroundToken]);
          expect(calculateContrastRatio(background, foreground), backgroundToken).toBeGreaterThanOrEqual(
            4.5,
          );
        });
      });
    }
  }

  it('verwendet für Protanopie und Deuteranopie getrennte Paletten', () => {
    const protanopia = getColorVisionVariables('protanopia', 'light');
    const deuteranopia = getColorVisionVariables('deuteranopia', 'light');

    expect(protanopia['--color-action-primary']).not.toBe(
      deuteranopia['--color-action-primary'],
    );
    expect(protanopia['--color-danger']).not.toBe(deuteranopia['--color-danger']);
  });
});
