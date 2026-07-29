// src/app/core/layout/auth-layout/auth-layout.component.ts

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { ThemeService } from '../../theme/theme.service';

@Component({
  selector: 'cm-auth-layout',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  protected readonly themeService = inject(ThemeService);
}
