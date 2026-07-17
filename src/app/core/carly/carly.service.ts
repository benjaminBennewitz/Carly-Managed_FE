// src/app/core/carly/carly.service.ts

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';

import { API_BASE_URL } from '../api/api.config';
import { CarlyFoodId, CarlySettings, CarlyState } from './carly.models';

type CarlySettingsPatch = Partial<CarlySettings> & { positionX?: number };

const EMPTY_STATE: CarlyState = {
  settings: {
    enabled: true,
    showGlobally: true,
    messagesEnabled: true,
    taskReactionsEnabled: true,
    autoSleep: true,
    reduceAnimations: false,
  },
  progress: {
    level: 1,
    experience: 0,
    affection: 50,
    energy: 50,
    satiety: 50,
    streak: 0,
    mood: 'neugierig',
    isSleeping: false,
    lastMessage: '',
    positionX: 0.5,
  },
  version: 1,
};

@Injectable({ providedIn: 'root' })
export class CarlyService {
  private readonly stateValue = signal<CarlyState>(structuredClone(EMPTY_STATE));
  private queuedPatch: CarlySettingsPatch = {};
  private patchRunning = false;

  readonly state = this.stateValue.asReadonly();
  readonly settings = computed(() => this.stateValue().settings);
  readonly progress = computed(() => this.stateValue().progress);
  readonly visibleGlobally = computed(
    () => this.settings().enabled && this.settings().showGlobally,
  );
  readonly levelProgress = computed(() =>
    Math.max(0, Math.min(100, this.progress().experience % 100)),
  );

  constructor(private readonly http: HttpClient) {
    this.reload();
  }

  /** Lädt Carlys persistierten Zustand vom Backend. */
  reload(): void {
    this.http.get<CarlyState>(`${API_BASE_URL}/preferences/carly/`).subscribe({
      next: (state) => this.stateValue.set(this.applyPatch(state, this.queuedPatch)),
    });
  }

  /** Aktualisiert ausschließlich nutzersteuerbare Carly-Einstellungen. */
  updateSettings(changes: Partial<CarlySettings>): void {
    this.stateValue.update((state) => this.applyPatch(state, changes));
    this.queuePatch(changes);
  }

  /** Streichelt Carly unter Beachtung serverseitiger Limits. */
  pet(): void {
    this.performAction('pet');
  }

  /** Füttert Carly mit einer serverseitig validierten Auswahl. */
  feed(food: CarlyFoodId): void {
    this.performAction('feed', { food });
  }

  /** Startet eine begrenzte Spielaktion. */
  play(): void {
    this.performAction('play');
  }

  /** Schickt Carly schlafen. */
  sleep(): void {
    this.performAction('sleep');
  }

  /** Weckt Carly. */
  wake(): void {
    this.performAction('wake');
  }

  /** Aktualisiert Carlys Position während des Ziehens ausschließlich lokal. */
  previewPositionX(positionX: number): void {
    const normalized = this.normalizePosition(positionX);
    this.stateValue.update((state) => this.applyPatch(state, { positionX: normalized }));
  }

  /** Speichert Carlys letzte Position einmalig nach dem Ziehen. */
  persistPositionX(positionX = this.progress().positionX): void {
    const normalized = this.normalizePosition(positionX);
    this.stateValue.update((state) => this.applyPatch(state, { positionX: normalized }));
    this.queuePatch({ positionX: normalized });
  }

  /** Setzt Carly serverseitig auf den Standardzustand zurück. */
  reset(): void {
    this.queuedPatch = {};
    this.http.delete<CarlyState>(`${API_BASE_URL}/preferences/carly/`).subscribe({
      next: (state) => this.stateValue.set(state),
    });
  }

  /** Reiht partielle Änderungen ein und verhindert parallele Versionsschreibvorgänge. */
  private queuePatch(changes: CarlySettingsPatch): void {
    this.queuedPatch = { ...this.queuedPatch, ...changes };
    this.flushPatchQueue();
  }

  /** Überträgt immer nur einen Patch und verwendet danach den neuen Versionsstand. */
  private flushPatchQueue(): void {
    if (this.patchRunning || Object.keys(this.queuedPatch).length === 0) return;

    const changes = this.queuedPatch;
    this.queuedPatch = {};
    this.patchRunning = true;
    const version = this.stateValue().version ?? 1;

    this.http
      .patch<CarlyState>(`${API_BASE_URL}/preferences/carly/`, {
        ...changes,
        version,
      })
      .subscribe({
        next: (state) => {
          this.patchRunning = false;
          this.stateValue.set(this.applyPatch(state, this.queuedPatch));
          this.flushPatchQueue();
        },
        error: (error: HttpErrorResponse) => this.handlePatchError(error, changes),
      });
  }

  /** Lädt bei einem Versionskonflikt den aktuellen Stand und versucht den Patch erneut. */
  private handlePatchError(error: HttpErrorResponse, changes: CarlySettingsPatch): void {
    this.patchRunning = false;

    if (error.status !== 409) {
      this.queuedPatch = {};
      this.reload();
      return;
    }

    const pendingChanges = { ...changes, ...this.queuedPatch };
    this.queuedPatch = {};
    this.http.get<CarlyState>(`${API_BASE_URL}/preferences/carly/`).subscribe({
      next: (state) => {
        this.stateValue.set(this.applyPatch(state, pendingChanges));
        this.queuedPatch = pendingChanges;
        this.flushPatchQueue();
      },
      error: () => {
        this.queuedPatch = {};
        this.reload();
      },
    });
  }

  /** Wendet nutzersteuerbare Änderungen auf den lokalen Zustand an. */
  private applyPatch(state: CarlyState, changes: CarlySettingsPatch): CarlyState {
    const { positionX, ...settingsChanges } = changes;
    return {
      ...state,
      settings: { ...state.settings, ...settingsChanges },
      progress:
        positionX === undefined
          ? state.progress
          : { ...state.progress, positionX: this.normalizePosition(positionX) },
    };
  }

  /** Begrenzt eine normalisierte Position zuverlässig auf den sichtbaren Bereich. */
  private normalizePosition(positionX: number): number {
    return Math.max(0, Math.min(1, positionX));
  }

  /** Führt eine benannte Carly-Aktion mit Versionsprüfung aus. */
  private performAction(action: string, payload: { food?: CarlyFoodId } = {}): void {
    const current = this.stateValue();
    this.http
      .post<CarlyState>(`${API_BASE_URL}/preferences/carly/actions/${action}/`, {
        ...payload,
        version: current.version ?? 1,
      })
      .subscribe({ next: (state) => this.stateValue.set(state), error: () => this.reload() });
  }
}
