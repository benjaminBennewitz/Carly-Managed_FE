// src/app/features/carly/pages/carly-page/carly-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { CarlyFoodId } from '../../../../core/carly/carly.models';
import { CarlyService } from '../../../../core/carly/carly.service';
import { CarlyCharacterComponent } from '../../../../shared/ui/carly-character/carly-character.component';
import { CarlyStorybookComponent } from '../../components/carly-storybook/carly-storybook.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-carly-page',
  imports: [CarlyCharacterComponent, CarlyStorybookComponent, PageHeaderComponent],
  templateUrl: './carly-page.component.html',
  styleUrls: [
    './carly-page.component.scss',
    './carly-page.stats.scss',
    './carly-page.cards.scss',
    './carly-page.stage.scss',
    './carly-page.mascot.scss',
    './carly-page.animations.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyPageComponent {
  protected readonly carlyService: CarlyService;
  protected readonly storybookOpen = signal(false);
  protected readonly foods: readonly {
    id: CarlyFoodId;
    emoji: string;
    label: string;
    fallbackCost: number;
    effect: string;
  }[] = [
    {
      id: 'fish',
      emoji: '🐟',
      label: 'Mondfisch',
      fallbackCost: 20,
      effect: '+3 XP auf alle Belohnungen, solange der Mond wirkt',
    },
    {
      id: 'berry',
      emoji: '🫐',
      label: 'Mystikbeeren',
      fallbackCost: 35,
      effect: 'Mystik-Fokus: nächster Task- oder Unteraufgabenabschluss +5 XP (30 Min.)',
    },
    {
      id: 'cookie',
      emoji: '🍪',
      label: 'Sternenkeks',
      fallbackCost: 60,
      effect: '+10 XP auf Projektabschlüsse für 60 Minuten',
    },
    {
      id: 'potion',
      emoji: '🧪',
      label: 'Energietrank',
      fallbackCost: 100,
      effect: '100 % Energie und +3 XP auf alle Abschlüsse, solange sie voll bleibt',
    },
  ];

  constructor(carlyService: CarlyService) {
    this.carlyService = carlyService;
  }

  /** Streichelt Carly oder zeigt im Schlaf den Hinweis ohne Serveraktion. */
  protected pet(): void {
    this.carlyService.pet();
  }


  /** Liefert den serverseitig veröffentlichten Preis mit sicherem UI-Fallback. */
  protected foodCost(food: { id: CarlyFoodId; fallbackCost: number }): number {
    return this.carlyService.rewardRules()?.foods.find((rule) => rule.id === food.id)?.cost ?? food.fallbackCost;
  }

  /** Liefert den aktuellen serverseitigen Inventarbestand. */
  protected foodCount(food: CarlyFoodId): number {
    return this.carlyService.progress().inventory[food] ?? 0;
  }


  /** Übersetzt einen Ledger-Ereignistyp über die serverseitige Regelliste. */
  protected rewardLabel(eventType: string): string {
    return this.carlyService.rewardRules()?.rewards.find((rule) => rule.eventType === eventType)?.label ?? eventType;
  }

  /** Öffnet Carlys vierseitige Hintergrundgeschichte. */
  protected openStorybook(): void {
    this.storybookOpen.set(true);
  }

  /** Schließt Carlys Hintergrundgeschichte. */
  protected closeStorybook(): void {
    this.storybookOpen.set(false);
  }
}
