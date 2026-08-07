// src/app/core/theme/theme-monochrome.spec.ts

import { describe, expect, it } from 'vitest';

import { calculateContrastRatio, parseCssColor } from './theme-contrast';
import { getMonochromeVariables } from './theme-monochrome';

const MODES = ['light', 'dark'] as const;
const ACTION_PAIRS = [
  ['--color-action-primary', '--color-action-primary-text'],
  ['--color-action-primary-hover', '--color-action-primary-text'],
  ['--color-action-primary-active', '--color-action-primary-text'],
  ['--color-action-secondary', '--color-action-secondary-text'],
  ['--color-action-secondary-hover', '--color-action-secondary-text'],
  ['--color-action-secondary-active', '--color-action-secondary-text'],
] as const;

describe('Schwarzweiß-Palette', () => {
  it.each(MODES)('enthält im Modus %s ausschließlich neutrale Hex-Farben', (mode) => {
    const variables = getMonochromeVariables(mode);
    const hexColors = Object.values(variables).filter((value) => /^#[0-9a-f]{6}$/i.test(value));

    hexColors.forEach((value) => {
      expect(value.slice(1, 3)).toBe(value.slice(3, 5));
      expect(value.slice(3, 5)).toBe(value.slice(5, 7));
    });
  });

  it.each(MODES)('hält für Aktionszustände im Modus %s mindestens 4,5:1 ein', (mode) => {
    const variables = getMonochromeVariables(mode);

    ACTION_PAIRS.forEach(([backgroundToken, foregroundToken]) => {
      const background = parseCssColor(variables[backgroundToken]);
      const foreground = parseCssColor(variables[foregroundToken]);

      expect(background).not.toBeNull();
      expect(foreground).not.toBeNull();
      expect(calculateContrastRatio(background!, foreground!)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
