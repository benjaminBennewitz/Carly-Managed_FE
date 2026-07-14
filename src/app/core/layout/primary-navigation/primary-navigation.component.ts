// src/app/core/layout/primary-navigation/primary-navigation.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthPreviewService } from '../../auth/services/auth-preview.service';
import { SessionService } from '../../auth/services/session.service';
import { ConnectivityService } from '../../system/connectivity.service';

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
  readonly open = input(true);
  readonly closeRequested = output<void>();

  protected readonly navigation: NavigationItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Projekte', route: '/projects', icon: 'folder_open' },
    { label: 'Board', route: '/board', icon: 'view_kanban' },
    { label: 'Mitglieder', route: '/members', icon: 'group' },
    { label: 'Inbox', route: '/inbox', icon: 'inbox' },
    { label: 'Pool', route: '/pool', icon: 'inventory_2' },
    { label: 'Archiv', route: '/archive', icon: 'archive' },
    { label: 'Carly', route: '/carly', icon: 'pets' },
    { label: 'Einstellungen', route: '/settings', icon: 'settings' },
  ];

  protected readonly sessionService: SessionService;
  protected readonly connectivityService: ConnectivityService;

  constructor(
    sessionService: SessionService,
    connectivityService: ConnectivityService,
    private readonly authPreviewService: AuthPreviewService,
    private readonly router: Router,
  ) {
    this.sessionService = sessionService;
    this.connectivityService = connectivityService;
  }

  /**
   * Schließt die Navigation nach einer Auswahl auf kleinen Viewports.
   */
  handleNavigation(): void {
    if (window.matchMedia('(max-width: 56rem)').matches) {
      this.closeRequested.emit();
    }
  }

  /**
   * Beendet die lokale Vorschau-Sitzung und wechselt zurück zum Login.
   */
  logout(): void {
    this.authPreviewService.logout();
    this.closeRequested.emit();
    void this.router.navigate(['/auth/login']);
  }
}
