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
  readonly allowEmpty = input(true);
  readonly placeholder = input('Person auswählen');
  readonly valueChange = output<string>();

  private readonly menuId = `member-select-${++memberSelectInstanceId}`;

  protected readonly open = computed(
    () => this.dropdownCoordinator.activeId() === this.menuId,
  );
  protected readonly selectedMember = computed(() =>
    this.members().find((member) => member.id === this.value()) ?? null,
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
    if (!this.disabled()) {
      this.dropdownCoordinator.toggle(this.menuId);
    }
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
