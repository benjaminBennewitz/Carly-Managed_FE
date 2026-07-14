// src/app/core/layout/primary-navigation/primary-navigation.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthPreviewService } from '../../auth/services/auth-preview.service';
import { SessionService } from '../../auth/services/session.service';

interface NavigationItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'cm-primary-navigation',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './primary-navigation.component.html',
  styleUrl: './primary-navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryNavigationComponent {
  protected readonly navigation: NavigationItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Board', route: '/board', icon: 'board' },
    { label: 'Inbox', route: '/inbox', icon: 'inbox' },
    { label: 'Pool', route: '/pool', icon: 'pool' },
    { label: 'Carly', route: '/carly', icon: 'carly' },
    { label: 'Einstellungen', route: '/settings', icon: 'settings' },
  ];

  protected readonly sessionService: SessionService;

  constructor(
    sessionService: SessionService,
    private readonly authPreviewService: AuthPreviewService,
    private readonly router: Router,
  ) {
    this.sessionService = sessionService;
  }

  /**
   * Beendet die lokale Vorschau-Sitzung und wechselt zurück zum Login.
   */
  logout(): void {
    this.authPreviewService.logout();
    void this.router.navigate(['/auth/login']);
  }
}
