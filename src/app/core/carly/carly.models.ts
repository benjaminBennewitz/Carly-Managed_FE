// src/app/core/carly/carly.models.ts

export type CarlyMood = 'glücklich' | 'neugierig' | 'müde' | 'hungrig';
export type CarlyFoodId = 'fish' | 'berry' | 'cookie' | 'potion';

export interface CarlySettings {
  enabled: boolean;
  showGlobally: boolean;
  messagesEnabled: boolean;
  taskReactionsEnabled: boolean;
  autoSleep: boolean;
  reduceAnimations: boolean;
}

export interface CarlyProgress {
  level: number;
  experience: number;
  affection: number;
  energy: number;
  satiety: number;
  streak: number;
  mood: CarlyMood;
  isSleeping: boolean;
  lastMessage: string;
  positionX: number;
}

export interface CarlyState {
  settings: CarlySettings;
  progress: CarlyProgress;
}
