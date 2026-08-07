// src/app/features/auth/pages/forgot-password-page/forgot-password-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../../core/auth/services/auth.service';
import { TextFieldComponent } from '../../../../shared/ui/forms/text-field/text-field.component';
import { emailCharactersValidator } from '../../../../shared/validation/auth.validators';

@Component({
  selector: 'cm-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, TextFieldComponent],
  templateUrl: './forgot-password-page.component.html',
  styleUrl: '../login-page/login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPageComponent {
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(254),
        emailCharactersValidator(),
      ],
    }),
  });
  protected readonly submitted = signal(false);
  protected readonly pending = signal(false);
  protected readonly sent = signal(false);
  protected readonly formError = signal('');

  constructor(private readonly authService: AuthService) {}

  /** Fordert eine Reset-Nachricht mit einer bewusst generischen Erfolgsanzeige an. */
  submit(): void {
    this.submitted.set(true);
    this.formError.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) return;

    this.pending.set(true);
    const email = this.form.controls.email.value.trim().toLocaleLowerCase('de-DE');
    this.authService
      .requestPasswordReset(email)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => this.sent.set(true),
        error: () =>
          this.formError.set('Die Anfrage konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut.'),
      });
  }
}
