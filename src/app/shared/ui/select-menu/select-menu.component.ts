// src/app/shared/ui/select-menu/select-menu.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  input,
  output,
  signal,
} from '@angular/core';

export interface SelectMenuOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
}

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

  protected readonly open = signal(false);
  protected readonly selectedOption = computed(() =>
    this.options().find((option) => option.value === this.value()) ?? null,
  );

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    destroyRef: DestroyRef,
  ) {
    const handlePointerDown = (event: PointerEvent): void => {
      if (!this.elementRef.nativeElement.contains(event.target as Node)) {
        this.open.set(false);
      }
    };
    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        this.open.set(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeydown);

    destroyRef.onDestroy(() => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeydown);
    });
  }

  /** Öffnet oder schließt die Optionsliste. */
  toggle(): void {
    if (!this.disabled()) {
      this.open.update((isOpen) => !isOpen);
    }
  }

  /** Übernimmt eine Auswahl und schließt die Optionsliste. */
  selectOption(option: SelectMenuOption): void {
    if (this.disabled()) {
      return;
    }

    this.valueChange.emit(option.value);
    this.open.set(false);
  }
}
