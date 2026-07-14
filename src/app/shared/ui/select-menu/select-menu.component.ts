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

  protected readonly open = computed(
    () => this.dropdownCoordinator.activeId() === this.menuId,
  );
  protected readonly selectedOption = computed(() =>
    this.options().find((option) => option.value === this.value()) ?? null,
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
    if (!this.disabled()) {
      this.dropdownCoordinator.toggle(this.menuId);
    }
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
