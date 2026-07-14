// src/app/shared/ui/forms/checkbox-field/checkbox-field.component.ts

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'cm-checkbox-field',
  imports: [ReactiveFormsModule],
  templateUrl: './checkbox-field.component.html',
  styleUrl: './checkbox-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxFieldComponent {
  readonly control = input.required<FormControl<boolean>>();
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly error = input<string>('');
  readonly submitted = input<boolean>(false);

  /**
   * Zeigt den Fehler erst nach einer Interaktion oder einem Absendeversuch an.
   */
  isInvalid(): boolean {
    const control = this.control();

    return control.invalid && (control.touched || this.submitted());
  }
}
