// src/app/core/theme/theme.service.ts

import { DOCUMENT } from '@angular/common';
import { computed, Inject, Injectable, signal } from '@angular/core';

import { getColorVisionVariables, isColorVisionMode, type ColorVisionMode } from './theme-color-vision';
import { CONTRAST_CONFIGURATIONS, parseCssColor, selectContrastCandidate } from './theme-contrast';
import type { RgbColor } from './theme-contrast';

export type ThemeMode = 'light' | 'dark';
export type ThemeName = 'default' | 'neon' | 'retro' | 'summer' | 'nightsky' | 'ocean' | 'lava';

type AlternativeThemeName = Exclude<ThemeName, 'default'>;

interface ThemeViewTransition {
  finished: Promise<void>;
}

interface OptionalViewTransitionDocument {
  startViewTransition?: (updateCallback: () => void) => ThemeViewTransition;
}

const THEME_MODE_STORAGE_KEY = 'carly-managed-theme-mode';
const THEME_NAME_STORAGE_KEY = 'carly-managed-theme-name';
const THEME_NAMES: readonly ThemeName[] = [
  'default',
  'neon',
  'retro',
  'summer',
  'nightsky',
  'ocean',
  'lava',
];
const THEME_LABELS: Record<ThemeName, string> = {
  default: 'Default',
  neon: 'Neon',
  retro: 'Retro',
  summer: 'Summer',
  nightsky: 'Nightsky',
  ocean: 'Ocean',
  lava: 'Lava',
};

