// src/app/shared/ui/screen-magnifier/screen-magnifier.component.ts

import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, ViewChild } from '@angular/core';

const MAGNIFICATION = 1.8;
const REFRESH_INTERVAL_MS = 500;

@Component({
  selector: 'cm-screen-magnifier',
  templateUrl: './screen-magnifier.component.html',
  styleUrl: './screen-magnifier.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenMagnifierComponent implements AfterViewInit {
  @ViewChild('lens', { static: true }) private lensRef!: ElementRef<HTMLElement>;
  @ViewChild('content', { static: true }) private contentRef!: ElementRef<HTMLElement>;

  private readonly destroyRef = inject(DestroyRef);
  private refreshTimer: number | null = null;
  private frameId: number | null = null;
  private pointerX = window.innerWidth / 2;
  private pointerY = window.innerHeight / 2;

  /** Initialisiert die partielle Live-Vergrößerung und ihre Ereignislistener. */
  ngAfterViewInit(): void {
    this.refreshSnapshot();
    this.updateLensPosition();

    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('scroll', this.handleViewportChange, { passive: true, capture: true });
    this.refreshTimer = window.setInterval(() => this.refreshSnapshot(), REFRESH_INTERVAL_MS);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('pointermove', this.handlePointerMove);
      window.removeEventListener('resize', this.handleResize);
      window.removeEventListener('scroll', this.handleViewportChange, true);
      if (this.refreshTimer !== null) {
        window.clearInterval(this.refreshTimer);
      }
      if (this.frameId !== null) {
        window.cancelAnimationFrame(this.frameId);
      }
    });
  }

  /** Übernimmt die aktuelle Zeigerposition und aktualisiert die Lupe flüssig. */
  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.scheduleLensUpdate();
  };

  /** Aktualisiert Snapshot und Position nach einer Größenänderung. */
  private readonly handleResize = (): void => {
    this.refreshSnapshot();
    this.scheduleLensUpdate();
  };

  /** Hält den vergrößerten Ausschnitt bei Scrollbewegungen aktuell. */
  private readonly handleViewportChange = (): void => {
    this.refreshSnapshot();
    this.scheduleLensUpdate();
  };

  /** Bündelt schnelle Positionsänderungen in einem Animationsframe. */
  private scheduleLensUpdate(): void {
    if (this.frameId !== null) {
      return;
    }

    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null;
      this.updateLensPosition();
    });
  }

  /** Erstellt eine nicht-interaktive Kopie der sichtbaren App für die Lupe. */
  private refreshSnapshot(): void {
    const source = document.querySelector<HTMLElement>('.app-shell');
    const content = this.contentRef.nativeElement;
    if (!source || !content) {
      return;
    }

    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('cm-screen-magnifier, [data-screen-magnifier]').forEach((element) => {
      element.remove();
    });
    clone.removeAttribute('aria-live');
    clone.setAttribute('aria-hidden', 'true');
    clone.style.width = `${window.innerWidth}px`;
    clone.style.minHeight = `${window.innerHeight}px`;

    content.replaceChildren(clone);
    this.updateLensPosition();
  }

  /** Positioniert Lupe und vergrößerten Inhalt relativ zum aktuellen Zeiger. */
  private updateLensPosition(): void {
    const lens = this.lensRef.nativeElement;
    const content = this.contentRef.nativeElement;
    const lensRect = lens.getBoundingClientRect();
    const offset = 20;
    const viewportPadding = 12;

    let left = this.pointerX + offset;
    let top = this.pointerY + offset;

    if (left + lensRect.width > window.innerWidth - viewportPadding) {
      left = this.pointerX - lensRect.width - offset;
    }
    if (top + lensRect.height > window.innerHeight - viewportPadding) {
      top = this.pointerY - lensRect.height - offset;
    }

    left = Math.max(viewportPadding, left);
    top = Math.max(viewportPadding, top);
    lens.style.transform = `translate3d(${left}px, ${top}px, 0)`;

    const translateX = lensRect.width / 2 - this.pointerX * MAGNIFICATION;
    const translateY = lensRect.height / 2 - this.pointerY * MAGNIFICATION;
    content.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${MAGNIFICATION})`;
  }
}
