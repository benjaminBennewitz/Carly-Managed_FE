// src/app/core/carly/carly.service.ts

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, effect, Injectable, signal, untracked } from '@angular/core';

import { API_BASE_URL } from '../api/api.config';
import { CarlyFoodId, CarlyReaction, CarlySettings, CarlyState, CarlyVisualTransition } from './carly.models';

type CarlySettingsPatch = Partial<CarlySettings> & { positionX?: number };
const MIN_VISUAL_TRANSITION_MS = 1_100;

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
  private readonly visualTransitionValue = signal<CarlyVisualTransition>('none');
  private readonly reactionValue = signal<CarlyReaction>('none');
  private readonly speakingValue = signal(false);
  private readonly speechSequenceValue = signal(0);
  private readonly activeMessageValue = signal('');
  private readonly messageSequenceValue = signal(0);
  private readonly messageDurationMsValue = signal(0);

  private queuedPatch: CarlySettingsPatch = {};
  private patchRunning = false;
  private transitionStartedAt = 0;
  private transitionTimer: number | null = null;
  private reactionTimer: number | null = null;
  private speechTimer: number | null = null;
  private messageTimer: number | null = null;
  private lastObservedMessage = '';

  readonly state = this.stateValue.asReadonly();
  readonly settings = computed(() => this.stateValue().settings);
  readonly progress = computed(() => this.stateValue().progress);
  readonly visibleGlobally = computed(
    () => this.settings().enabled && this.settings().showGlobally,
  );
  readonly levelProgress = computed(() =>
    Math.max(0, Math.min(100, this.progress().experience % 100)),
  );
  readonly isSleeping = computed(() => this.progress().isSleeping);
  readonly visualTransition = this.visualTransitionValue.asReadonly();
  readonly reaction = this.reactionValue.asReadonly();
  readonly speaking = this.speakingValue.asReadonly();
  readonly speechSequence = this.speechSequenceValue.asReadonly();
  readonly activeMessage = this.activeMessageValue.asReadonly();
  readonly messageSequence = this.messageSequenceValue.asReadonly();
  readonly messageDurationMs = this.messageDurationMsValue.asReadonly();
  readonly displayMessage = computed(
    () => this.activeMessageValue() || this.progress().lastMessage,
  );

  constructor(
    private readonly http: HttpClient,
    destroyRef: DestroyRef,
  ) {
    effect(() => {
      const message = this.progress().lastMessage.trim();
      if (!message || message === this.lastObservedMessage) return;

      const hasPreviousMessage = this.lastObservedMessage.length > 0;
      this.lastObservedMessage = message;
      if (!hasPreviousMessage) return;

      untracked(() => {
        if (!this.settings().messagesEnabled) return;

        if (this.visualTransitionValue() === 'none' && !this.progress().isSleeping) {
          this.speak(message);
        } else {
          this.showNotice(message);
        }
      });
    });

    this.reload();

    destroyRef.onDestroy(() => {
      this.clearTimer('transition');
      this.clearTimer('reaction');
      this.clearTimer('speech');
      this.clearTimer('message');
    });
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

  /**
   * Streichelt Carly unter Beachtung ihres Schlafzustands und serverseitiger Limits.
   *
   * @returns true, wenn die Aktion ausgeführt wurde.
   */
  pet(): boolean {
    if (this.progress().isSleeping || this.visualTransitionValue() === 'sleeping') {
      this.showNotice('Streicheln hat keinen Effekt', 2_400);
      return false;
    }

    this.startReaction('petted', 1_800);
    this.performAction('pet');
    return true;
  }

  /** Füttert Carly mit einer serverseitig validierten Auswahl. */
  feed(food: CarlyFoodId): void {
    if (this.progress().isSleeping) return;
    this.performAction('feed', { food });
  }

  /** Startet eine begrenzte Spielaktion. */
  play(): void {
    if (this.progress().isSleeping) return;
    this.performAction('play');
  }

  /** Schickt Carly mit einer kurzen Einschlafsequenz schlafen. */
  sleep(): void {
    if (this.progress().isSleeping || this.visualTransitionValue() === 'sleeping') return;

    this.beginVisualTransition('sleeping');
    this.performAction(
      'sleep',
      {},
      () => this.finishVisualTransitionAfterMinimum('sleeping'),
      () => this.cancelVisualTransition(),
    );
  }

  /** Weckt Carly mit einer langsamen Aufwachsequenz. */
  wake(): void {
    if (!this.progress().isSleeping || this.visualTransitionValue() === 'waking') return;

    this.beginVisualTransition('waking');
    this.performAction(
      'wake',
      {},
      () => this.finishVisualTransitionAfterMinimum('waking'),
      () => this.cancelVisualTransition(),
    );
  }

  /**
   * Löst Carlys Schwindelreaktion aus, wenn die Drag-Richtung mehrfach schnell wechselt.
   */
  triggerDizzy(): void {
    if (this.progress().isSleeping || this.visualTransitionValue() !== 'none') return;
    this.startReaction('dizzy', 3_000);
  }

  /**
   * Lässt Carly einen Text sprechen. Die Dauer wächst mit der Textlänge und bleibt begrenzt.
   */
  speak(message: string): void {
    const text = message.trim();
    if (!text || !this.settings().messagesEnabled || this.progress().isSleeping) return;

    const duration = this.calculateSpeechDuration(text);
    this.clearTimer('speech');
    this.speakingValue.set(true);
    this.speechSequenceValue.update((sequence) => sequence + 1);
    this.showNotice(text, duration);

    this.speechTimer = window.setTimeout(() => {
      this.speakingValue.set(false);
      this.speechTimer = null;
    }, duration);
  }

  /** Zeigt einen vorübergehenden Hinweis unabhängig von einer Sprachanimation. */
  showNotice(message: string, durationMs = 2_300): void {
    const text = message.trim();
    if (!text) return;

    this.clearTimer('message');
    this.activeMessageValue.set(text);
    this.messageDurationMsValue.set(durationMs);
    this.messageSequenceValue.update((sequence) => sequence + 1);
    const sequence = this.messageSequenceValue();

    this.messageTimer = window.setTimeout(() => {
      if (this.messageSequenceValue() === sequence) {
        this.activeMessageValue.set('');
      }
      this.messageTimer = null;
    }, durationMs);
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
    this.cancelVisualTransition();
    this.clearReaction();
    this.clearSpeech();
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

  /** Startet eine gemeinsam gespiegelte Schlaf- oder Aufwachsequenz. */
  private beginVisualTransition(transition: CarlyVisualTransition): void {
    this.clearTimer('transition');
    this.clearReaction();
    this.clearSpeech();
    this.transitionStartedAt = Date.now();
    this.visualTransitionValue.set(transition);
  }

  /** Hält einen visuellen Übergang mindestens so lange sichtbar wie seine Animation. */
  private finishVisualTransitionAfterMinimum(transition: CarlyVisualTransition): void {
    const elapsed = Date.now() - this.transitionStartedAt;
    const delay = Math.max(0, MIN_VISUAL_TRANSITION_MS - elapsed);

    this.clearTimer('transition');
    this.transitionTimer = window.setTimeout(() => {
      if (this.visualTransitionValue() === transition) {
        this.visualTransitionValue.set('none');
      }
      this.transitionTimer = null;
    }, delay);
  }

  /** Bricht einen fehlgeschlagenen visuellen Übergang ab. */
  private cancelVisualTransition(): void {
    this.clearTimer('transition');
    this.visualTransitionValue.set('none');
  }

  /** Aktiviert eine vorübergehende Reaktion wie Streicheln oder Schwindel. */
  private startReaction(reaction: CarlyReaction, durationMs: number): void {
    this.clearTimer('reaction');
    this.reactionValue.set(reaction);
    this.reactionTimer = window.setTimeout(() => {
      this.reactionValue.set('none');
      this.reactionTimer = null;
    }, durationMs);
  }

  /** Beendet eine laufende Reaktion. */
  private clearReaction(): void {
    this.clearTimer('reaction');
    this.reactionValue.set('none');
  }

  /** Beendet eine laufende Sprachanimation. */
  private clearSpeech(): void {
    this.clearTimer('speech');
    this.speakingValue.set(false);
  }

  /** Bestimmt eine lesbare, aber begrenzte Sprechdauer aus der Textlänge. */
  private calculateSpeechDuration(message: string): number {
    return Math.max(1_350, Math.min(7_000, 700 + message.length * 43));
  }

  /** Löscht einen der internen UI-Timer zentral und setzt dessen Referenz zurück. */
  private clearTimer(type: 'transition' | 'reaction' | 'speech' | 'message'): void {
    const timer =
      type === 'transition'
        ? this.transitionTimer
        : type === 'reaction'
          ? this.reactionTimer
          : type === 'speech'
            ? this.speechTimer
            : this.messageTimer;

    if (timer !== null) {
      window.clearTimeout(timer);
    }

    if (type === 'transition') this.transitionTimer = null;
    if (type === 'reaction') this.reactionTimer = null;
    if (type === 'speech') this.speechTimer = null;
    if (type === 'message') this.messageTimer = null;
  }

  /** Führt eine benannte Carly-Aktion mit Versionsprüfung aus. */
  private performAction(
    action: string,
    payload: { food?: CarlyFoodId } = {},
    onSuccess?: () => void,
    onError?: () => void,
  ): void {
    const current = this.stateValue();
    this.http
      .post<CarlyState>(`${API_BASE_URL}/preferences/carly/actions/${action}/`, {
        ...payload,
        version: current.version ?? 1,
      })
      .subscribe({
        next: (state) => {
          const previousMessage = this.stateValue().progress.lastMessage.trim();
          this.stateValue.set(state);

          const nextMessage = state.progress.lastMessage.trim();
          if (
            nextMessage &&
            nextMessage === previousMessage &&
            this.settings().messagesEnabled
          ) {
            if (this.visualTransitionValue() === 'none' && !state.progress.isSleeping) {
              this.speak(nextMessage);
            } else {
              this.showNotice(nextMessage);
            }
          }

          onSuccess?.();
        },
        error: () => {
          onError?.();
          this.reload();
        },
      });
  }
}
