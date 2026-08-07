// src/app/core/theme/theme-contrast.spec.ts

import { describe, expect, it } from 'vitest';

import { CONTRAST_CONFIGURATIONS, parseCssColor, selectContrastCandidate, type RgbColor } from './theme-contrast';
import { getColorVisionVariables, type ColorVisionMode } from './theme-color-vision';
import { getThemeVariables } from './theme-palettes';
import type { ThemeMode, ThemeName } from './theme.service';

const THEME_NAMES: readonly ThemeName[] = [
  'default',
  'neon',
  'retro',
  'summer',
  'nightsky',
  'ocean',
  'lava',
];
const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'];
const COLOR_VISION_MODES: readonly ColorVisionMode[] = [
  'standard',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'monochrome',
];
const UNIVERSAL_CONTRAST_VARIABLES: Readonly<Record<string, string>> = {
  '--color-text-contrast-dark': '#000000',
  '--color-text-contrast-light': '#ffffff',
};
const DEFAULT_THEME_VARIABLES: Readonly<Record<ThemeMode, Readonly<Record<string, string>>>> = {
  light: {
    '--color-surface-primary': '#ffffff',
    '--color-surface-secondary': '#f0eaf6',
    '--color-surface-hover': '#eee7f7',
    '--color-surface-active': '#e5daef',
    '--color-text-primary': '#241b2e',
    '--color-text-inverse': '#ffffff',
    '--color-action-primary': '#7752b3',
    '--color-action-primary-hover': '#64439d',
    '--color-action-primary-active': '#553584',
    '--color-action-primary-text': '#ffffff',
    '--color-action-secondary': '#eee7f7',
    '--color-action-secondary-hover': '#e3d7ef',
    '--color-action-secondary-active': '#d8c8e7',
    '--color-action-secondary-text': '#4c356c',
    '--color-accent': '#d5a646',
    '--color-accent-text': '#241b2e',
    '--color-accent-subtle': '#f1d99b',
  },
  dark: {
    '--color-surface-primary': '#1d1724',
    '--color-surface-secondary': '#292031',
    '--color-surface-hover': '#31223f',
    '--color-surface-active': '#3c2e49',
    '--color-text-primary': '#f7f2fa',
    '--color-text-inverse': '#141019',
    '--color-action-primary': '#a987de',
    '--color-action-primary-hover': '#b99ae8',
    '--color-action-primary-active': '#c8adf0',
    '--color-action-primary-text': '#141019',
    '--color-action-secondary': '#31223f',
    '--color-action-secondary-hover': '#3b2b48',
    '--color-action-secondary-active': '#473455',
    '--color-action-secondary-text': '#f7f2fa',
    '--color-accent': '#e4be66',
    '--color-accent-text': '#141019',
    '--color-accent-subtle': '#f2d993',
  },
};

/** Mischt zwei Farben entsprechend color-mix(in srgb, ...). */
function mixSrgb(first: RgbColor, firstAmount: number, second: RgbColor): RgbColor {
  const secondAmount = 1 - firstAmount;
  return {
    red: first.red * firstAmount + second.red * secondAmount,
    green: first.green * firstAmount + second.green * secondAmount,
    blue: first.blue * firstAmount + second.blue * secondAmount,
  };
}

/** Löst direkte Farben, var()-Referenzen und einfache color-mix()-Werte rekursiv auf. */
function resolveColorValue(
  variables: Readonly<Record<string, string>>,
  value: string,
  visitedTokens: ReadonlySet<string> = new Set<string>(),
): RgbColor {
  const directColor = parseCssColor(value);
  if (directColor) return directColor;

  const variableMatch = value.trim().match(/^var\((--[\w-]+)\)$/i);
  if (variableMatch) {
    return resolveTokenColor(variables, variableMatch[1], visitedTokens);
  }

  const mixMatch = value.match(
    /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+?)\s*\)$/i,
  );
  if (!mixMatch) {
    throw new Error(`Nicht unterstützter Test-Farbwert: ${value}`);
  }

  const first = resolveColorValue(variables, mixMatch[1], visitedTokens);
  const second = resolveColorValue(variables, mixMatch[3], visitedTokens);
  return mixSrgb(first, Number.parseFloat(mixMatch[2]) / 100, second);
}

