// src/app/core/layout/topbar/topbar.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { ThemeService } from '../../theme/theme.service';
import { GlobalSearchComponent } from './global-search/global-search.component';
import { QuickActionsComponent } from './quick-actions/quick-actions.component';

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

@Component({
  selector: 'cm-topbar',
  imports: [GlobalSearchComponent, QuickActionsComponent, RouterLink, RouterLinkActive],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
  readonly sidebarOpen = input.required<boolean>();
  readonly sidebarToggle = output<void>();

  protected readonly themeService: ThemeService;
  protected readonly currentDate = signal(new Date());
  protected readonly weekday = computed(() => WEEKDAY_FORMATTER.format(this.currentDate()));
  protected readonly date = computed(() => DATE_FORMATTER.format(this.currentDate()));

  constructor(themeService: ThemeService, destroyRef: DestroyRef) {
    this.themeService = themeService;

    const timerId = window.setInterval(() => {
      this.currentDate.set(new Date());
    }, 60_000);

    destroyRef.onDestroy(() => {
      window.clearInterval(timerId);
    });
  }

  /**
   * Fordert das Öffnen oder Schließen der primären Navigation an.
   */
  toggleSidebar(): void {
    this.sidebarToggle.emit();
  }
}
