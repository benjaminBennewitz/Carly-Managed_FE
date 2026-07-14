// src/app/shared/ui/forms/text-field/text-field.component.ts

import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

export type TextFieldType = 'email' | 'password' | 'text';

@Component({
  selector: 'cm-text-field',
  imports: [ReactiveFormsModule],
  templateUrl: './text-field.component.html',
  styleUrl: './text-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextFieldComponent {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly type = input<TextFieldType>('text');
  readonly autocomplete = input<string>('off');
  readonly placeholder = input<string>('');
  readonly required = input<boolean>(false);
  readonly submitted = input<boolean>(false);
  readonly allowPasswordToggle = input<boolean>(false);
  readonly maxlength = input<number | null>(null);

  readonly passwordVisible = signal(false);

  /**
   * Liefert den tatsächlich zu verwendenden Typ des nativen Eingabefeldes.
   */
  resolvedType(): TextFieldType {
    if (this.type() !== 'password' || !this.passwordVisible()) {
      return this.type();
    }

    return 'text';
  }

  /**
   * Zeigt einen Fehler direkt nach der ersten Eingabe, nach Verlassen des Feldes
   * oder nach einem Formularversuch an.
   */
  isInvalid(): boolean {
    const control = this.control();

    return control.invalid && (control.dirty || control.touched || this.submitted());
  }

  /**
   * Markiert bereits geprüfte Werte dezent, ohne eine Ampelfarbe zu verwenden.
   */
  isConfirmed(): boolean {
    const control = this.control();

    return control.valid && control.touched && control.value.trim().length > 0;
  }

  /**
   * Verknüpft die aktuelle Fehlermeldung mit dem Eingabefeld.
   */
  describedBy(): string | null {
    return this.isInvalid() ? `${this.inputId()}-error` : null;
  }

  /**
   * Ermittelt die verständlichste Meldung für den ersten aktuellen Feldfehler.
   */
  errorMessage(): string {
    const errors = this.control().errors;

    if (!errors) {
      return '';
    }

    if (typeof errors['server'] === 'string') {
      return errors['server'];
    }

    if (errors['required']) {
      return 'Dieses Feld wird benötigt.';
    }

    if (errors['invalidDisplayNameCharacters']) {
      return 'Verwende nur Buchstaben, Zahlen, Leerzeichen, Punkte, Apostrophe oder Bindestriche.';
    }

    if (errors['invalidEmailCharacters']) {
      return 'Die E-Mail-Adresse enthält nicht unterstützte Zeichen.';
    }

    if (errors['email']) {
      return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    }

    if (errors['controlCharacters']) {
      return 'Unsichtbare Steuerzeichen sind in diesem Feld nicht erlaubt.';
    }

    if (errors['minlength']) {
      return `Bitte verwende mindestens ${errors['minlength'].requiredLength} Zeichen.`;
    }

    if (errors['maxlength']) {
      return `Bitte verwende höchstens ${errors['maxlength'].requiredLength} Zeichen.`;
    }

    if (errors['commonPassword']) {
      return 'Dieses Passwort ist zu häufig und dadurch leicht zu erraten.';
    }

    if (errors['containsPersonalData']) {
      return 'Das Passwort sollte keine Teile deines Namens oder deiner E-Mail enthalten.';
    }

    if (errors['mismatch']) {
      return 'Die beiden Passwörter stimmen noch nicht überein.';
    }

    return 'Bitte prüfe deine Eingabe.';
  }

  /**
   * Wechselt die sichtbare Darstellung eines Passwortfeldes.
   */
  togglePasswordVisibility(): void {
    this.passwordVisible.update((isVisible) => !isVisible);
  }
}
