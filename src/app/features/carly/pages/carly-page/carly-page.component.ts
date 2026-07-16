// src/app/features/carly/pages/carly-page/carly-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { CarlyFoodId } from '../../../../core/carly/carly.models';
import { CarlyService } from '../../../../core/carly/carly.service';
import { CarlyFaceComponent } from '../../../../shared/ui/carly-face/carly-face.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-carly-page',
  imports: [CarlyFaceComponent, PageHeaderComponent],
  templateUrl: './carly-page.component.html',
  styleUrls: [
    './carly-page.component.scss',
    './carly-page.stats.scss',
    './carly-page.cards.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyPageComponent {
  protected readonly carlyService: CarlyService;
  protected readonly petted = signal(false);
  protected readonly foods: readonly { id: CarlyFoodId; emoji: string; label: string }[] = [
    { id: 'fish', emoji: '🐟', label: 'Mondfisch' },
    { id: 'berry', emoji: '🫐', label: 'Mystikbeeren' },
    { id: 'cookie', emoji: '🍪', label: 'Sternenkeks' },
    { id: 'potion', emoji: '🧪', label: 'Energietrank' },
  ];

  constructor(carlyService: CarlyService) { this.carlyService = carlyService; }

  /** Streichelt Carly und zeigt eine kurze Herzanimation. */
  protected pet(): void { this.carlyService.pet(); this.petted.set(true); window.setTimeout(() => this.petted.set(false), 1_800); }
}
