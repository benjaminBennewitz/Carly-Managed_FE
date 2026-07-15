// src/app/shared/ui/member-select/member-select.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  input,
  output,
} from '@angular/core';

import { WorkspaceMember } from '../../../core/workspace/workspace.models';
import { DropdownCoordinatorService } from '../dropdown/dropdown-coordinator.service';

let memberSelectInstanceId = 0;

@Component({
  selector: 'cm-member-select',
  templateUrl: './member-select.component.html',
  styleUrl: './member-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberSelectComponent {
  readonly label = input.required<string>();
  readonly value = input<string | null>(null);
  readonly members = input.required<readonly WorkspaceMember[]>();
  readonly disabled = input(false);
  readonly compact = input(false);
  readonly allowEmpty = input(true);
  readonly placeholder = input('Person auswählen');
  readonly valueChange = output<string>();

  private readonly menuId = `member-select-${++memberSelectInstanceId}`;

  protected readonly open = computed(() => this.dropdownCoordinator.activeId() === this.menuId);
  protected readonly selectedMember = computed(
    () => this.members().find((member) => member.id === this.value()) ?? null,
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

  /** Öffnet oder schließt die Personenliste. */
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

  /** Scrollt den nächsten begrenzten Container bis zur sichtbaren Personenliste. */
  private revealOpenMenu(): void {
    window.requestAnimationFrame(() => {
      const host = this.elementRef.nativeElement;
      const menu = host.querySelector<HTMLElement>('.member-select__menu');
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

  /** Übernimmt eine Person oder entfernt die aktuelle Auswahl. */
  selectMember(memberId: string): void {
    if (this.disabled()) {
      return;
    }

    this.valueChange.emit(memberId);
    this.dropdownCoordinator.close(this.menuId);
  }

  /** Liefert den persönlichen Kurznamen einer Person. */
  getFirstName(member: WorkspaceMember): string {
    return member.fullName.trim().split(/\s+/)[0] ?? member.fullName;
  }
}
