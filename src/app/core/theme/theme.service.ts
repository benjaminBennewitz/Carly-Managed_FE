// src/app/core/theme/theme.service.ts

import { DOCUMENT } from '@angular/common';
import { computed, Inject, Injectable, signal } from '@angular/core';

type ThemeMode = 'light' | 'dark';
type ThemeName = 'default';

const THEME_MODE_STORAGE_KEY = 'carly-managed-theme-mode';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly themeState = signal<ThemeName>('default');
  private readonly modeState = signal<ThemeMode>('light');

  readonly theme = this.themeState.asReadonly();
  readonly mode = this.modeState.asReadonly();
  readonly label = computed(
    () => `Default · ${this.modeState() === 'dark' ? 'Dunkel' : 'Hell'}`,
  );
  readonly modeIcon = computed(() =>
    this.modeState() === 'dark' ? 'dark_mode' : 'light_mode',
  );

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    const storedMode = this.readStoredMode();
    const documentMode = this.document.documentElement.dataset['mode'];
    const initialMode =
      storedMode ?? (documentMode === 'dark' ? 'dark' : 'light');

    this.setMode(initialMode);
  }

  /**
   * Wechselt zwischen hellem und dunklem Darstellungsmodus.
   */
  toggleMode(): void {
    this.setMode(this.modeState() === 'dark' ? 'light' : 'dark');
  }

  /**
   * Setzt den Darstellungsmodus und synchronisiert Dokument sowie Browser-Speicher.
   */
  setMode(mode: ThemeMode): void {
    this.modeState.set(mode);
    this.document.documentElement.dataset['theme'] = this.themeState();
    this.document.documentElement.dataset['mode'] = mode;

    try {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    } catch {
      // Der Modus bleibt auch ohne verfügbaren Browser-Speicher aktiv.
    }
  }

  /**
   * Liest einen zuvor ausgewählten Darstellungsmodus aus dem Browser-Speicher.
   */
  private readStoredMode(): ThemeMode | null {
    try {
      const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

      return storedMode === 'dark' || storedMode === 'light'
        ? storedMode
        : null;
    } catch {
      return null;
    }
  }
}
