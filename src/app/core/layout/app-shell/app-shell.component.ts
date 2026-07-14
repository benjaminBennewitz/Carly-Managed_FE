// src/app/core/layout/app-shell/app-shell.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { PrimaryNavigationComponent } from '../primary-navigation/primary-navigation.component';
import { TopbarComponent } from '../topbar/topbar.component';

const DESKTOP_SIDEBAR_QUERY = '(min-width: 56.001rem)';

@Component({
  selector: 'cm-app-shell',
  imports: [PrimaryNavigationComponent, RouterOutlet, TopbarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  protected readonly sidebarOpen = signal(
    window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches,
  );

  constructor(destroyRef: DestroyRef) {
    const desktopMediaQuery = window.matchMedia(DESKTOP_SIDEBAR_QUERY);
    const updateSidebarForViewport = (event: MediaQueryListEvent): void => {
      this.sidebarOpen.set(event.matches);
    };

    desktopMediaQuery.addEventListener('change', updateSidebarForViewport);

    destroyRef.onDestroy(() => {
      desktopMediaQuery.removeEventListener(
        'change',
        updateSidebarForViewport,
      );
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
