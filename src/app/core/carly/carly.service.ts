// src/app/core/carly/carly.service.ts

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, effect, Injectable, signal, untracked } from '@angular/core';

import { API_BASE_URL } from '../api/api.config';
import { WorkspaceInboxService } from '../inbox/workspace-inbox.service';
import { WorkspaceActivityEvent, WorkspaceService } from '../workspace/workspace.service';
import { CarlyRewardFeedbackService } from './carly-reward-feedback.service';
import { CarlyFoodId, CarlyMessageDurationSeconds, CarlyReaction, CarlyReward, CarlyRewardHistoryItem, CarlyRewardRules, CarlySettings, CarlySpecialEffect, CarlyState, CarlyVisualTransition } from './carly.models';

type CarlySettingsPatch = Partial<CarlySettings> & { positionX?: number };
const MIN_VISUAL_TRANSITION_MS = 1_100;
const CARLY_MESSAGE_DURATION_STORAGE_KEY = 'carly-managed:carly-message-duration';
const DEFAULT_MESSAGE_DURATION_SECONDS: CarlyMessageDurationSeconds = 7;

const EMPTY_STATE: CarlyState = {
  settings: {
    enabled: true,
    showGlobally: true,
    messagesEnabled: true,
    taskReactionsEnabled: true,
    autoSleep: true,
    reduceAnimations: false,
    rewardPopupsEnabled: true,
    showXpRewards: true,
    showCreditRewards: true,
  },
  progress: {
    level: 1,
    experience: 0,
    levelExperience: 0,
    nextLevelExperience: 100,
    credits: 40,
    inventory: { fish: 1, berry: 0, cookie: 0, potion: 0 },
    affection: 50,
    energy: 80,
    satiety: 70,
    streak: 0,
    mood: 'neugierig',
    isSleeping: false,
    lastMessage: '',
    positionX: 0.85,
    auraUntil: null,
    moonUntil: null,
    dailyRewards: {
      xpEarned: 0,
      xpSoftCap: 200,
      xpHardCap: 300,
      creditsEarned: 0,
      creditsSoftCap: 500,
      creditsHardCap: 650,
    },
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
  private readonly messageDisplaySecondsValue = signal<CarlyMessageDurationSeconds>(
    this.readStoredMessageDuration(),
  );
  private readonly rewardRulesValue = signal<CarlyRewardRules | null>(null);
  private readonly rewardHistoryValue = signal<CarlyRewardHistoryItem[]>([]);
  private readonly specialEffectValue = signal<CarlySpecialEffect>(null);
  private readonly clockValue = signal(Date.now());

  private queuedPatch: CarlySettingsPatch = {};
  private patchRunning = false;
  private transitionStartedAt = 0;
  private transitionTimer: number | null = null;
  private reactionTimer: number | null = null;
  private speechTimer: number | null = null;
  private messageTimer: number | null = null;
  private activityReactionTimer: number | null = null;
  private rewardSyncTimer: number | null = null;
  private effectTimer: number | null = null;
  private clockTimer: number | null = null;
  private stateRefreshTimer: number | null = null;
  private readonly seenRewardIds = new Set<string>();
  private lastObservedMessage = '';
  private lastWorkspaceActivitySequence = 0;
  private lastInboxOutgoingSequence = 0;
  private lastUnreadCount: number | null = null;

  readonly state = this.stateValue.asReadonly();
  readonly settings = computed(() => this.stateValue().settings);
  readonly progress = computed(() => this.stateValue().progress);
  readonly visibleGlobally = computed(
    () => this.settings().enabled && this.settings().showGlobally,
  );
  readonly levelProgress = computed(() => {
    const progress = this.progress();
    return Math.max(0, Math.min(100, (progress.levelExperience / Math.max(1, progress.nextLevelExperience)) * 100));
  });
  readonly isSleeping = computed(() => this.progress().isSleeping);
  readonly visualTransition = this.visualTransitionValue.asReadonly();
  readonly reaction = this.reactionValue.asReadonly();
  readonly speaking = this.speakingValue.asReadonly();
  readonly speechSequence = this.speechSequenceValue.asReadonly();
  readonly activeMessage = this.activeMessageValue.asReadonly();
  readonly messageSequence = this.messageSequenceValue.asReadonly();
  readonly messageDurationMs = this.messageDurationMsValue.asReadonly();
  readonly messageDisplaySeconds = this.messageDisplaySecondsValue.asReadonly();
  readonly displayMessage = computed(
    () => this.activeMessageValue() || this.progress().lastMessage,
  );
  readonly rewardRules = this.rewardRulesValue.asReadonly();
  readonly rewardHistory = this.rewardHistoryValue.asReadonly();
  readonly specialEffect = this.specialEffectValue.asReadonly();
  readonly auraActive = computed(() => {
    const until = this.progress().auraUntil;
    return Boolean(until && new Date(until).getTime() > this.clockValue());
  });
  readonly moonActive = computed(() => {
    const until = this.progress().moonUntil;
    return Boolean(until && new Date(until).getTime() > this.clockValue());
  });

  constructor(
    private readonly http: HttpClient,
    private readonly workspaceService: WorkspaceService,
    private readonly inboxService: WorkspaceInboxService,
    private readonly rewardFeedback: CarlyRewardFeedbackService,
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

    effect(() => {
      const activity = this.workspaceService.lastActivity();
      if (!activity || activity.sequence === this.lastWorkspaceActivitySequence) return;

      this.lastWorkspaceActivitySequence = activity.sequence;
      untracked(() => this.handleWorkspaceActivity(activity));
    });

    effect(() => {
      const sequence = this.inboxService.outgoingActivitySequence();
      if (sequence === this.lastInboxOutgoingSequence) return;

      this.lastInboxOutgoingSequence = sequence;
      untracked(() => this.scheduleRewardSync());
    });

    effect(() => {
      const unreadCount = this.inboxService.totalUnreadCount();

      untracked(() => {
        if (this.lastUnreadCount === null) {
          this.lastUnreadCount = unreadCount;
          return;
        }

        const increased = unreadCount > this.lastUnreadCount;
        this.lastUnreadCount = unreadCount;
        if (increased) {
          this.wakeForActivity('Neue Nachricht. Ich würde sie nicht allzu lange warten lassen.');
        }
      });
    });

    this.reload();
    this.clockTimer = window.setInterval(() => this.clockValue.set(Date.now()), 30_000);
    this.stateRefreshTimer = window.setInterval(() => this.reloadStateOnly(), 5 * 60_000);

    destroyRef.onDestroy(() => {
      this.clearTimer('transition');
      this.clearTimer('reaction');
      this.clearTimer('speech');
      this.clearTimer('message');
      if (this.activityReactionTimer !== null) window.clearTimeout(this.activityReactionTimer);
      if (this.rewardSyncTimer !== null) window.clearTimeout(this.rewardSyncTimer);
      if (this.effectTimer !== null) window.clearTimeout(this.effectTimer);
      if (this.clockTimer !== null) window.clearInterval(this.clockTimer);
      if (this.stateRefreshTimer !== null) window.clearInterval(this.stateRefreshTimer);
    });
  }

  /** Lädt Carlys persistierten Zustand vom Backend. */
  reload(): void {
    this.http.get<CarlyState>(`${API_BASE_URL}/preferences/carly/`).subscribe({
      next: (state) => this.stateValue.set(this.applyPatch(state, this.queuedPatch)),
    });
    this.http.get<CarlyRewardRules>(`${API_BASE_URL}/preferences/carly/rules/`).subscribe({
      next: (rules) => this.rewardRulesValue.set(rules),
    });
    this.http
      .get<{ items: CarlyRewardHistoryItem[] }>(`${API_BASE_URL}/preferences/carly/rewards/?limit=12`)
      .subscribe({
        next: ({ items }) => {
          items.forEach((item) => this.seenRewardIds.add(item.id ?? ''));
          this.rewardHistoryValue.set(items);
        },
      });
  }

  /** Aktualisiert ausschließlich nutzersteuerbare Carly-Einstellungen. */
  updateSettings(changes: Partial<CarlySettings>): void {
    this.stateValue.update((state) => this.applyPatch(state, changes));
    this.queuePatch(changes);
  }


  /** Speichert die gewünschte Mindestanzeigezeit von Carlys Dialogen lokal. */
  setMessageDisplaySeconds(seconds: CarlyMessageDurationSeconds): void {
    this.messageDisplaySecondsValue.set(seconds);
    window.localStorage.setItem(CARLY_MESSAGE_DURATION_STORAGE_KEY, String(seconds));
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

  /** Füttert Carly aus dem serverseitigen Inventar und startet die passende Reaktion. */
  feed(food: CarlyFoodId): void {
    if (this.progress().isSleeping || this.progress().inventory[food] <= 0) return;
    this.startReaction('feeding', 1_450);
    this.performAction('feed', { food }, (state) => this.handleFoodEffect(state.effect ?? null));
  }

  /** Kauft ein Futter ausschließlich über die serverseitige Economy. */
  buyFood(food: CarlyFoodId): void {
    this.performAction('buy-food', { food });
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


  /** Zeigt eine kurze Erfolgsreaktion mit Herzen und Board-Sternen. */
  celebrate(message: string): void {
    const runCelebration = (): void => {
      if (this.progress().isSleeping || this.visualTransitionValue() !== 'none') return;
      this.startReaction('celebrating', 3_000);
      if (this.settings().messagesEnabled) {
        this.showNotice(message, this.messageDisplaySecondsValue() * 1_000);
      }
    };

    if (this.progress().isSleeping || this.visualTransitionValue() === 'sleeping') {
      this.wake();
      if (this.activityReactionTimer !== null) window.clearTimeout(this.activityReactionTimer);
      this.activityReactionTimer = window.setTimeout(() => {
        this.activityReactionTimer = null;
        runCelebration();
      }, MIN_VISUAL_TRANSITION_MS + 220);
      return;
    }

    runCelebration();
  }

  /**
   * Lässt Carly einen Text sprechen. Die Dauer wächst mit der Textlänge und bleibt begrenzt.
   */
  speak(message: string): void {
    const text = message.trim();
    if (!text || !this.settings().messagesEnabled || this.progress().isSleeping) return;

    const speechDuration = this.calculateSpeechDuration(text);
    const displayDuration = Math.max(
      speechDuration,
      this.messageDisplaySecondsValue() * 1_000,
    );
    this.clearTimer('speech');
    this.speakingValue.set(true);
    this.speechSequenceValue.update((sequence) => sequence + 1);
    this.showNotice(text, displayDuration);

    this.speechTimer = window.setTimeout(() => {
      this.speakingValue.set(false);
      this.speechTimer = null;
    }, speechDuration);
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
    this.messageDisplaySecondsValue.set(DEFAULT_MESSAGE_DURATION_SECONDS);
    window.localStorage.removeItem(CARLY_MESSAGE_DURATION_STORAGE_KEY);
    this.http.delete<CarlyState>(`${API_BASE_URL}/preferences/carly/`).subscribe({
      next: (state) => this.stateValue.set(state),
    });
  }

  /** Reagiert auf neue, abgeschlossene oder wieder geöffnete Workspace-Elemente. */
  private handleWorkspaceActivity(activity: WorkspaceActivityEvent): void {
    if (!this.settings().enabled) return;

    const rewardableKinds: readonly WorkspaceActivityEvent['kind'][] = [
      'task-created',
      'task-completed',
      'task-updated',
      'task-moved',
      'subtask-completed',
      'project-created',
      'project-updated',
      'project-completed',
      'comment-created',
      'message-sent',
    ];
    if (rewardableKinds.includes(activity.kind)) {
      this.scheduleRewardSync();
    }

    if (activity.kind === 'task-completed' && this.settings().taskReactionsEnabled) {
      this.celebrate(`„${activity.title}“ erledigt. Sehr schön. Das verdient ein wenig Sternenstaub.`);
      return;
    }

    if (activity.kind === 'project-completed' && this.settings().taskReactionsEnabled) {
      this.celebrate(`„${activity.title}“ abgeschlossen. Ich erlaube einen angemessen stolzen Moment.`);
      return;
    }

    const wakeMessages: Partial<Record<WorkspaceActivityEvent['kind'], string>> = {
      'task-created': `„${activity.title}“ ist neu auf dem Board. Dann geben wir ihr einen guten Start.`,
      'task-reopened': `„${activity.title}“ ist wieder offen. Offenbar war die Geschichte doch noch nicht zu Ende.`,
      'project-created': `„${activity.title}“ steht. Jetzt fehlt nur noch der Teil mit dem Erledigen.`,
    };
    const message = wakeMessages[activity.kind];
    if (message) {
      this.wakeForActivity(message);
    }
  }

  /** Weckt Carly bei relevanter Aktivität und spricht anschließend optional einen kurzen Hinweis. */
  private wakeForActivity(message: string): void {
    const speakAfterWake = (): void => {
      if (this.settings().messagesEnabled && !this.progress().isSleeping) {
        this.speak(message);
      }
    };

    if (this.progress().isSleeping || this.visualTransitionValue() === 'sleeping') {
      this.wake();
      if (this.activityReactionTimer !== null) window.clearTimeout(this.activityReactionTimer);
      this.activityReactionTimer = window.setTimeout(() => {
        this.activityReactionTimer = null;
        speakAfterWake();
      }, MIN_VISUAL_TRANSITION_MS + 220);
    }
  }

  /** Lädt nach einer Workspace-Aktion neu entstandene Server-Rewards mit kurzen Retries. */
  private scheduleRewardSync(attempt = 0): void {
    if (this.rewardSyncTimer !== null) window.clearTimeout(this.rewardSyncTimer);
    const delay = attempt === 0 ? 650 : 850 + attempt * 350;

    this.rewardSyncTimer = window.setTimeout(() => {
      this.rewardSyncTimer = null;
      this.http
        .get<{ items: CarlyRewardHistoryItem[] }>(
          `${API_BASE_URL}/preferences/carly/rewards/?limit=8`,
        )
        .subscribe({
          next: ({ items }) => {
            const fresh = items.filter((item) => item.id && !this.seenRewardIds.has(item.id));
            fresh.forEach((item) => {
              if (item.id) this.seenRewardIds.add(item.id);
              this.showRewardFeedback(item);
            });
            if (fresh.length) {
              this.rewardHistoryValue.update((history) => [...fresh, ...history].slice(0, 12));
              this.reloadStateOnly();
              return;
            }
            if (attempt < 2) {
              this.scheduleRewardSync(attempt + 1);
            }
          },
        });
    }, delay);
  }

  /** Aktualisiert Carlys Zustand ohne Rules/History erneut zu laden. */
  private reloadStateOnly(): void {
    this.http.get<CarlyState>(`${API_BASE_URL}/preferences/carly/`).subscribe({
      next: (state) => this.stateValue.set(this.applyPatch(state, this.queuedPatch)),
    });
  }

  /** Zeigt eine serverbestätigte XP-/Credit-Belohnung gemäß Nutzereinstellung. */
  private showRewardFeedback(reward: CarlyReward): void {
    const settings = this.settings();
    if (!settings.rewardPopupsEnabled) return;
    this.rewardFeedback.show(reward, {
      showXp: settings.showXpRewards,
      showCredits: settings.showCreditRewards,
    });
  }

  /** Startet einmalige Spezialreaktionen des verfütterten Items. */
  private handleFoodEffect(effect: CarlySpecialEffect): void {
    this.specialEffectValue.set(effect);
    if (this.effectTimer !== null) window.clearTimeout(this.effectTimer);

    if (effect === 'berry-dizzy') {
      this.effectTimer = window.setTimeout(() => {
        this.startReaction('dizzy', 6_000);
        this.effectTimer = window.setTimeout(() => this.specialEffectValue.set(null), 6_000);
      }, 1_250);
      return;
    }

    if (effect === 'cookie-stars') {
      this.effectTimer = window.setTimeout(() => this.specialEffectValue.set(null), 2_400);
      return;
    }

    this.effectTimer = window.setTimeout(() => this.specialEffectValue.set(null), 1_800);
  }

  /** Liest die lokale Dialogdauer defensiv aus dem Browser-Speicher. */
  private readStoredMessageDuration(): CarlyMessageDurationSeconds {
    const value = Number(window.localStorage.getItem(CARLY_MESSAGE_DURATION_STORAGE_KEY));
    return value === 5 || value === 7 || value === 10 || value === 15
      ? value
      : DEFAULT_MESSAGE_DURATION_SECONDS;
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
    onSuccess?: (state: CarlyState) => void,
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

          if (state.reward) this.showRewardFeedback(state.reward);
          onSuccess?.(state);
        },
        error: () => {
          onError?.();
          this.reload();
        },
      });
  }
}
