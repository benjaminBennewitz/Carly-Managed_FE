// src/app/shared/ui/select-menu/select-menu.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  input,
  output,
} from '@angular/core';

import { DropdownCoordinatorService } from '../dropdown/dropdown-coordinator.service';

export interface SelectMenuOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
}

let selectMenuInstanceId = 0;

@Component({
  selector: 'cm-select-menu',
  templateUrl: './select-menu.component.html',
  styleUrl: './select-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectMenuComponent {
  readonly label = input.required<string>();
  readonly value = input<string | null>(null);
  readonly options = input.required<readonly SelectMenuOption[]>();
  readonly placeholder = input('Auswählen');
  readonly disabled = input(false);
  readonly compact = input(false);
  readonly active = input(false);
  readonly valueChange = output<string>();

  private readonly menuId = `select-menu-${++selectMenuInstanceId}`;

  protected readonly open = computed(() => this.dropdownCoordinator.activeId() === this.menuId);
  protected readonly selectedOption = computed(
    () => this.options().find((option) => option.value === this.value()) ?? null,
  );

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly dropdownCoordinator: DropdownCoordinatorService,
    destroyRef: DestroyRef,
  ) {
    const handlePointerDown = (event: PointerEvent): void => {
      if (!this.elementRef.nativeElement.contains(event.target as Node)) {
        this.dropdownCoordinator.close(this.menuId);
      }
    };
    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        this.dropdownCoordinator.close(this.menuId);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeydown);

    destroyRef.onDestroy(() => {
      this.dropdownCoordinator.close(this.menuId);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeydown);
    });
  }

  /** Öffnet oder schließt die Optionsliste. */
  toggle(): void {
    if (this.disabled()) {
      return;
    }

    const willOpen = !this.open();
    this.dropdownCoordinator.toggle(this.menuId);

    if (willOpen) {
      this.revealOpenMenu();
    }
  }

  /**
   * Scrollt den nächsten begrenzten Container nur so weit, dass das geöffnete
   * Menü vollständig erreichbar bleibt.
   */
  private revealOpenMenu(): void {
    window.requestAnimationFrame(() => {
      const host = this.elementRef.nativeElement;
      const menu = host.querySelector<HTMLElement>('.ui-select__menu');
      const scrollContainer = this.findScrollContainer(host);

      if (!menu || !scrollContainer) {
        return;
      }

      const menuRect = menu.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const safeInset = 12;
      const bottomOverflow = menuRect.bottom - (containerRect.bottom - safeInset);
      const topOverflow = containerRect.top + safeInset - menuRect.top;

      if (bottomOverflow > 0) {
        scrollContainer.scrollBy({
          top: bottomOverflow + safeInset,
          behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
        });
        return;
      }

      if (topOverflow > 0) {
        scrollContainer.scrollBy({
          top: -(topOverflow + safeInset),
          behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
        });
      }
    });
  }

  /** Ermittelt den nächsten tatsächlich scrollbaren Vorfahren. */
  private findScrollContainer(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;

    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const canScroll =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        parent.scrollHeight > parent.clientHeight;

      if (canScroll) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }

  /** Prüft die systemweite Einstellung für reduzierte Bewegung. */
  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Übernimmt eine Auswahl und schließt die Optionsliste. */
  selectOption(option: SelectMenuOption): void {
    if (this.disabled()) {
      return;
    }

    this.valueChange.emit(option.value);
    this.dropdownCoordinator.close(this.menuId);
  }
}
