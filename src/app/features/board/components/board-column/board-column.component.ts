// src/app/features/board/components/board-column/board-column.component.ts

import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  WorkspaceColumn,
  WorkspaceColumnSortMode,
  WorkspaceTask,
} from '../../../../core/workspace/workspace.models';
import { DropdownCoordinatorService } from '../../../../shared/ui/dropdown/dropdown-coordinator.service';
import { SelectMenuOption } from '../../../../shared/ui/select-menu/select-menu.component';
import { WorkspaceTaskCardComponent } from '../../../../shared/ui/workspace-task-card/workspace-task-card.component';

@Component({
  selector: 'cm-board-column',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
    CdkDropList,
    WorkspaceTaskCardComponent,
  ],
  templateUrl: './board-column.component.html',
  styleUrl: './board-column.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardColumnComponent {
  readonly column = input.required<WorkspaceColumn>();
  readonly connectedDropListIds = input.required<string[]>();
  readonly colorOptions = input.required<readonly SelectMenuOption[]>();
  readonly showProjectContext = input(false);
  readonly readOnly = input(false);

  readonly taskDrop = output<CdkDragDrop<WorkspaceTask[]>>();
  readonly taskOpen = output<WorkspaceTask>();
  readonly taskCompleteToggle = output<WorkspaceTask>();
  readonly taskAdd = output<string>();
  readonly titleChange = output<{ columnId: string; title: string }>();
  readonly deleteRequested = output<string>();
  readonly colorChangeRequested = output<{
    columnId: string;
    color: string;
  }>();
  readonly sortRequested = output<{
    columnId: string;
    mode: WorkspaceColumnSortMode;
  }>();

  protected readonly isEditingTitle = signal(false);
  protected readonly draftTitle = signal('');
  protected readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  protected readonly toolbarMenuId = computed(() => `column-toolbar-${this.column().id}`);
  protected readonly colorMenuId = computed(() => `column-color-${this.column().id}`);
  protected readonly toolbarPinned = computed(() => {
    const activeId = this.dropdownCoordinator.activeId();
    return activeId === this.toolbarMenuId() || activeId === this.colorMenuId();
  });
  protected readonly colorPickerOpen = computed(
    () => this.dropdownCoordinator.activeId() === this.colorMenuId(),
  );

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly dropdownCoordinator: DropdownCoordinatorService,
    destroyRef: DestroyRef,
  ) {
    const handlePointerDown = (event: PointerEvent): void => {
      if (!this.elementRef.nativeElement.contains(event.target as Node) && this.isOwnMenuActive()) {
        this.dropdownCoordinator.closeAll();
      }
    };
    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && this.isOwnMenuActive()) {
        this.dropdownCoordinator.closeAll();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeydown);

    destroyRef.onDestroy(() => {
      if (this.isOwnMenuActive()) {
        this.dropdownCoordinator.closeAll();
      }
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeydown);
    });
  }

  /** Öffnet die Inline-Bearbeitung des Spaltentitels. */
  startTitleEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.dropdownCoordinator.closeAll();
    this.draftTitle.set(this.column().title);
    this.isEditingTitle.set(true);

    queueMicrotask(() => {
      this.titleInput()?.nativeElement.focus();
      this.titleInput()?.nativeElement.select();
    });
  }

  /** Übernimmt einen gültigen Spaltentitel. */
  saveTitle(): void {
    const title = this.draftTitle().trim();
    this.isEditingTitle.set(false);

    if (title && title !== this.column().title) {
      this.titleChange.emit({ columnId: this.column().id, title });
    }
  }

  /** Reagiert auf Tastaturaktionen im Spaltentitel. */
  handleTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveTitle();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.isEditingTitle.set(false);
    }
  }

  /** Fixiert oder schließt die ausfahrbare Spaltenwerkzeugleiste. */
  toggleActions(event: MouseEvent): void {
    event.stopPropagation();

    if (this.toolbarPinned()) {
      this.dropdownCoordinator.closeAll();
      return;
    }

    this.dropdownCoordinator.open(this.toolbarMenuId());
  }

  /** Öffnet oder schließt die eigene Farbauswahl. */
  toggleColorPicker(event: MouseEvent): void {
    event.stopPropagation();

    if (this.colorPickerOpen()) {
      this.dropdownCoordinator.closeAll();
      return;
    }

    this.dropdownCoordinator.open(this.colorMenuId());
  }

  /** Leitet einen Task-Drop an die Boardseite weiter. */
  handleTaskDrop(event: CdkDragDrop<WorkspaceTask[]>): void {
    this.taskDrop.emit(event);
  }

  /** Übernimmt eine ausgewählte Spaltenfarbe. */
  selectColor(event: MouseEvent, color: string): void {
    event.stopPropagation();
    this.colorChangeRequested.emit({
      columnId: this.column().id,
      color,
    });
    this.dropdownCoordinator.closeAll();
  }

  /** Aktiviert eine Sortierung oder setzt sie bei erneutem Klick zurück. */
  toggleSort(event: MouseEvent, mode: Exclude<WorkspaceColumnSortMode, null>): void {
    event.stopPropagation();
    const nextMode = this.column().sortMode === mode ? null : mode;
    this.sortRequested.emit({ columnId: this.column().id, mode: nextMode });
    this.dropdownCoordinator.open(this.toolbarMenuId());
  }

  /** Fordert das Löschen der aktuellen Spalte an. */
  requestDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.dropdownCoordinator.closeAll();
    this.deleteRequested.emit(this.column().id);
  }

  /** Prüft, ob ein Menü der aktuellen Spalte aktiv ist. */
  private isOwnMenuActive(): boolean {
    const activeId = this.dropdownCoordinator.activeId();
    return activeId === this.toolbarMenuId() || activeId === this.colorMenuId();
  }
}
