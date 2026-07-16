// src/app/shared/ui/workspace-tools/workspace-tools.component.ts

import { ChangeDetectionStrategy, Component, computed, DestroyRef, signal } from '@angular/core';

import { AppSettingsService } from '../../../core/settings/app-settings.service';

const POMODORO_DURATION_SECONDS = 25 * 60;

@Component({
  selector: 'cm-workspace-tools',
  templateUrl: './workspace-tools.component.html',
  styleUrl: './workspace-tools.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceToolsComponent {
  protected readonly settingsService: AppSettingsService;
  protected readonly open = signal(false);
  protected readonly pomodoroSeconds = signal(POMODORO_DURATION_SECONDS);
  protected readonly pomodoroRunning = signal(false);
  protected readonly taskTimerSeconds = signal(0);
  protected readonly taskTimerRunning = signal(false);
  protected readonly pomodoroLabel = computed(() => this.formatTime(this.pomodoroSeconds()));
  protected readonly taskTimerLabel = computed(() => this.formatTime(this.taskTimerSeconds()));

  constructor(settingsService: AppSettingsService, destroyRef: DestroyRef) {
    this.settingsService = settingsService;

    const timerId = window.setInterval(() => {
      if (this.pomodoroRunning()) {
        this.pomodoroSeconds.update((seconds) => {
          if (seconds <= 1) {
            this.pomodoroRunning.set(false);
            return 0;
          }

          return seconds - 1;
        });
      }

      if (this.taskTimerRunning()) {
        this.taskTimerSeconds.update((seconds) => seconds + 1);
      }
    }, 1_000);

    destroyRef.onDestroy(() => {
      window.clearInterval(timerId);
    });
  }

  /** Öffnet oder schließt die kompakte Werkzeugleiste. */
  protected toggleOpen(): void {
    this.open.update((open) => !open);
  }

  /** Startet oder pausiert den Pomodoro-Timer. */
  protected togglePomodoro(): void {
    if (this.pomodoroSeconds() === 0) {
      this.pomodoroSeconds.set(POMODORO_DURATION_SECONDS);
    }

    this.pomodoroRunning.update((running) => !running);
  }

  /** Setzt den Pomodoro-Timer auf 25 Minuten zurück. */
  protected resetPomodoro(): void {
    this.pomodoroRunning.set(false);
    this.pomodoroSeconds.set(POMODORO_DURATION_SECONDS);
  }

  /** Startet oder pausiert den Task-Timer. */
  protected toggleTaskTimer(): void {
    this.taskTimerRunning.update((running) => !running);
  }

  /** Setzt den Task-Timer zurück. */
  protected resetTaskTimer(): void {
    this.taskTimerRunning.set(false);
    this.taskTimerSeconds.set(0);
  }

  /** Formatiert Sekunden als kompakte Zeitangabe. */
  private formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    }

    return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }
}
