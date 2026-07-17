// src/app/shared/ui/carly-mascot/carly-mascot.component.ts

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  signal,
  viewChild,
} from '@angular/core';

import { CarlyService } from '../../../core/carly/carly.service';
import { CarlyFaceComponent } from '../carly-face/carly-face.component';

const VIEWPORT_GUTTER_PX = 12;
const DEFAULT_MASCOT_WIDTH_PX = 90;

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
  protected readonly petted = signal(false);
  protected readonly messageVisible = signal(false);
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
  private autoSleepTimer: number | null = null;
  private messageTimer: number | null = null;

  constructor(carlyService: CarlyService, destroyRef: DestroyRef) {
    this.carlyService = carlyService;
    const resetAutoSleep = (): void => this.scheduleAutoSleep();
    window.addEventListener('pointerdown', resetAutoSleep, { passive: true });
    window.addEventListener('keydown', resetAutoSleep);
    afterNextRender(() => this.updateMascotWidth());
    this.scheduleAutoSleep();
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

  /** Führt die Streichelreaktion aus. */
  protected pet(): void {
    this.carlyService.pet();
    this.petted.set(true);
    this.showMessage();
    window.setTimeout(() => this.petted.set(false), 1_800);
  }

  /** Legt Carly schlafen und zeigt die Reaktion kurzzeitig an. */
  protected sleep(): void {
    this.carlyService.sleep();
    this.showMessage();
  }

  /** Weckt Carly auf und zeigt die Reaktion kurzzeitig an. */
  protected wake(): void {
    this.carlyService.wake();
    this.showMessage();
  }

  /** Zeigt Carlys Sprachbox nur zeitlich begrenzt an. */
  private showMessage(): void {
    if (!this.carlyService.settings().messagesEnabled) return;
    if (this.messageTimer !== null) window.clearTimeout(this.messageTimer);
    this.messageVisible.set(true);
    this.messageTimer = window.setTimeout(() => {
      this.messageVisible.set(false);
      this.messageTimer = null;
    }, 4_500);
  }

  /** Beginnt das horizontale Verschieben. */
  protected startDrag(event: PointerEvent): void {
    const element = this.wrapper()?.nativeElement;
    if (!element) return;
    event.preventDefault();
    this.updateMascotWidth();
    this.dragging = true;
    this.dragOffset = event.clientX - element.getBoundingClientRect().left;
    element.setPointerCapture(event.pointerId);
  }

  /** Verschiebt Carly lokal und ausschließlich horizontal. */
  @HostListener('window:pointermove', ['$event'])
  protected move(event: PointerEvent): void {
    if (!this.dragging) return;
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
    this.carlyService.persistPositionX();
  }

  /** Hält die Position nach einer Größenänderung im sichtbaren Bereich. */
  @HostListener('window:resize')
  protected updateViewportBounds(): void {
    this.viewportWidth.set(window.innerWidth);
    this.updateMascotWidth();
  }

  /** Ermittelt Carlys tatsächlich gerenderte Breite. */
  private updateMascotWidth(): void {
    this.mascotWidth.set(this.wrapper()?.nativeElement.offsetWidth ?? DEFAULT_MASCOT_WIDTH_PX);
  }
}
