// src/app/core/layout/primary-navigation/primary-navigation.component.ts

import { ChangeDetectionStrategy, Component, signal, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../auth/services/auth.service';
import { SessionService } from '../../auth/services/session.service';
import { ConnectivityService } from '../../system/connectivity.service';
import { WorkspaceService } from '../../workspace/workspace.service';

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
    { label: 'Board', route: '/board', icon: 'view_kanban' },
    { label: 'Mitglieder', route: '/members', icon: 'group' },
    { label: 'Inbox', route: '/inbox', icon: 'inbox' },
    { label: 'Pool', route: '/pool', icon: 'inventory_2' },
    { label: 'Archiv', route: '/archive', icon: 'archive' },
  ];

  protected readonly projectsOpen = signal(true);
  protected readonly sessionService: SessionService;
  protected readonly connectivityService: ConnectivityService;
  protected readonly workspaceService: WorkspaceService;

  constructor(
    sessionService: SessionService,
    connectivityService: ConnectivityService,
    workspaceService: WorkspaceService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.sessionService = sessionService;
    this.connectivityService = connectivityService;
    this.workspaceService = workspaceService;
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
   * Öffnet oder schließt die Liste angepinnter Projekte.
   */
  toggleProjects(): void {
    this.projectsOpen.update((isOpen) => !isOpen);
  }

  /**
   * Beendet die serverseitige Sitzung und wechselt zurück zum Login.
   */
  logout(): void {
    this.authService.logout().subscribe({
      complete: () => {
        this.closeRequested.emit();
        void this.router.navigate(['/auth/login']);
      },
      error: () => {
        this.closeRequested.emit();
        void this.router.navigate(['/auth/login']);
      },
    });
  }
}
