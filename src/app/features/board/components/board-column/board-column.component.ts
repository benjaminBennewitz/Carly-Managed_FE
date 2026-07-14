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
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '../../../../shared/ui/select-menu/select-menu.component';
import { WorkspaceTaskCardComponent } from '../../../../shared/ui/workspace-task-card/workspace-task-card.component';

@Component({
  selector: 'cm-board-column',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
    CdkDropList,
    SelectMenuComponent,
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
  readonly sortOptions = input.required<readonly SelectMenuOption[]>();
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
  protected readonly actionMenuOpen = signal(false);
  protected readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  /** Öffnet die Inline-Bearbeitung des Spaltentitels. */
  startTitleEdit(event: MouseEvent): void {
    event.stopPropagation();
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

  /** Öffnet oder schließt das Aktionsmenü. */
  toggleActions(event: MouseEvent): void {
    event.stopPropagation();
    this.actionMenuOpen.update((open) => !open);
  }

  /** Leitet einen Task-Drop an die Boardseite weiter. */
  handleTaskDrop(event: CdkDragDrop<WorkspaceTask[]>): void {
    this.taskDrop.emit(event);
  }

  /** Übernimmt die ausgewählte Spaltenfarbe. */
  changeColor(color: string): void {
    this.colorChangeRequested.emit({
      columnId: this.column().id,
      color,
    });
  }

  /** Übernimmt die ausgewählte Sortierung. */
  changeSort(value: string): void {
    const mode: WorkspaceColumnSortMode =
      value === 'title' || value === 'date' ? value : null;
    this.sortRequested.emit({ columnId: this.column().id, mode });
  }
}
