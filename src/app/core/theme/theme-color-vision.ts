// src/app/core/theme/theme-color-vision.ts

import type { ThemeMode } from './theme.service';
import { getMonochromeVariables } from './theme-monochrome';

export type ColorVisionMode =
  | 'standard'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'monochrome';

type ChromaticColorVisionMode = Exclude<ColorVisionMode, 'standard' | 'monochrome'>;

interface ColorVisionPaletteInput {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryText: string;
  accent: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

type ColorVisionPaletteMap = Record<
  ChromaticColorVisionMode,
  Record<ThemeMode, ColorVisionPaletteInput>
>;

const COLOR_VISION_MODES: readonly ColorVisionMode[] = [
  'standard',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'monochrome',
];

const COLOR_VISION_PALETTES: ColorVisionPaletteMap = {
  protanopia: {
    light: {
      primary: '#2d6f9f',
      primaryHover: '#24597f',
      primaryActive: '#1b4360',
      primaryText: '#ffffff',
      accent: '#c28a24',
      accentText: '#261900',
      success: '#2c7f9a',
      warning: '#b87b18',
      danger: '#765aa5',
      info: '#397aa6',
    },
    dark: {
      primary: '#82b8df',
      primaryHover: '#9bc8e7',
      primaryActive: '#b6d9ef',
      primaryText: '#0c2230',
      accent: '#e4b75c',
      accentText: '#261900',
      success: '#77b9cf',
      warning: '#e0b153',
      danger: '#b69ada',
      info: '#91c1df',
    },
  },
  deuteranopia: {
    light: {
      primary: '#3f63a8',
      primaryHover: '#314f88',
      primaryActive: '#253c69',
      primaryText: '#ffffff',
      accent: '#c97831',
      accentText: '#2b1404',
      success: '#347f9e',
      warning: '#b77920',
      danger: '#8b559f',
      info: '#476fa8',
    },
    dark: {
      primary: '#93afe6',
      primaryHover: '#abc0ec',
      primaryActive: '#c2d1f2',
      primaryText: '#111b31',
      accent: '#e8a160',
      accentText: '#2b1404',
      success: '#80b7cc',
      warning: '#ddb05f',
      danger: '#c697d3',
      info: '#9db9e5',
    },
  },
  tritanopia: {
    light: {
      primary: '#7b4f9f',
      primaryHover: '#633e82',
      primaryActive: '#4c3065',
      primaryText: '#ffffff',
      accent: '#bc5c4d',
      accentText: '#000000',
      success: '#2f806b',
      warning: '#b86b45',
      danger: '#9d4063',
      info: '#6556a7',
    },
    dark: {
      primary: '#b596d2',
      primaryHover: '#c7adde',
      primaryActive: '#d8c4e8',
      primaryText: '#21122c',
      accent: '#e49485',
      accentText: '#2d100b',
      success: '#79bba6',
      warning: '#dfa17b',
      danger: '#d889a6',
      info: '#aaa0db',
    },
  },
};

/** Prüft einen unbekannten Wert auf einen unterstützten Farbsehmodus. */
export function isColorVisionMode(value: unknown): value is ColorVisionMode {
  return COLOR_VISION_MODES.includes(value as ColorVisionMode);
}

/** Erstellt den semantischen Farblayer eines chromatischen Farbsehmodus. */
function createColorVisionVariables(palette: ColorVisionPaletteInput): Record<string, string> {
  const surface = 'var(--color-surface-primary)';
  const mix = (color: string, amount: number, base = surface): string =>
    `color-mix(in srgb, ${color} ${amount}%, ${base})`;

  return {
    '--color-surface-secondary': mix(palette.primary, 8),
    '--color-surface-hover': mix(palette.primary, 12),
    '--color-surface-active': mix(palette.primary, 20),
    '--color-action-primary': palette.primary,
    '--color-action-primary-hover': palette.primaryHover,
    '--color-action-primary-active': palette.primaryActive,
    '--color-action-primary-text': palette.primaryText,
    '--color-action-secondary': mix(palette.primary, 13),
    '--color-action-secondary-hover': mix(palette.primary, 20),
    '--color-action-secondary-active': mix(palette.primary, 28),
    '--color-accent': palette.accent,
    '--color-accent-text': palette.accentText,
    '--color-accent-subtle': mix(palette.accent, 30),
    '--color-brand-soft': mix(palette.primary, 38),
    '--color-brand-subtle': mix(palette.primary, 12),
    '--color-focus': palette.primary,
    '--color-success': palette.success,
    '--color-warning': palette.warning,
    '--color-danger': palette.danger,
    '--color-error': palette.danger,
    '--color-info': palette.info,
    '--color-selection-background': mix(palette.primary, 46),
    '--color-selection-text': 'var(--color-text-primary)',
    '--color-field-border-hover': mix(palette.primary, 52, 'var(--color-border-strong)'),
    '--color-field-border-focus': palette.primary,
    '--color-field-border-invalid': palette.danger,
    '--color-field-border-confirmed': palette.info,
    '--color-field-error': palette.danger,
    '--color-field-confirmed': palette.info,
    '--color-field-focus-ring': mix(palette.primary, 22, 'transparent'),
  };
}

/** Liefert den Farbseh-Layer für Modus und Hell-/Dunkeldarstellung. */
export function getColorVisionVariables(
  colorVisionMode: ColorVisionMode,
  mode: ThemeMode,
): Readonly<Record<string, string>> {
  if (colorVisionMode === 'standard') {
    return {};
  }

  if (colorVisionMode === 'monochrome') {
    return getMonochromeVariables(mode);
  }

  return createColorVisionVariables(COLOR_VISION_PALETTES[colorVisionMode][mode]);
}
