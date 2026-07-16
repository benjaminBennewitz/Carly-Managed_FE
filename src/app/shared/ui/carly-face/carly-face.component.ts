// src/app/shared/ui/carly-face/carly-face.component.ts

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'cm-carly-face',
  templateUrl: './carly-face.component.html',
  styleUrl: './carly-face.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyFaceComponent {
  readonly sleeping = input(false);
  readonly petted = input(false);
  readonly large = input(false);
  readonly reduced = input(false);
}