/** Prüft einen unbekannten Wert auf einen unterstützten Theme-Namen. */
function isThemeName(value: unknown): value is ThemeName {
  return THEME_NAMES.includes(value as ThemeName);
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly themeState = signal<ThemeName>('default');
  private readonly modeState = signal<ThemeMode>('light');
  private readonly colorVisionState = signal<ColorVisionMode>('standard');
  private appliedInlineVariables: string[] = [];
  private themeRequestId = 0;

  readonly theme = this.themeState.asReadonly();
  readonly mode = this.modeState.asReadonly();
  readonly label = computed(
    () => `${THEME_LABELS[this.themeState()]} · ${this.modeState() === 'dark' ? 'Dunkel' : 'Hell'}`,
  );
  readonly modeIcon = computed(() => (this.modeState() === 'dark' ? 'dark_mode' : 'light_mode'));
  readonly logoPath = computed(() =>
    this.modeState() === 'dark'
      ? '/assets/img/carly-managed-logo_wide_light.webp'
      : '/assets/img/carly-managed-logo_wide.webp',
  );

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    const storedTheme = this.readStoredTheme();
    const storedMode = this.readStoredMode();
    const documentTheme = this.document.documentElement.dataset['theme'];
    const documentMode = this.document.documentElement.dataset['mode'];
    const documentColorVision = this.document.documentElement.dataset['colorVision'];
    const initialTheme = storedTheme ?? (isThemeName(documentTheme) ? documentTheme : 'default');
    const initialMode = storedMode ?? (documentMode === 'dark' ? 'dark' : 'light');
    const initialColorVision = isColorVisionMode(documentColorVision) ? documentColorVision : 'standard';

    this.themeState.set(initialTheme);
    this.modeState.set(initialMode);
    this.colorVisionState.set(initialColorVision);
    this.document.documentElement.dataset['colorVision'] = initialColorVision;
    this.applyTheme(initialTheme, initialMode);
  }

  /** Wechselt den Darstellungsmodus mit einem horizontalen Übergang. */
  toggleMode(): void {
    const nextMode = this.modeState() === 'dark' ? 'light' : 'dark';
    const transitionDocument = this.document as unknown as OptionalViewTransitionDocument;
    const startViewTransition = transitionDocument.startViewTransition?.bind(this.document);
    const reduceMotion =
      this.document.documentElement.dataset['motion'] === 'reduced' ||
      this.document.documentElement.dataset['neuro'] === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!startViewTransition || reduceMotion) {
      this.setMode(nextMode);
      return;
    }

    const rootElement = this.document.documentElement;
    rootElement.dataset['themeTransitionDirection'] = nextMode;

    const transition = startViewTransition(() => {
      this.setMode(nextMode);
    });

    void transition.finished.finally(() => {
      delete rootElement.dataset['themeTransitionDirection'];
    });
  }

  /** Setzt ein vordefiniertes Farbset unabhängig vom Hell-/Dunkelmodus. */
  setTheme(theme: ThemeName): void {
    this.themeState.set(theme);
    this.applyTheme(theme, this.modeState());
  }

  /** Setzt den Darstellungsmodus und synchronisiert Dokument sowie Browser-Speicher. */
  setMode(mode: ThemeMode): void {
    this.modeState.set(mode);
    this.applyTheme(this.themeState(), mode);
  }

  /** Setzt den Farbsehmodus und berechnet Theme sowie Kontrast gemeinsam neu. */
  setColorVisionMode(mode: ColorVisionMode): void {
    this.colorVisionState.set(mode);
    this.document.documentElement.dataset['colorVision'] = mode;
    this.applyTheme(this.themeState(), this.modeState());
  }

  /** Aktiviert Default-Werte direkt oder lädt alternative Farbvariablen bedarfsgerecht. */
  private applyTheme(theme: ThemeName, mode: ThemeMode): void {
    const requestId = ++this.themeRequestId;
    const root = this.document.documentElement;
    this.persistTheme(theme, mode);

    if (theme === 'default') {
      this.clearAppliedInlineVariables();
      root.dataset['theme'] = theme;
      root.dataset['mode'] = mode;
      root.style.colorScheme = mode;
      this.applyColorVisionVariables(mode);
      this.updateContrastTokens();
      return;
    }

    void import('./theme-palettes').then(({ getThemeVariables }) => {
      if (requestId !== this.themeRequestId) {
        return;
      }

      this.clearAppliedInlineVariables();
      const variables = getThemeVariables(theme as AlternativeThemeName, mode);
      this.applyInlineVariables(variables);
      root.dataset['theme'] = theme;
      root.dataset['mode'] = mode;
      root.style.colorScheme = mode;
      this.applyColorVisionVariables(mode);
      this.updateContrastTokens();
    });
  }

  /**
   * Ermittelt für kritische Flächen eine kontrastreiche Textfarbe aus erlaubten
   * semantischen Design-Tokens.
   */
  private updateContrastTokens(): void {
    const root = this.document.documentElement;
    const host = this.document.body ?? root;
    const probe = this.document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'fixed';
    probe.style.inset = 'auto';
    probe.style.width = '0';
    probe.style.height = '0';
    probe.style.overflow = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.visibility = 'hidden';
    host.append(probe);

    const foregroundCache = new Map<string, RgbColor | null>();
    const resolveForeground = (token: string): RgbColor | null => {
      if (!foregroundCache.has(token)) {
        foregroundCache.set(token, this.resolveTokenColor(probe, token, 'color'));
      }

      return foregroundCache.get(token) ?? null;
    };

    CONTRAST_CONFIGURATIONS.forEach((configuration) => {
      const fallbackToken = configuration.foregroundTokens[0];
      const background = this.resolveTokenColor(probe, configuration.backgroundToken, 'background');
      const candidates = configuration.foregroundTokens.flatMap((token) => {
        const color = resolveForeground(token);
        return color ? [{ token, color }] : [];
      });
      const selectedToken = background
        ? (selectContrastCandidate(background, candidates)?.token ?? fallbackToken)
        : fallbackToken;

      root.style.setProperty(configuration.outputToken, `var(${selectedToken})`);
    });

    probe.remove();
  }

  /** Löst eine CSS-Variable über den Browser in einen RGB-Farbwert auf. */
  private resolveTokenColor(
    probe: HTMLElement,
    token: string,
    property: 'background' | 'color',
  ): RgbColor | null {
    if (property === 'background') {
      probe.style.backgroundColor = `var(${token})`;
      return parseCssColor(getComputedStyle(probe).backgroundColor);
    }

    probe.style.color = `var(${token})`;
    return parseCssColor(getComputedStyle(probe).color);
  }

  /** Wendet den gewählten Farbsehmodus als semantischen Theme-Layer an. */
  private applyColorVisionVariables(mode: ThemeMode): void {
    const colorVisionMode = this.colorVisionState();
    if (colorVisionMode === 'standard') {
      return;
    }

    this.applyInlineVariables(getColorVisionVariables(colorVisionMode, mode));
  }

  /** Setzt semantische Farbvariablen inline und merkt sie für den nächsten Wechsel vor. */
  private applyInlineVariables(variables: Readonly<Record<string, string>>): void {
    const root = this.document.documentElement;
    Object.entries(variables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
      if (!this.appliedInlineVariables.includes(name)) {
        this.appliedInlineVariables.push(name);
      }
    });
  }

  /** Entfernt zuvor gesetzte Inline-Variablen von Theme und Farbsehmodus. */
  private clearAppliedInlineVariables(): void {
    const root = this.document.documentElement;
    this.appliedInlineVariables.forEach((name) => root.style.removeProperty(name));
    this.appliedInlineVariables = [];
  }

  /** Persistiert Theme und Modus im Browser-Speicher. */
  private persistTheme(theme: ThemeName, mode: ThemeMode): void {
    try {
      window.localStorage.setItem(THEME_NAME_STORAGE_KEY, theme);
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    } catch {
      // Theme und Modus bleiben auch ohne verfügbaren Browser-Speicher aktiv.
    }
  }

  /** Liest einen zuvor ausgewählten Theme-Namen aus dem Browser-Speicher. */
  private readStoredTheme(): ThemeName | null {
    try {
      const storedTheme = window.localStorage.getItem(THEME_NAME_STORAGE_KEY);
      return isThemeName(storedTheme) ? storedTheme : null;
    } catch {
      return null;
    }
  }

  /** Liest einen zuvor ausgewählten Darstellungsmodus aus dem Browser-Speicher. */
  private readStoredMode(): ThemeMode | null {
    try {
      const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
      return storedMode === 'dark' || storedMode === 'light' ? storedMode : null;
    } catch {
      return null;
    }
  }
}
