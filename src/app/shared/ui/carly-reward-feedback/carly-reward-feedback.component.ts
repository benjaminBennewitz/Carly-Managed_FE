/* src/app/shared/ui/carly-reward-feedback/carly-reward-feedback.component.ts */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CarlyRewardFeedbackService } from '../../../core/carly/carly-reward-feedback.service';

@Component({
  selector: 'cm-carly-reward-feedback',
  templateUrl: './carly-reward-feedback.component.html',
  styleUrl: './carly-reward-feedback.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyRewardFeedbackComponent {
  protected readonly feedback = inject(CarlyRewardFeedbackService);
}
