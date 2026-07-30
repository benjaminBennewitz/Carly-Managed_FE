/* src/app/core/carly/carly.models.ts */

export type CarlyMood = 'glücklich' | 'neugierig' | 'müde' | 'hungrig';
export type CarlyFoodId = 'fish' | 'berry' | 'cookie' | 'potion';
export type CarlyVisualTransition = 'none' | 'sleeping' | 'waking';
export type CarlyReaction = 'none' | 'petted' | 'dizzy' | 'celebrating' | 'feeding';
export type CarlySpecialEffect = 'moon' | 'berry-dizzy' | 'cookie-stars' | 'energy-aura' | 'purchase' | null;
export type CarlyMessageDurationSeconds = 5 | 7 | 10 | 15;

export interface CarlySettings {
  enabled: boolean;
  showGlobally: boolean;
  messagesEnabled: boolean;
  taskReactionsEnabled: boolean;
  autoSleep: boolean;
  reduceAnimations: boolean;
  rewardPopupsEnabled: boolean;
  showXpRewards: boolean;
  showCreditRewards: boolean;
}

export interface CarlyInventory {
  fish: number;
  berry: number;
  cookie: number;
  potion: number;
}

export interface CarlyDailyRewards {
  xpEarned: number;
  xpSoftCap: number;
  xpHardCap: number;
  creditsEarned: number;
  creditsSoftCap: number;
  creditsHardCap: number;
}

export interface CarlyReward {
  id: string | null;
  eventType: string;
  xp: number;
  credits: number;
  multiplier: number;
  createdAt: string;
  duplicate?: boolean;
}

export interface CarlyRewardHistoryItem extends CarlyReward {
  sourceType: string;
  sourceId: string;
  metadata: Record<string, unknown>;
}

export interface CarlyRewardRule {
  eventType: string;
  label: string;
  xp: number;
  credits: number;
  fullUntil: number;
  halfUntil: number;
  quarterUntil: number;
  bonuses: string[];
}

export interface CarlyFoodRule {
  id: CarlyFoodId;
  label: string;
  cost: number;
  satiety: number;
  affection: number;
  effect: Exclude<CarlySpecialEffect, 'purchase' | null>;
}

export interface CarlyRewardRules {
  dailyCaps: {
    xpSoft: number;
    xpHard: number;
    creditsSoft: number;
    creditsHard: number;
  };
  rewards: CarlyRewardRule[];
  foods: CarlyFoodRule[];
  today: CarlyDailyRewards;
}

export interface CarlyProgress {
  level: number;
  experience: number;
  levelExperience: number;
  nextLevelExperience: number;
  credits: number;
  inventory: CarlyInventory;
  affection: number;
  energy: number;
  satiety: number;
  streak: number;
  mood: CarlyMood;
  isSleeping: boolean;
  lastMessage: string;
  positionX: number;
  auraUntil: string | null;
  moonUntil: string | null;
  dailyRewards: CarlyDailyRewards;
}

export interface CarlyState {
  settings: CarlySettings;
  progress: CarlyProgress;
  reward?: CarlyReward | null;
  effect?: CarlySpecialEffect;
  version?: number;
}
