// src/app/features/carly/pages/carly-page/carly-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CarlyFoodId } from '../../../../core/carly/carly.models';
import { CarlyService } from '../../../../core/carly/carly.service';
import { CarlyCharacterComponent } from '../../../../shared/ui/carly-character/carly-character.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-carly-page',
  imports: [CarlyCharacterComponent, PageHeaderComponent],
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
  protected readonly foods: readonly { id: CarlyFoodId; emoji: string; label: string }[] = [
    { id: 'fish', emoji: '🐟', label: 'Mondfisch' },
    { id: 'berry', emoji: '🫐', label: 'Mystikbeeren' },
    { id: 'cookie', emoji: '🍪', label: 'Sternenkeks' },
    { id: 'potion', emoji: '🧪', label: 'Energietrank' },
  ];

  constructor(carlyService: CarlyService) {
    this.carlyService = carlyService;
  }

  /** Streichelt Carly oder zeigt im Schlaf den Hinweis ohne Serveraktion. */
  protected pet(): void {
    this.carlyService.pet();
  }
}
