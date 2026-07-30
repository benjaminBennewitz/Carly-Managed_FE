// src/app/app.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CarlyRewardFeedbackComponent } from './shared/ui/carly-reward-feedback/carly-reward-feedback.component';

@Component({
  selector: 'cm-root',
  imports: [RouterOutlet, CarlyRewardFeedbackComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
