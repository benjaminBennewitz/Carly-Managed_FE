// src/app/shared/ui/carly-mascot/carly-mascot.component.ts

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, signal, viewChild } from '@angular/core';

import { CarlyService } from '../../../core/carly/carly.service';
import { CarlyFaceComponent } from '../carly-face/carly-face.component';

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
  private readonly wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');
  private dragging = false;
  private dragOffset = 0;
  private autoSleepTimer: number | null = null;
  private messageTimer: number | null = null;

  constructor(carlyService: CarlyService, destroyRef: DestroyRef) {
    this.carlyService = carlyService;
    const resetAutoSleep = (): void => this.scheduleAutoSleep();
    window.addEventListener('pointerdown', resetAutoSleep, { passive: true });
    window.addEventListener('keydown', resetAutoSleep);
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
  protected toggleMenu(): void { this.menuOpen.update((open) => !open); }

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
    this.dragging = true;
    this.dragOffset = event.clientX - element.getBoundingClientRect().left;
    element.setPointerCapture(event.pointerId);
  }

  /** Verschiebt Carly ausschließlich horizontal. */
  @HostListener('window:pointermove', ['$event'])
  protected move(event: PointerEvent): void {
    if (!this.dragging) return;
    const width = this.wrapper()?.nativeElement.offsetWidth ?? 120;
    this.carlyService.setPositionX(Math.min(window.innerWidth - width - 12, event.clientX - this.dragOffset));
  }

  /** Beendet das Verschieben und speichert die Position. */
  @HostListener('window:pointerup')
  protected stopDrag(): void { this.dragging = false; }
}