/** Liefert alle für die Kontrastprüfung benötigten Variablen eines Themes. */
function getVariables(
  theme: ThemeName,
  mode: ThemeMode,
  colorVisionMode: ColorVisionMode = 'standard',
): Record<string, string> {
  const themeVariables =
    theme === 'default' ? DEFAULT_THEME_VARIABLES[mode] : getThemeVariables(theme, mode);

  return {
    ...themeVariables,
    ...getColorVisionVariables(colorVisionMode, mode),
    ...UNIVERSAL_CONTRAST_VARIABLES,
  };
}

/** Löst eine einzelne semantische Farbvariable der Testpalette auf. */
function resolveTokenColor(
  variables: Readonly<Record<string, string>>,
  token: string,
  visitedTokens: ReadonlySet<string> = new Set<string>(),
): RgbColor {
  if (visitedTokens.has(token)) {
    throw new Error(`Zirkuläre Testvariable: ${token}`);
  }

  const value = variables[token];
  if (!value) {
    throw new Error(`Fehlende Testvariable: ${token}`);
  }

  const nextVisitedTokens = new Set(visitedTokens);
  nextVisitedTokens.add(token);
  return resolveColorValue(variables, value, nextVisitedTokens);
}

describe('Theme-Kontrast', () => {
  it('parst moderne color(srgb)-Ausgaben des Browsers', () => {
    const color = parseCssColor('color(srgb 0.117647 0.34902 0.360784)');

    expect(color).not.toBeNull();
    expect(color?.red).toBeCloseTo(30, 3);
    expect(color?.green).toBeCloseTo(89, 3);
    expect(color?.blue).toBeCloseTo(92, 3);
  });

  it('wählt für Neon Dark auf der subtilen Akzentfläche hellen Text', () => {
    const variables = getVariables('neon', 'dark');
    const configuration = CONTRAST_CONFIGURATIONS.find(
      ({ backgroundToken }) => backgroundToken === '--color-accent-subtle',
    );
    if (!configuration) throw new Error('Konfiguration für Akzentfläche fehlt.');

    const selection = selectContrastCandidate(
      resolveTokenColor(variables, configuration.backgroundToken),
      configuration.foregroundTokens.map((token) => ({
        token,
        color: resolveTokenColor(variables, token),
      })),
    );

    expect(selection?.token).toBe('--color-text-primary');
    expect(selection?.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('nutzt bei zu knappem Theme-Text einen universellen Kontrast-Fallback', () => {
    const variables = getVariables('summer', 'light');
    const configuration = CONTRAST_CONFIGURATIONS.find(
      ({ backgroundToken }) => backgroundToken === '--color-action-primary',
    );
    if (!configuration) throw new Error('Konfiguration für Primäraktionen fehlt.');

    const selection = selectContrastCandidate(
      resolveTokenColor(variables, configuration.backgroundToken),
      configuration.foregroundTokens.map((token) => ({
        token,
        color: resolveTokenColor(variables, token),
      })),
    );

    expect(selection?.token).toBe('--color-text-contrast-dark');
    expect(selection?.ratio).toBeGreaterThanOrEqual(4.5);
  });

  for (const theme of THEME_NAMES) {
    for (const mode of THEME_MODES) {
      for (const colorVisionMode of COLOR_VISION_MODES) {
        it(`hält ${theme} ${mode} mit ${colorVisionMode} bei mindestens 4,5:1`, () => {
          const variables = getVariables(theme, mode, colorVisionMode);

          for (const configuration of CONTRAST_CONFIGURATIONS) {
            const selection = selectContrastCandidate(
              resolveTokenColor(variables, configuration.backgroundToken),
              configuration.foregroundTokens.map((token) => ({
                token,
                color: resolveTokenColor(variables, token),
              })),
            );

            expect(
              selection?.ratio,
              `${configuration.backgroundToken} → ${configuration.outputToken}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        });
      }
    }
  }
});
