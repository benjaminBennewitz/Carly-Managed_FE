// src/app/shared/ui/carly-mascot/carly-mascot.component.ts

import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, HostListener, signal, untracked, viewChild } from '@angular/core';

import { CarlyService } from '../../../core/carly/carly.service';
import { CarlyFaceComponent } from '../carly-face/carly-face.component';

const VIEWPORT_GUTTER_PX = 12;
const DEFAULT_MASCOT_WIDTH_PX = 92;
const DIRECTION_CHANGE_WINDOW_MS = 1_100;
const DIRECTION_CHANGE_THRESHOLD = 2;
const DRAG_DIRECTION_MIN_DELTA_PX = 6;

@Component({
  selector: 'cm-carly-mascot',
  imports: [CarlyFaceComponent],
  templateUrl: './carly-mascot.component.html',
  styleUrl: './carly-mascot.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyMascotComponent {
  protected readonly carlyService: CarlyService;
  protected readonly menuOpen = signal(false);
  protected readonly messageVisible = signal(false);
  protected readonly messageText = signal('');
  protected readonly leftPositionPx = computed(() => {
    const availableWidth = Math.max(
      0,
      this.viewportWidth() - this.mascotWidth() - VIEWPORT_GUTTER_PX * 2,
    );
    return VIEWPORT_GUTTER_PX + this.carlyService.progress().positionX * availableWidth;
  });

  private readonly wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');
  private readonly viewportWidth = signal(window.innerWidth);
  private readonly mascotWidth = signal(DEFAULT_MASCOT_WIDTH_PX);
  private dragging = false;
  private dragOffset = 0;
  private lastDragX: number | null = null;
  private lastDragDirection = 0;
  private directionChanges: number[] = [];
  private autoSleepTimer: number | null = null;
  private messageTimer: number | null = null;

  constructor(carlyService: CarlyService, destroyRef: DestroyRef) {
    this.carlyService = carlyService;

    const resetAutoSleep = (): void => this.scheduleAutoSleep();
    window.addEventListener('pointerdown', resetAutoSleep, { passive: true });
    window.addEventListener('keydown', resetAutoSleep);

    effect(() => {
      const sequence = this.carlyService.messageSequence();
      if (sequence === 0) return;

      untracked(() => {
        const text = this.carlyService.activeMessage();
        if (text) {
          this.showMessage(text, this.carlyService.messageDurationMs());
        }
      });
    });

    effect(() => {
      const autoSleep = this.carlyService.settings().autoSleep;
      const sleeping = this.carlyService.isSleeping();

      untracked(() => {
        if (!autoSleep || sleeping) {
          if (this.autoSleepTimer !== null) {
            window.clearTimeout(this.autoSleepTimer);
            this.autoSleepTimer = null;
          }
          return;
        }

        this.scheduleAutoSleep();
      });
    });

    afterNextRender(() => this.updateMascotWidth());

    destroyRef.onDestroy(() => {
      window.removeEventListener('pointerdown', resetAutoSleep);
      window.removeEventListener('keydown', resetAutoSleep);
      if (this.autoSleepTimer !== null) window.clearTimeout(this.autoSleepTimer);
      if (this.messageTimer !== null) window.clearTimeout(this.messageTimer);
    });
  }

  /** Plant Carlys automatischen Schlaf nach längerer Inaktivität. */
  private scheduleAutoSleep(): void {
    if (this.autoSleepTimer !== null) window.clearTimeout(this.autoSleepTimer);
    if (!this.carlyService.settings().autoSleep || this.carlyService.progress().isSleeping) return;

    this.autoSleepTimer = window.setTimeout(() => this.carlyService.sleep(), 300_000);
  }

  /** Öffnet oder schließt Carlys Schnellaktionen. */
  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  /** Führt die Streichelreaktion aus oder zeigt im Schlaf den vorgesehenen Hinweis. */
  protected pet(): void {
    this.carlyService.pet();
  }

  /** Legt Carly schlafen. */
  protected sleep(): void {
    this.carlyService.sleep();
  }

  /** Weckt Carly auf. */
  protected wake(): void {
    this.carlyService.wake();
  }

  /** Zeigt Carlys Hinweisbox für die übergebene Dauer. */
  private showMessage(message: string, durationMs: number): void {
    if (!this.carlyService.settings().messagesEnabled && message !== 'Streicheln hat keinen Effekt') {
      return;
    }

    if (this.messageTimer !== null) window.clearTimeout(this.messageTimer);
    this.messageText.set(message);
    this.messageVisible.set(true);
    this.messageTimer = window.setTimeout(() => {
      this.messageVisible.set(false);
      this.messageTimer = null;
    }, Math.max(1_400, durationMs));
  }

  /** Beginnt das horizontale Verschieben. */
  protected startDrag(event: PointerEvent): void {
    const element = this.wrapper()?.nativeElement;
    if (!element) return;

    event.preventDefault();
    this.updateMascotWidth();
    this.dragging = true;
    this.dragOffset = event.clientX - element.getBoundingClientRect().left;
    this.lastDragX = event.clientX;
    const now = performance.now();
    this.directionChanges = this.directionChanges.filter(
      (timestamp) => now - timestamp <= DIRECTION_CHANGE_WINDOW_MS,
    );
    element.setPointerCapture(event.pointerId);
  }

  /** Verschiebt Carly lokal, ausschließlich horizontal, und erkennt schnelle Richtungswechsel. */
  @HostListener('window:pointermove', ['$event'])
  protected move(event: PointerEvent): void {
    if (!this.dragging) return;

    this.detectDirectionChange(event.clientX);

    const availableWidth = Math.max(
      1,
      this.viewportWidth() - this.mascotWidth() - VIEWPORT_GUTTER_PX * 2,
    );
    const left = Math.max(
      VIEWPORT_GUTTER_PX,
      Math.min(VIEWPORT_GUTTER_PX + availableWidth, event.clientX - this.dragOffset),
    );
    this.carlyService.previewPositionX((left - VIEWPORT_GUTTER_PX) / availableWidth);
  }

  /** Beendet das Verschieben und speichert die Position genau einmal. */
  @HostListener('window:pointerup')
  protected stopDrag(): void {
    if (!this.dragging) return;

    this.dragging = false;
    this.lastDragX = null;
    this.carlyService.persistPositionX();
  }

  /** Hält die Position nach einer Größenänderung im sichtbaren Bereich. */
  @HostListener('window:resize')
  protected updateViewportBounds(): void {
    this.viewportWidth.set(window.innerWidth);
    this.updateMascotWidth();
  }

  /** Erkennt zwei schnelle Richtungswechsel und löst Carlys Schwindelreaktion aus. */
  private detectDirectionChange(clientX: number): void {
    if (this.lastDragX === null) {
      this.lastDragX = clientX;
      return;
    }

    const delta = clientX - this.lastDragX;
    if (Math.abs(delta) < DRAG_DIRECTION_MIN_DELTA_PX) return;

    const direction = delta > 0 ? 1 : -1;
    const now = performance.now();

    if (this.lastDragDirection !== 0 && direction !== this.lastDragDirection) {
      this.directionChanges = this.directionChanges.filter(
        (timestamp) => now - timestamp <= DIRECTION_CHANGE_WINDOW_MS,
      );
      this.directionChanges.push(now);

      if (this.directionChanges.length >= DIRECTION_CHANGE_THRESHOLD) {
        this.carlyService.triggerDizzy();
        this.directionChanges = [];
      }
    }

    this.lastDragDirection = direction;
    this.lastDragX = clientX;
  }

  /** Ermittelt Carlys tatsächlich gerenderte Breite. */
  private updateMascotWidth(): void {
    this.mascotWidth.set(this.wrapper()?.nativeElement.offsetWidth ?? DEFAULT_MASCOT_WIDTH_PX);
  }
}
