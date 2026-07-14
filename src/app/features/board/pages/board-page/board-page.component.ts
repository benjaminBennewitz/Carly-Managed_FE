// src/app/features/board/pages/board-page/board-page.component.ts

import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  canReleaseTaskToPool,
  isOnDemandReadyTask,
} from '../../../../core/workspace/task-rules';
import {
  BoardViewMode,
  WorkspaceColumn,
  WorkspaceTask,
} from '../../../../core/workspace/workspace.models';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { WorkspaceTaskCardComponent } from '../../../../shared/ui/workspace-task-card/workspace-task-card.component';
import {
  BoardColumnComponent,
  ColumnSortMode,
} from '../../components/board-column/board-column.component';

const COLUMN_COLORS = [
  '#7752B3',
  '#D5A646',
  '#4E82A8',
  '#4F9572',
  '#B9546A',
  '#8A8093',
];

@Component({
  selector: 'cm-board-page',
  imports: [
    BoardColumnComponent,
    CdkDrag,
    CdkDropList,
    RouterLink,
    WorkspaceTaskCardComponent,
  ],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPageComponent {
  protected readonly workspaceService: WorkspacePreviewService;

  protected readonly projectId = signal('personal');
  protected readonly columns = signal<WorkspaceColumn[]>([]);
  protected readonly viewMode = signal<BoardViewMode>('board');
  protected readonly selectedTask = signal<WorkspaceTask | null>(null);
  protected readonly projectActionsOpen = signal(false);
  protected readonly activeUtilityPanel = signal<'rules' | 'recurrence' | null>(null);

  protected readonly project = computed(() =>
    this.projectId() === 'personal'
      ? null
      : this.workspaceService.getProject(this.projectId()),
  );
  protected readonly title = computed(() =>
    this.project()?.name ?? 'Mein Board',
  );
  protected readonly subtitle = computed(() =>
    this.project()
      ? ''
      : 'Persönliche Aufgaben und direkt zugewiesene Projektarbeit.',
  );
  protected readonly isReadOnly = computed(() =>
    !!this.project() && this.project()?.status !== 'active',
  );
  protected readonly taskCount = computed(() =>
    this.columns().reduce(
      (count, column) => count + column.tasks.length,
      0,
    ),
  );
  protected readonly dropListIds = computed(() =>
    this.columns().map((column) => column.id),
  );
  protected readonly listRows = computed(() =>
    this.columns().flatMap((column) =>
      column.tasks.map((task) => ({ column, task })),
    ),
  );
  protected readonly scheduleLabel = computed(() => {
    const project = this.project();
    if (!project) {
      return 'Persönlicher Bereich';
    }

    return `${this.formatDate(project.startedAt)} – ${this.formatDate(project.dueAt)}`;
  });

  constructor(
    route: ActivatedRoute,
    workspaceService: WorkspacePreviewService,
  ) {
    this.workspaceService = workspaceService;

    route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const projectId = params.get('projectId') ?? 'personal';
      this.projectId.set(projectId);
      this.columns.set(this.workspaceService.getBoard(projectId));
      this.selectedTask.set(null);
      this.activeUtilityPanel.set(null);

      if (projectId !== 'personal') {
        this.workspaceService.markProjectOpened(projectId);
      }
    });
  }

  /**
   * Wechselt zwischen Kanban- und Listenansicht.
   */
  setViewMode(mode: BoardViewMode): void {
    this.viewMode.set(mode);
  }

  /**
   * Sortiert die Boardspalten horizontal neu.
   */
  dropColumn(event: CdkDragDrop<WorkspaceColumn[]>): void {
    if (this.isReadOnly()) {
      return;
    }
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const nextColumns = this.cloneColumns();
    moveItemInArray(nextColumns, event.previousIndex, event.currentIndex);
    this.persistColumns(nextColumns);
  }

  /**
   * Verschiebt eine Aufgabe innerhalb oder zwischen Spalten.
   */
  dropTask(event: CdkDragDrop<WorkspaceTask[]>): void {
    if (this.isReadOnly()) {
      return;
    }
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }

    this.persistColumns(this.cloneColumns());
  }

  /**
   * Öffnet die kompakte Task-Detailansicht.
   */
  openTask(task: WorkspaceTask): void {
    this.selectedTask.set({ ...task, tags: [...task.tags] });
  }

  /**
   * Schließt die Task-Detailansicht.
   */
  closeTask(): void {
    this.selectedTask.set(null);
  }

  /**
   * Schaltet eine Aufgabe zwischen offen und erledigt um.
   */
  toggleTaskCompleted(task: WorkspaceTask): void {
    if (this.isReadOnly()) {
      return;
    }
    const nextColumns = this.workspaceService.toggleTaskCompleted(
      this.projectId(),
      task.id,
    );
    this.columns.set(nextColumns);
    this.syncSelectedTask(task.id);
  }

  /**
   * Gibt die geöffnete Hauptaufgabe in den Pool frei.
   */
  releaseSelectedTaskToPool(): void {
    if (this.isReadOnly()) {
      return;
    }
    const task = this.selectedTask();
    if (!task || !canReleaseTaskToPool(task)) {
      return;
    }

    const nextColumns = this.workspaceService.moveTaskToPool(
      this.projectId(),
      task.id,
    );
    this.columns.set(nextColumns);
    this.syncSelectedTask(task.id);
  }

  /**
   * Fügt in einer Spalte eine neue Aufgabe ein.
   */
  addTask(columnId: string): void {
    if (this.isReadOnly()) {
      return;
    }
    const nextColumns = this.workspaceService.addTask(
      this.projectId(),
      columnId,
    );
    this.columns.set(nextColumns);
    const createdTask = nextColumns
      .find((column) => column.id === columnId)
      ?.tasks[0];

    if (createdTask) {
      this.openTask(createdTask);
    }
  }

  /**
   * Fügt eine neue leere Boardspalte hinzu.
   */
  addColumn(): void {
    if (this.isReadOnly()) {
      return;
    }
    const nextColumns = [
      ...this.cloneColumns(),
      {
        id: `column-${Date.now()}`,
        title: 'Neue Spalte',
        color: COLUMN_COLORS[this.columns().length % COLUMN_COLORS.length],
        tasks: [],
      },
    ];
    this.persistColumns(nextColumns);
  }

  /**
   * Benennt eine Spalte über den zentralen Vorschauzustand um.
   */
  renameColumn(payload: { columnId: string; title: string }): void {
    if (this.isReadOnly()) {
      return;
    }
    this.columns.set(
      this.workspaceService.renameColumn(
        this.projectId(),
        payload.columnId,
        payload.title,
      ),
    );
  }

  /**
   * Entfernt eine freie Spalte und erhält deren Aufgaben.
   */
  deleteColumn(columnId: string): void {
    if (this.isReadOnly()) {
      return;
    }
    this.columns.set(
      this.workspaceService.deleteColumn(this.projectId(), columnId),
    );
  }

  /**
   * Wechselt zyklisch durch die verfügbaren semantischen Spaltenakzente.
   */
  cycleColumnColor(columnId: string): void {
    if (this.isReadOnly()) {
      return;
    }
    const nextColumns = this.cloneColumns().map((column) => {
      if (column.id !== columnId) {
        return column;
      }

      const currentIndex = COLUMN_COLORS.indexOf(column.color);
      return {
        ...column,
        color: COLUMN_COLORS[(currentIndex + 1) % COLUMN_COLORS.length],
      };
    });
    this.persistColumns(nextColumns);
  }

  /**
   * Sortiert eine Spalte nach Titel oder Fälligkeitsdatum.
   */
  sortColumn(payload: { columnId: string; mode: ColumnSortMode }): void {
    if (this.isReadOnly()) {
      return;
    }
    const nextColumns = this.cloneColumns().map((column) => {
      if (column.id !== payload.columnId) {
        return column;
      }

      const tasks = [...column.tasks].sort((left, right) => {
        if (payload.mode === 'title') {
          return left.title.localeCompare(right.title, 'de');
        }

        return (left.dueDate ?? '9999-12-31').localeCompare(
          right.dueDate ?? '9999-12-31',
        );
      });

      return { ...column, tasks };
    });
    this.persistColumns(nextColumns);
  }

  /**
   * Öffnet oder schließt einen der Board-Hilfsbereiche.
   */
  toggleUtilityPanel(panel: 'rules' | 'recurrence'): void {
    this.activeUtilityPanel.update((activePanel) =>
      activePanel === panel ? null : panel,
    );
  }

  /**
   * Liefert den sichtbaren Projektstatus.
   */
  getProjectStatusLabel(): string {
    const status = this.project()?.status;
    if (status === 'completed') {
      return 'Abgeschlossen';
    }
    if (status === 'archived') {
      return 'Archiviert';
    }
    return 'Aktiv';
  }

  /**
   * Prüft, ob die geöffnete Aufgabe zur Vergabe bereitliegt.
   */
  isReadyForAssignment(task: WorkspaceTask): boolean {
    return isOnDemandReadyTask(task);
  }

  /**
   * Prüft, ob eine Aufgabe in den Pool gegeben werden darf.
   */
  canReleaseToPool(task: WorkspaceTask): boolean {
    return canReleaseTaskToPool(task);
  }

  /**
   * Formatiert ein ISO-Datum kompakt für die Oberfläche.
   */
  formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
  }

  /**
   * Persistiert eine neue Boardkopie.
   */
  private persistColumns(columns: WorkspaceColumn[]): void {
    this.columns.set(columns);
    this.workspaceService.saveBoard(this.projectId(), columns);
  }

  /**
   * Erstellt eine ausreichend tiefe Kopie des lokalen Boards.
   */
  private cloneColumns(): WorkspaceColumn[] {
    return this.columns().map((column) => ({
      ...column,
      tasks: column.tasks.map((task) => ({
        ...task,
        tags: [...task.tags],
      })),
    }));
  }

  /**
   * Synchronisiert die Detailansicht nach einer Task-Mutation.
   */
  private syncSelectedTask(taskId: string): void {
    const task = this.columns()
      .flatMap((column) => column.tasks)
      .find((item) => item.id === taskId);
    this.selectedTask.set(task ? { ...task, tags: [...task.tags] } : null);
  }
}
