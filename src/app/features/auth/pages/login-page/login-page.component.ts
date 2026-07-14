// src/app/features/auth/pages/login-page/login-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthPreviewService } from '../../../../core/auth/services/auth-preview.service';
import { CheckboxFieldComponent } from '../../../../shared/ui/forms/checkbox-field/checkbox-field.component';
import { TextFieldComponent } from '../../../../shared/ui/forms/text-field/text-field.component';

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
  rememberMe: FormControl<boolean>;
}

@Component({
  selector: 'cm-login-page',
  imports: [CheckboxFieldComponent, ReactiveFormsModule, RouterLink, TextFieldComponent],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  protected readonly form = new FormGroup<LoginForm>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128)],
    }),
    rememberMe: new FormControl(false, { nonNullable: true }),
  });

  protected readonly submitted = signal(false);
  protected readonly pending = signal(false);
  protected readonly formError = signal('');

  constructor(
    private readonly authPreviewService: AuthPreviewService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  /**
   * Validiert das Formular und startet die lokale Vorschau-Sitzung.
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
      .login({
        ...rawValue,
        email: rawValue.email.trim().toLocaleLowerCase('de-DE'),
      })
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          const redirect = this.route.snapshot.queryParamMap.get('redirect');
          const safeRedirect =
            redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard';

          void this.router.navigateByUrl(safeRedirect);
        },
        error: () => {
          this.formError.set(
            'Die Anmeldung konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut.',
          );
        },
      });
  }
}
