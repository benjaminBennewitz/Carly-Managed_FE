// src/app/core/workspace/workspace-display-preferences.service.ts

import { computed, Injectable, signal } from '@angular/core';

export type CompletedTaskFadeLevel = 15 | 35 | 55;

export interface WorkspaceDisplayPreferences {
  fadeCompletedTasks: boolean;
  completedTaskFadeLevel: CompletedTaskFadeLevel;
}

const WORKSPACE_DISPLAY_PREFERENCES_STORAGE_KEY = 'carly-managed-workspace-display-preferences-v1';
const DEFAULT_PREFERENCES: WorkspaceDisplayPreferences = {
  fadeCompletedTasks: true,
  completedTaskFadeLevel: 15,
};
const ALLOWED_FADE_LEVELS: readonly CompletedTaskFadeLevel[] = [15, 35, 55];

@Injectable({
  providedIn: 'root',
})
export class WorkspaceDisplayPreferencesService {
  private readonly preferencesState = signal<WorkspaceDisplayPreferences>(this.readPreferences());

  readonly preferences = this.preferencesState.asReadonly();
  readonly fadeCompletedTasks = computed(() => this.preferencesState().fadeCompletedTasks);
  readonly completedTaskFadeLevel = computed(() => this.preferencesState().completedTaskFadeLevel);
  readonly completedTaskOpacity = computed(() => {
    const preferences = this.preferencesState();
    const opacity = preferences.fadeCompletedTasks
      ? 1 - preferences.completedTaskFadeLevel / 100
      : 1;

    return opacity.toFixed(2);
  });

  /** Aktiviert oder deaktiviert das Abblenden abgeschlossener Aufgaben. */
  setFadeCompletedTasks(enabled: boolean): void {
    this.updatePreferences({ fadeCompletedTasks: enabled });
  }

  /** Setzt die vorbereitete Abblendstärke für abgeschlossene Aufgaben. */
  setCompletedTaskFadeLevel(level: CompletedTaskFadeLevel): void {
    this.updatePreferences({ completedTaskFadeLevel: level });
  }

  /** Aktualisiert die Anzeigeeinstellungen und persistiert sie lokal. */
  private updatePreferences(changes: Partial<WorkspaceDisplayPreferences>): void {
    const nextPreferences = {
      ...this.preferencesState(),
      ...changes,
    };
    this.preferencesState.set(nextPreferences);

    try {
      window.localStorage.setItem(
        WORKSPACE_DISPLAY_PREFERENCES_STORAGE_KEY,
        JSON.stringify(nextPreferences),
      );
    } catch {
      // Die Anzeige bleibt auch ohne verfügbaren Browser-Speicher aktiv.
    }
  }

  /** Liest und validiert gespeicherte Anzeigeeinstellungen. */
  private readPreferences(): WorkspaceDisplayPreferences {
    try {
      const storedValue = window.localStorage.getItem(WORKSPACE_DISPLAY_PREFERENCES_STORAGE_KEY);
      if (!storedValue) {
        return DEFAULT_PREFERENCES;
      }

      const parsedValue = JSON.parse(storedValue) as Partial<WorkspaceDisplayPreferences>;
      const completedTaskFadeLevel = ALLOWED_FADE_LEVELS.includes(
        parsedValue.completedTaskFadeLevel as CompletedTaskFadeLevel,
      )
        ? (parsedValue.completedTaskFadeLevel as CompletedTaskFadeLevel)
        : DEFAULT_PREFERENCES.completedTaskFadeLevel;

      return {
        fadeCompletedTasks:
          typeof parsedValue.fadeCompletedTasks === 'boolean'
            ? parsedValue.fadeCompletedTasks
            : DEFAULT_PREFERENCES.fadeCompletedTasks,
        completedTaskFadeLevel,
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }
}
