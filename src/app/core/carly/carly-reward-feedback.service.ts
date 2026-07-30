/* src/app/core/carly/carly-reward-feedback.service.ts */

import { DestroyRef, Injectable, signal } from '@angular/core';

import { CarlyReward } from './carly.models';

export interface CarlyRewardPopup {
  id: string;
  xp: number;
  credits: number;
  x: number;
  y: number;
}

@Injectable({ providedIn: 'root' })
export class CarlyRewardFeedbackService {
  private readonly popupsValue = signal<CarlyRewardPopup[]>([]);
  private lastPointerX = window.innerWidth / 2;
  private lastPointerY = window.innerHeight / 2;

  readonly popups = this.popupsValue.asReadonly();

  constructor(destroyRef: DestroyRef) {
    const handlePointer = (event: PointerEvent): void => {
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
    };

    window.addEventListener('pointermove', handlePointer, { passive: true });
    destroyRef.onDestroy(() => window.removeEventListener('pointermove', handlePointer));
  }

  /** Zeigt eine vom Backend bestätigte Belohnung nahe der letzten Interaktion. */
  show(reward: CarlyReward, options: { showXp: boolean; showCredits: boolean }): void {
    const xp = options.showXp ? reward.xp : 0;
    const credits = options.showCredits ? reward.credits : 0;
    if (reward.duplicate || (!xp && !credits)) return;

    const popup: CarlyRewardPopup = {
      id: reward.id ?? crypto.randomUUID(),
      xp,
      credits,
      x: Math.max(24, Math.min(window.innerWidth - 160, this.lastPointerX + 14)),
      y: Math.max(24, Math.min(window.innerHeight - 96, this.lastPointerY - 18)),
    };

    this.popupsValue.update((items) => [...items, popup]);
    window.setTimeout(() => {
      this.popupsValue.update((items) => items.filter((item) => item.id !== popup.id));
    }, 1_450);
  }
}
