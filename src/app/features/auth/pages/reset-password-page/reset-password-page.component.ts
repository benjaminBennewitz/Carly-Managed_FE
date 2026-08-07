// src/app/features/auth/pages/reset-password-page/reset-password-page.component.ts

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../../core/auth/services/auth.service';
import { TextFieldComponent } from '../../../../shared/ui/forms/text-field/text-field.component';
import { matchesControlValidator, noControlCharactersValidator, uncommonPasswordValidator } from '../../../../shared/validation/auth.validators';

@Component({
  selector: 'cm-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, TextFieldComponent],
  templateUrl: './reset-password-page.component.html',
  styleUrl: '../login-page/login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly passwordControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(12),
      Validators.maxLength(128),
      noControlCharactersValidator(),
      uncommonPasswordValidator(),
    ],
  });

  protected readonly token: string;
  protected readonly form = new FormGroup({
    newPassword: this.passwordControl,
    confirmation: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(128),
        noControlCharactersValidator(),
        matchesControlValidator(this.passwordControl),
      ],
    }),
  });
  protected readonly submitted = signal(false);
  protected readonly pending = signal(false);
  protected readonly completed = signal(false);
  protected readonly formError = signal('');

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
  ) {
    const fragmentToken = new URLSearchParams(this.route.snapshot.fragment ?? '').get('token')?.trim() ?? '';
    this.token = fragmentToken || this.route.snapshot.queryParamMap.get('token')?.trim() || '';
    if (this.token && typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }

    this.passwordControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.confirmation.updateValueAndValidity({ emitEvent: false }));
  }

  /** Verbraucht das Einmal-Token und setzt ein lokal sowie serverseitig validiertes Passwort. */
  submit(): void {
    this.submitted.set(true);
    this.formError.set('');
    this.form.markAllAsTouched();
    if (!this.token) {
      this.formError.set('Der Reset-Link ist unvollständig. Fordere bitte einen neuen Link an.');
      return;
    }
    if (this.form.invalid || this.pending()) return;

    this.pending.set(true);
    this.authService
      .confirmPasswordReset(this.token, this.passwordControl.value)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => this.completed.set(true),
        error: () =>
          this.formError.set('Der Link ist ungültig oder abgelaufen. Fordere bitte einen neuen Reset-Link an.'),
      });
  }
}
