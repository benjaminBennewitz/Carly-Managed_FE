// src/app/core/layout/app-shell/app-shell.component.ts

import { ChangeDetectionStrategy, Component, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AppSettingsService } from '../../settings/app-settings.service';
import { ScreenMagnifierComponent } from '../../../shared/ui/screen-magnifier/screen-magnifier.component';
import { WorkspaceToolsComponent } from '../../../shared/ui/workspace-tools/workspace-tools.component';
import { PrimaryNavigationComponent } from '../primary-navigation/primary-navigation.component';
import { TopbarComponent } from '../topbar/topbar.component';

const DESKTOP_SIDEBAR_QUERY = '(min-width: 56.001rem)';

@Component({
  selector: 'cm-app-shell',
  imports: [
    PrimaryNavigationComponent,
    RouterOutlet,
    ScreenMagnifierComponent,
    TopbarComponent,
    WorkspaceToolsComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  protected readonly settingsService: AppSettingsService;
  protected readonly sidebarOpen = signal(window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches);
  protected readonly isBoardRoute = signal(false);
  protected readonly isProjectSettingsRoute = signal(false);
  protected readonly isInboxRoute = signal(false);

  constructor(destroyRef: DestroyRef, router: Router, settingsService: AppSettingsService) {
    this.settingsService = settingsService;
    const desktopMediaQuery = window.matchMedia(DESKTOP_SIDEBAR_QUERY);
    const updateSidebarForViewport = (event: MediaQueryListEvent): void => {
      this.sidebarOpen.set(event.matches);
    };
    const updateRouteMode = (url: string): void => {
      this.isBoardRoute.set(url === '/board' || /^\/projects\/[^/]+\/board(?:[?#].*)?$/.test(url));
      this.isProjectSettingsRoute.set(/^\/projects\/[^/]+\/settings(?:[?#].*)?$/.test(url));
      this.isInboxRoute.set(/^\/inbox(?:[?#].*)?$/.test(url));
    };

    updateRouteMode(router.url);
    router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((event) => {
        updateRouteMode(event.urlAfterRedirects);
      });

    desktopMediaQuery.addEventListener('change', updateSidebarForViewport);

    destroyRef.onDestroy(() => {
      desktopMediaQuery.removeEventListener('change', updateSidebarForViewport);
    });
  }

  /**
   * Öffnet oder schließt die primäre Navigation vollständig.
   */
  toggleSidebar(): void {
    this.sidebarOpen.update((isOpen) => !isOpen);
  }

  /**
   * Schließt die primäre Navigation.
   */
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
