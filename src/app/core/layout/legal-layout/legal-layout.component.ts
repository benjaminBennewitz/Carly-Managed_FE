// src/app/core/layout/legal-layout/legal-layout.component.ts

import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

type LegalTransitionDirection = 'forward' | 'backward';

@Component({
  selector: 'cm-legal-layout',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './legal-layout.component.html',
  styleUrl: './legal-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalLayoutComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /**
   * Markiert die Richtung für den folgenden nativen Seitenübergang.
   */
  protected prepareTransition(direction: LegalTransitionDirection): void {
    document.documentElement.dataset['legalTransitionDirection'] = direction;
  }

  /**
   * Kehrt zur vorherigen App-Seite zurück und nutzt die Anmeldung als sicheren Fallback.
   */
  protected goBack(): void {
    this.prepareTransition('backward');

    if (globalThis.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigate(['/auth/login']);
  }
}
