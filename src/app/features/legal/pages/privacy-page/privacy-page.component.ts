// src/app/features/legal/pages/privacy-page/privacy-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { LEGAL_PROVIDER } from '../../../../core/legal/legal.config';
import { LegalLayoutComponent } from '../../../../core/layout/legal-layout/legal-layout.component';

@Component({
  selector: 'cm-privacy-page',
  imports: [LegalLayoutComponent],
  templateUrl: './privacy-page.component.html',
  styleUrl: './privacy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent {
  protected readonly provider = LEGAL_PROVIDER;
  protected readonly canScrollLeft = signal(false);

  /**
   * Überträgt vertikale Mausradbewegungen auf den horizontalen Dokumentbereich.
   * Vertikal scrollbare Karten behalten dabei ihr normales Scrollverhalten.
   */
  protected scrollHorizontally(event: WheelEvent, track: HTMLDivElement): void {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest<HTMLElement>('.privacy-deck__card');

    if (card && this.canScrollVertically(card, event.deltaY)) {
      return;
    }

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    track.scrollLeft += event.deltaY;
  }

  /**
   * Aktualisiert den Zustand des Zurück-zum-Anfang-Buttons.
   */
  protected updateScrollState(track: HTMLDivElement): void {
    this.canScrollLeft.set(track.scrollLeft > 24);
  }

  /**
   * Scrollt das horizontale Datenschutzdeck zurück an den Anfang.
   */
  protected scrollToStart(track: HTMLDivElement): void {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    track.scrollTo({
      left: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    track.focus({ preventScroll: true });
  }

  /**
   * Prüft, ob eine Karte die aktuelle Mausradbewegung vertikal aufnehmen kann.
   */
  private canScrollVertically(element: HTMLElement, deltaY: number): boolean {
    const hasOverflow = element.scrollHeight > element.clientHeight + 1;

    if (!hasOverflow) {
      return false;
    }

    if (deltaY < 0) {
      return element.scrollTop > 0;
    }

    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }
}
