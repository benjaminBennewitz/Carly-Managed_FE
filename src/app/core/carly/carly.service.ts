// src/app/core/carly/carly.service.ts

import { computed, Injectable, signal } from '@angular/core';

import { CarlyFoodId, CarlyProgress, CarlySettings, CarlyState } from './carly.models';

const CARLY_STORAGE_KEY = 'carly-managed-carly-v1';
const DEFAULT_STATE: CarlyState = {
  settings: {
    enabled: true,
    showGlobally: true,
    messagesEnabled: true,
    taskReactionsEnabled: true,
    autoSleep: true,
    reduceAnimations: false,
  },
  progress: {
    level: 3,
    experience: 62,
    affection: 74,
    energy: 68,
    satiety: 58,
    streak: 5,
    mood: 'neugierig',
    isSleeping: false,
    lastMessage: 'Bereit für ein kleines Produktivitätsabenteuer?',
    positionX: 28,
  },
};

const FOOD_VALUES: Record<CarlyFoodId, { satiety: number; affection: number; message: string }> = {
  fish: { satiety: 24, affection: 4, message: 'Fisch! Ein Klassiker mit magischem Nachgeschmack.' },
  berry: { satiety: 12, affection: 7, message: 'Mystische Beeren. Knusprig wären sie besser.' },
  cookie: { satiety: 18, affection: 10, message: 'Ein Keks für Carly. Das bleibt unter uns.' },
  potion: { satiety: 8, affection: 5, message: 'Der Trank prickelt bis in die Ohrenspitzen.' },
};

@Injectable({ providedIn: 'root' })
export class CarlyService {
  private readonly stateValue = signal<CarlyState>(this.readState());

  readonly state = this.stateValue.asReadonly();
  readonly settings = computed(() => this.stateValue().settings);
  readonly progress = computed(() => this.stateValue().progress);
  readonly visibleGlobally = computed(() => this.settings().enabled && this.settings().showGlobally);
  readonly levelProgress = computed(() => Math.max(0, Math.min(100, this.progress().experience)));

  /** Aktualisiert Carlys globale Einstellungen. */
  updateSettings(changes: Partial<CarlySettings>): void {
    this.updateState({
      settings: { ...this.settings(), ...changes },
      progress: this.progress(),
    });
  }

  /** Streichelt Carly und erhöht Zuneigung sowie Erfahrung. */
  pet(): void {
    if (this.progress().isSleeping) return;
    this.updateProgress({
      affection: this.clamp(this.progress().affection + 5),
      experience: this.nextExperience(4),
      mood: 'glücklich',
      lastMessage: 'Mrrrp. Das war akzeptabel. Du darfst weitermachen.',
    });
  }

  /** Füttert Carly mit einer ausgewählten Kleinigkeit. */
  feed(food: CarlyFoodId): void {
    if (this.progress().isSleeping) return;
    const values = FOOD_VALUES[food];
    this.updateProgress({
      satiety: this.clamp(this.progress().satiety + values.satiety),
      affection: this.clamp(this.progress().affection + values.affection),
      experience: this.nextExperience(6),
      mood: 'glücklich',
      lastMessage: values.message,
    });
  }

  /** Startet eine kurze Spielaktion. */
  play(): void {
    if (this.progress().isSleeping) return;
    this.updateProgress({
      energy: this.clamp(this.progress().energy - 12),
      affection: this.clamp(this.progress().affection + 8),
      experience: this.nextExperience(8),
      mood: 'glücklich',
      lastMessage: 'Ein magischer Sprint! Jetzt bist du wieder dran.',
    });
  }

  /** Schickt Carly schlafen. */
  sleep(): void {
    this.updateProgress({ isSleeping: true, mood: 'müde', lastMessage: 'Zzz … nur fünf magische Minuten.' });
  }

  /** Weckt Carly und füllt ihre Energie auf. */
  wake(): void {
    this.updateProgress({
      isSleeping: false,
      energy: this.clamp(this.progress().energy + 28),
      mood: 'neugierig',
      lastMessage: 'Ich bin wach. Was habe ich verpasst?',
    });
  }

  /** Speichert die horizontale Position des globalen Maskottchens. */
  setPositionX(positionX: number): void {
    this.updateProgress({ positionX: Math.max(0, Math.round(positionX)) });
  }

  /** Setzt Carly auf den Auslieferungszustand zurück. */
  reset(): void {
    this.updateState(structuredClone(DEFAULT_STATE));
  }

  /** Aktualisiert ausschließlich Fortschrittswerte. */
  private updateProgress(changes: Partial<CarlyProgress>): void {
    this.updateState({ settings: this.settings(), progress: { ...this.progress(), ...changes } });
  }

  /** Speichert einen vollständigen Carly-Zustand. */
  private updateState(state: CarlyState): void {
    this.stateValue.set(state);
    localStorage.setItem(CARLY_STORAGE_KEY, JSON.stringify(state));
  }

  /** Berechnet Erfahrung und einfache Levelaufstiege. */
  private nextExperience(amount: number): number {
    const total = this.progress().experience + amount;
    if (total < 100) return total;
    this.updateProgress({ level: this.progress().level + 1 });
    return total - 100;
  }

  /** Begrenzt Prozentwerte auf den gültigen Bereich. */
  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  /** Liest und bereinigt den lokal gespeicherten Zustand. */
  private readState(): CarlyState {
    try {
      const raw = localStorage.getItem(CARLY_STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw) as Partial<CarlyState>;
      return {
        settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
        progress: { ...DEFAULT_STATE.progress, ...parsed.progress },
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }
}
