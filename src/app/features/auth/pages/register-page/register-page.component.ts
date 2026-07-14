// src/app/features/auth/pages/register-page/register-page.component.ts

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthPreviewService } from '../../../../core/auth/services/auth-preview.service';
import { CheckboxFieldComponent } from '../../../../shared/ui/forms/checkbox-field/checkbox-field.component';
import { TextFieldComponent } from '../../../../shared/ui/forms/text-field/text-field.component';
import {
  displayNameCharactersValidator,
  emailCharactersValidator,
  matchesControlValidator,
  noControlCharactersValidator,
  personalDataPasswordValidator,
  uncommonPasswordValidator,
} from '../../../../shared/validation/auth.validators';

interface RegistrationForm {
  displayName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
  passwordConfirmation: FormControl<string>;
  acceptedTerms: FormControl<boolean>;
}

@Component({
  selector: 'cm-register-page',
  imports: [CheckboxFieldComponent, ReactiveFormsModule, RouterLink, TextFieldComponent],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  private readonly destroyRef = inject(DestroyRef);

  private readonly displayNameControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(60),
      displayNameCharactersValidator(),
      noControlCharactersValidator(),
    ],
  });

  private readonly emailControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.email,
      Validators.maxLength(254),
      emailCharactersValidator(),
    ],
  });

  private readonly passwordControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(12),
      Validators.maxLength(128),
      noControlCharactersValidator(),
      uncommonPasswordValidator(),
      personalDataPasswordValidator(this.displayNameControl, this.emailControl),
    ],
  });

  protected readonly form = new FormGroup<RegistrationForm>({
    displayName: this.displayNameControl,
    email: this.emailControl,
    password: this.passwordControl,
    passwordConfirmation: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(128),
        noControlCharactersValidator(),
        matchesControlValidator(this.passwordControl),
      ],
    }),
    acceptedTerms: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  protected readonly submitted = signal(false);
  protected readonly pending = signal(false);
  protected readonly formError = signal('');

  constructor(
    private readonly authPreviewService: AuthPreviewService,
    private readonly router: Router,
  ) {
    this.passwordControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.form.controls.passwordConfirmation.updateValueAndValidity({ emitEvent: false }),
      );

    this.displayNameControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.passwordControl.updateValueAndValidity({ emitEvent: false }));

    this.emailControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.passwordControl.updateValueAndValidity({ emitEvent: false }));
  }

  /**
   * Liefert die Anzahl erfüllter Kriterien für die dezente Stärkeanzeige.
   */
  passwordScore(): number {
    const value = this.passwordControl.value;

    return [
      value.length >= 12,
      value.length >= 16,
      /[a-zA-ZäöüÄÖÜß]/.test(value) && /[^a-zA-ZäöüÄÖÜß]/.test(value),
      !this.passwordControl.hasError('commonPassword') &&
        !this.passwordControl.hasError('containsPersonalData') &&
        !this.passwordControl.hasError('controlCharacters') &&
        value.length > 0,
    ].filter(Boolean).length;
  }

  /**
   * Validiert das Formular und startet die Registrierung.
   */
  submit(): void {
    this.submitted.set(true);
    this.formError.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid || this.pending()) {
      return;
    }

    this.pending.set(true);
    const rawValue = this.form.getRawValue();

    this.authPreviewService
      .register({
        displayName: rawValue.displayName.trim(),
        email: rawValue.email.trim().toLocaleLowerCase('de-DE'),
        password: rawValue.password,
        acceptedTerms: rawValue.acceptedTerms,
      })
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/dashboard']),
        error: () => {
          this.formError.set(
            'Die Registrierung konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut.',
          );
        },
      });
  }
}
