// src/app/features/settings/components/account-settings/account-settings.component.ts

import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../../../core/auth/services/auth.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { TextFieldComponent } from '../../../../shared/ui/forms/text-field/text-field.component';
import { displayNameCharactersValidator, matchesControlValidator, noControlCharactersValidator, uncommonPasswordValidator } from '../../../../shared/validation/auth.validators';

@Component({
  selector: 'cm-account-settings',
  imports: [ReactiveFormsModule, TextFieldComponent],
  templateUrl: './account-settings.component.html',
  styleUrl: './account-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly newPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(12),
      Validators.maxLength(128),
      noControlCharactersValidator(),
      uncommonPasswordValidator(),
    ],
  });

  protected readonly currentUser = this.sessionService.currentUser;
  protected readonly profileForm = new FormGroup({
    displayName: new FormControl(this.currentUser()?.displayName ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(60),
        displayNameCharactersValidator(),
      ],
    }),
  });
  protected readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128), noControlCharactersValidator()],
    }),
    newPassword: this.newPasswordControl,
    confirmation: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(128),
        noControlCharactersValidator(),
        matchesControlValidator(this.newPasswordControl),
      ],
    }),
  });
  protected readonly profileSubmitted = signal(false);
  protected readonly passwordSubmitted = signal(false);
  protected readonly profilePending = signal(false);
  protected readonly passwordPending = signal(false);
  protected readonly verificationPending = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');

  constructor() {
    this.newPasswordControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.passwordForm.controls.confirmation.updateValueAndValidity({ emitEvent: false }),
      );
  }

  /** Speichert den Anzeigenamen und hält die aktuelle Sitzung synchron. */
  protected saveProfile(): void {
    this.profileSubmitted.set(true);
    this.clearMessages();
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.profilePending()) return;

    this.profilePending.set(true);
    this.authService
      .updateProfile(this.profileForm.controls.displayName.value.trim())
      .pipe(finalize(() => this.profilePending.set(false)))
      .subscribe({
        next: ({ user }) => {
          this.profileForm.controls.displayName.setValue(user.displayName);
          this.statusMessage.set('Profil gespeichert.');
        },
        error: () => this.errorMessage.set('Das Profil konnte nicht gespeichert werden.'),
      });
  }

  /** Ändert das Passwort erst nach erneuter Prüfung des aktuellen Passworts. */
  protected changePassword(): void {
    this.passwordSubmitted.set(true);
    this.clearMessages();
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.passwordPending()) return;

    this.passwordPending.set(true);
    const values = this.passwordForm.getRawValue();
    this.authService
      .changePassword(values.currentPassword, values.newPassword)
      .pipe(finalize(() => this.passwordPending.set(false)))
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.passwordSubmitted.set(false);
          this.statusMessage.set('Passwort geändert. Deine aktuelle Sitzung bleibt bestehen.');
        },
        error: (error: HttpErrorResponse) =>
          this.errorMessage.set(
            this.readFieldError(error, 'currentPassword') ??
              this.readFieldError(error, 'newPassword') ??
              'Das Passwort konnte nicht geändert werden.',
          ),
      });
  }

  /** Fordert einen neuen E-Mail-Bestätigungslink für die aktuelle Adresse an. */
  protected resendVerification(): void {
    this.clearMessages();
    if (this.verificationPending() || this.currentUser()?.emailVerified) return;

    this.verificationPending.set(true);
    this.authService
      .requestEmailVerification()
      .pipe(finalize(() => this.verificationPending.set(false)))
      .subscribe({
        next: () => this.statusMessage.set('Ein neuer Bestätigungslink wurde angefordert.'),
        error: () =>
          this.errorMessage.set('Der Bestätigungslink konnte gerade nicht angefordert werden.'),
      });
  }

  /** Entfernt vorherige Statusmeldungen vor einer neuen Kontoaktion. */
  private clearMessages(): void {
    this.statusMessage.set('');
    this.errorMessage.set('');
  }

  /** Liest einen normalisierten serverseitigen Feldfehler aus der API-Antwort. */
  private readFieldError(error: HttpErrorResponse, field: string): string | null {
    const fields = error.error?.fields as Record<string, { message?: string }[]> | undefined;
    return fields?.[field]?.[0]?.message ?? null;
  }
}
