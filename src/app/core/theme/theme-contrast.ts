// src/app/core/theme/theme-contrast.ts

export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export interface ContrastCandidate {
  token: string;
  color: RgbColor;
}

export interface ContrastSelection extends ContrastCandidate {
  ratio: number;
}

export interface ContrastTokenConfiguration {
  backgroundToken: string;
  outputToken: string;
  foregroundTokens: readonly string[];
}

export const MINIMUM_TEXT_CONTRAST = 4.5;

const UNIVERSAL_CONTRAST_TOKENS = [
  '--color-text-contrast-dark',
  '--color-text-contrast-light',
] as const;

const SURFACE_FOREGROUND_TOKENS = [
  '--color-text-primary',
  '--color-text-inverse',
  '--color-action-primary-text',
  '--color-accent-text',
  ...UNIVERSAL_CONTRAST_TOKENS,
] as const;

const PRIMARY_ACTION_FOREGROUND_TOKENS = [
  '--color-action-primary-text',
  '--color-text-primary',
  '--color-text-inverse',
  '--color-accent-text',
  ...UNIVERSAL_CONTRAST_TOKENS,
] as const;

const SECONDARY_ACTION_FOREGROUND_TOKENS = [
  '--color-action-secondary-text',
  '--color-text-primary',
  '--color-text-inverse',
  '--color-action-primary-text',
  ...UNIVERSAL_CONTRAST_TOKENS,
] as const;

const ACCENT_FOREGROUND_TOKENS = [
  '--color-accent-text',
  '--color-text-primary',
  '--color-text-inverse',
  '--color-action-primary-text',
  ...UNIVERSAL_CONTRAST_TOKENS,
] as const;

export const CONTRAST_CONFIGURATIONS: readonly ContrastTokenConfiguration[] = [
  {
    backgroundToken: '--color-surface-secondary',
    outputToken: '--color-on-surface-secondary',
    foregroundTokens: SURFACE_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-surface-hover',
    outputToken: '--color-on-surface-hover',
    foregroundTokens: SURFACE_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-surface-active',
    outputToken: '--color-on-surface-active',
    foregroundTokens: SURFACE_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-action-primary',
    outputToken: '--color-on-action-primary',
    foregroundTokens: PRIMARY_ACTION_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-action-primary-hover',
    outputToken: '--color-on-action-primary-hover',
    foregroundTokens: PRIMARY_ACTION_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-action-primary-active',
    outputToken: '--color-on-action-primary-active',
    foregroundTokens: PRIMARY_ACTION_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-action-secondary',
    outputToken: '--color-on-action-secondary',
    foregroundTokens: SECONDARY_ACTION_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-action-secondary-hover',
    outputToken: '--color-on-action-secondary-hover',
    foregroundTokens: SECONDARY_ACTION_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-action-secondary-active',
    outputToken: '--color-on-action-secondary-active',
    foregroundTokens: SECONDARY_ACTION_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-accent',
    outputToken: '--color-on-accent',
    foregroundTokens: ACCENT_FOREGROUND_TOKENS,
  },
  {
    backgroundToken: '--color-accent-subtle',
    outputToken: '--color-on-accent-subtle',
    foregroundTokens: ACCENT_FOREGROUND_TOKENS,
  },
];

/** Begrenzt einen Farbkanal auf den gültigen RGB-Bereich. */
function clampChannel(channel: number): number {
  return Math.min(255, Math.max(0, channel));
}

/** Wandelt einen klassischen RGB-Kanal oder Prozentwert in 0 bis 255 um. */
function parseRgbChannel(value: string): number {
  if (value.endsWith('%')) {
    return clampChannel((Number.parseFloat(value) / 100) * 255);
  }

  return clampChannel(Number.parseFloat(value));
}

/** Wandelt einen sRGB-Kanal oder Prozentwert in 0 bis 255 um. */
function parseSrgbChannel(value: string): number {
  if (value.endsWith('%')) {
    return clampChannel((Number.parseFloat(value) / 100) * 255);
  }

  return clampChannel(Number.parseFloat(value) * 255);
}

/** Parst Hex-, rgb-/rgba- und moderne color(srgb)-Farbangaben. */
export function parseCssColor(value: string): RgbColor | null {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'black') {
    return { red: 0, green: 0, blue: 0 };
  }

  if (normalizedValue === 'white') {
    return { red: 255, green: 255, blue: 255 };
  }

  const shortHexMatch = normalizedValue.match(/^#([\da-f])([\da-f])([\da-f])(?:[\da-f])?$/i);
  if (shortHexMatch) {
    return {
      red: Number.parseInt(`${shortHexMatch[1]}${shortHexMatch[1]}`, 16),
      green: Number.parseInt(`${shortHexMatch[2]}${shortHexMatch[2]}`, 16),
      blue: Number.parseInt(`${shortHexMatch[3]}${shortHexMatch[3]}`, 16),
    };
  }

  const longHexMatch = normalizedValue.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})(?:[\da-f]{2})?$/i);
  if (longHexMatch) {
    return {
      red: Number.parseInt(longHexMatch[1], 16),
      green: Number.parseInt(longHexMatch[2], 16),
      blue: Number.parseInt(longHexMatch[3], 16),
    };
  }

  const rgbMatch = normalizedValue.match(
    /^rgba?\(\s*([+-]?[\d.]+%?)(?:\s*,\s*|\s+)([+-]?[\d.]+%?)(?:\s*,\s*|\s+)([+-]?[\d.]+%?)(?:\s*(?:,|\/)\s*[\d.]+%?)?\s*\)$/i,
  );
  if (rgbMatch) {
    return {
      red: parseRgbChannel(rgbMatch[1]),
      green: parseRgbChannel(rgbMatch[2]),
      blue: parseRgbChannel(rgbMatch[3]),
    };
  }

  const srgbMatch = normalizedValue.match(
    /^color\(\s*srgb\s+([+-]?[\d.]+%?)\s+([+-]?[\d.]+%?)\s+([+-]?[\d.]+%?)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i,
  );
  if (srgbMatch) {
    return {
      red: parseSrgbChannel(srgbMatch[1]),
      green: parseSrgbChannel(srgbMatch[2]),
      blue: parseSrgbChannel(srgbMatch[3]),
    };
  }

  return null;
}

/** Berechnet das WCAG-Kontrastverhältnis zweier RGB-Farben. */
export function calculateContrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = calculateRelativeLuminance(first);
  const secondLuminance = calculateRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Wählt den ersten gültigen oder andernfalls den stärksten Kontrastkandidaten. */
export function selectContrastCandidate(
  background: RgbColor,
  candidates: readonly ContrastCandidate[],
  minimumContrast = MINIMUM_TEXT_CONTRAST,
): ContrastSelection | null {
  let strongestSelection: ContrastSelection | null = null;

  for (const candidate of candidates) {
    const ratio = calculateContrastRatio(background, candidate.color);
    const selection = { ...candidate, ratio };

    if (!strongestSelection || ratio > strongestSelection.ratio) {
      strongestSelection = selection;
    }

    if (ratio >= minimumContrast) {
      return selection;
    }
  }

  return strongestSelection;
}

/** Berechnet die relative Leuchtdichte nach WCAG 2.x. */
function calculateRelativeLuminance(color: RgbColor): number {
  const convert = (channel: number): number => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * convert(color.red) +
    0.7152 * convert(color.green) +
    0.0722 * convert(color.blue)
  );
}
