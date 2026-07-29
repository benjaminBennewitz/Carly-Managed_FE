// src/app/shared/ui/carly-face/carly-face.component.ts

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CarlyCharacterComponent } from '../carly-character/carly-character.component';

@Component({
  selector: 'cm-carly-face',
  imports: [CarlyCharacterComponent],
  templateUrl: './carly-face.component.html',
  styleUrl: './carly-face.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyFaceComponent {
  readonly large = input(false);
  readonly reduced = input(false);
}
