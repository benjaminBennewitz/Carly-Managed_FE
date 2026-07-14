// src/app/features/board/pages/board-page/board-page.component.ts

import {
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
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
  TaskPriority,
  WorkspaceColumn,
  WorkspaceMember,
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
const TASK_DRAWER_CLOSE_MS = 280;

type TaskDrawerTab =
  | 'details'
  | 'subtasks'
  | 'comments'
  | 'attachments'
  | 'history';

@Component({
  selector: 'cm-board-page',
  imports: [
    BoardColumnComponent,
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
  protected readonly drawerClosing = signal(false);
  protected readonly activeTaskTab = signal<TaskDrawerTab>('details');
  protected readonly taskTitleDraft = signal('');
  protected readonly taskDescriptionDraft = signal('');
  protected readonly commentDraft = signal('');
  protected readonly subtaskDraft = signal('');
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

  private closeTimerId: number | null = null;

  constructor(
    route: ActivatedRoute,
    workspaceService: WorkspacePreviewService,
    destroyRef: DestroyRef,
  ) {
    this.workspaceService = workspaceService;

    route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const projectId = params.get('projectId') ?? 'personal';
      this.projectId.set(projectId);
      this.columns.set(this.workspaceService.getBoard(projectId));
      this.resetDrawerImmediately();
      this.activeUtilityPanel.set(null);

      if (projectId !== 'personal') {
        this.workspaceService.markProjectOpened(projectId);
      }
    });

    destroyRef.onDestroy(() => {
      if (this.closeTimerId !== null) {
        window.clearTimeout(this.closeTimerId);
      }
    });
  }

  /** Wechselt zwischen Kanban- und Listenansicht. */
  setViewMode(mode: BoardViewMode): void {
    this.viewMode.set(mode);
  }

  /** Sortiert die Boardspalten horizontal neu. */
  dropColumn(event: CdkDragDrop<WorkspaceColumn[]>): void {
    if (this.isReadOnly() || event.previousIndex === event.currentIndex) {
      return;
    }

    const nextColumns = this.cloneColumns();
    moveItemInArray(nextColumns, event.previousIndex, event.currentIndex);
    this.persistColumns(nextColumns);
  }

  /** Verschiebt eine Aufgabe innerhalb oder zwischen Spalten. */
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

  /** Öffnet die Task-Detailansicht. */
  openTask(task: WorkspaceTask): void {
    if (this.closeTimerId !== null) {
      window.clearTimeout(this.closeTimerId);
      this.closeTimerId = null;
    }
    this.drawerClosing.set(false);
    this.selectedTask.set(this.cloneTask(task));
    this.taskTitleDraft.set(task.title);
    this.taskDescriptionDraft.set(task.description);
    this.commentDraft.set('');
    this.subtaskDraft.set('');
    this.activeTaskTab.set('details');
  }

  /** Startet die animierte Schließbewegung des Task-Drawers. */
  closeTask(): void {
    if (!this.selectedTask() || this.drawerClosing()) {
      return;
    }

    this.drawerClosing.set(true);
    this.closeTimerId = window.setTimeout(() => {
      this.resetDrawerImmediately();
    }, TASK_DRAWER_CLOSE_MS);
  }

  /** Wechselt den Inhaltsbereich des Task-Drawers. */
  setTaskTab(tab: TaskDrawerTab): void {
    this.activeTaskTab.set(tab);
  }

  /** Schaltet eine Aufgabe zwischen offen und erledigt um. */
  toggleTaskCompleted(task: WorkspaceTask): void {
    if (this.isReadOnly()) {
      return;
    }
    this.columns.set(
      this.workspaceService.toggleTaskCompleted(this.projectId(), task.id),
    );
    this.syncSelectedTask(task.id);
  }

  /** Gibt die geöffnete Hauptaufgabe in den Pool frei. */
  releaseSelectedTaskToPool(): void {
    if (this.isReadOnly()) {
      return;
    }
    const task = this.selectedTask();
    if (!task || !canReleaseTaskToPool(task)) {
      return;
    }

    this.columns.set(
      this.workspaceService.moveTaskToPool(this.projectId(), task.id),
    );
    this.syncSelectedTask(task.id);
  }

  /** Fügt in einer Spalte eine neue Aufgabe ein. */
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

  /** Fügt eine neue leere Boardspalte hinzu. */
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

  /** Benennt eine Spalte um. */
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

  /** Entfernt eine freie Spalte und erhält deren Aufgaben. */
  deleteColumn(columnId: string): void {
    if (this.isReadOnly()) {
      return;
    }
    this.columns.set(
      this.workspaceService.deleteColumn(this.projectId(), columnId),
    );
  }

  /** Wechselt zyklisch durch die verfügbaren Spaltenakzente. */
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

  /** Sortiert eine Spalte nach Titel oder Fälligkeitsdatum. */
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

  /** Speichert einen bearbeiteten Tasktitel. */
  saveTaskTitle(): void {
    const task = this.selectedTask();
    const title = this.taskTitleDraft().trim();
    if (!task || !title || title === task.title || this.isReadOnly()) {
      this.taskTitleDraft.set(task?.title ?? '');
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.updateTask(
        this.projectId(),
        task.id,
        { title },
        'Titel geändert',
        'title',
      ),
      task.id,
    );
  }

  /** Speichert die bearbeitete Beschreibung. */
  saveTaskDescription(): void {
    const task = this.selectedTask();
    const description = this.taskDescriptionDraft().trim();
    if (!task || description === task.description || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.updateTask(
        this.projectId(),
        task.id,
        { description },
        'Beschreibung geändert',
        'description',
      ),
      task.id,
    );
  }

  /** Ändert die Priorität der geöffneten Aufgabe. */
  changeTaskPriority(priority: TaskPriority): void {
    const task = this.selectedTask();
    if (!task || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.updateTaskPriority(
        this.projectId(),
        task.id,
        priority,
      ),
      task.id,
    );
  }

  /** Ändert die verantwortliche Person. */
  changeTaskAssignee(memberId: string): void {
    const task = this.selectedTask();
    if (!task || this.isReadOnly()) {
      return;
    }
    const member = this.workspaceService.members().find(
      (item) => item.id === memberId,
    ) ?? null;
    this.applyTaskColumns(
      this.workspaceService.updateTask(
        this.projectId(),
        task.id,
        { assignee: member },
        member ? `${member.fullName} zugewiesen` : 'Zuweisung entfernt',
        'assignment_ind',
      ),
      task.id,
    );
  }

  /** Ändert das Fälligkeitsdatum. */
  changeTaskDueDate(dueDate: string): void {
    const task = this.selectedTask();
    if (!task || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.updateTask(
        this.projectId(),
        task.id,
        { dueDate: dueDate || null },
        'Fälligkeit geändert',
        'event',
      ),
      task.id,
    );
  }

  /** Schaltet eine mitwirkende Person. */
  toggleCollaborator(member: WorkspaceMember): void {
    const task = this.selectedTask();
    if (!task || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.toggleTaskCollaborator(
        this.projectId(),
        task.id,
        member.id,
      ),
      task.id,
    );
  }

  /** Fügt eine neue Unteraufgabe hinzu. */
  addSubtask(): void {
    const task = this.selectedTask();
    if (!task || !this.subtaskDraft().trim() || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.addSubtask(
        this.projectId(),
        task.id,
        this.subtaskDraft(),
      ),
      task.id,
    );
    this.subtaskDraft.set('');
  }

  /** Schaltet eine Unteraufgabe um. */
  toggleSubtask(subtaskId: string): void {
    const task = this.selectedTask();
    if (!task || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.toggleSubtask(
        this.projectId(),
        task.id,
        subtaskId,
      ),
      task.id,
    );
  }

  /** Entfernt eine Unteraufgabe. */
  deleteSubtask(subtaskId: string): void {
    const task = this.selectedTask();
    if (!task || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.deleteSubtask(
        this.projectId(),
        task.id,
        subtaskId,
      ),
      task.id,
    );
  }

  /** Fügt einen Kommentar hinzu. */
  addComment(): void {
    const task = this.selectedTask();
    if (!task || !this.commentDraft().trim() || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.addComment(
        this.projectId(),
        task.id,
        this.commentDraft(),
      ),
      task.id,
    );
    this.commentDraft.set('');
  }

  /** Entfernt einen Kommentar. */
  deleteComment(commentId: string): void {
    const task = this.selectedTask();
    if (!task || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.deleteComment(
        this.projectId(),
        task.id,
        commentId,
      ),
      task.id,
    );
  }

  /** Übernimmt ausgewählte Dateimetadaten als lokale Anhänge. */
  addAttachments(event: Event): void {
    const task = this.selectedTask();
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!task || files.length === 0 || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.addAttachments(this.projectId(), task.id, files),
      task.id,
    );
    input.value = '';
  }

  /** Entfernt einen Anhang. */
  deleteAttachment(attachmentId: string): void {
    const task = this.selectedTask();
    if (!task || this.isReadOnly()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.deleteAttachment(
        this.projectId(),
        task.id,
        attachmentId,
      ),
      task.id,
    );
  }

  /** Löscht die geöffnete Aufgabe nach Bestätigung. */
  deleteSelectedTask(): void {
    const task = this.selectedTask();
    if (
      !task ||
      this.isReadOnly() ||
      !window.confirm(`Aufgabe „${task.title}“ wirklich löschen?`)
    ) {
      return;
    }
    this.columns.set(
      this.workspaceService.deleteTask(this.projectId(), task.id),
    );
    this.closeTask();
  }

  /** Öffnet oder schließt einen Board-Hilfsbereich. */
  toggleUtilityPanel(panel: 'rules' | 'recurrence'): void {
    this.activeUtilityPanel.update((activePanel) =>
      activePanel === panel ? null : panel,
    );
  }

  /** Liefert den sichtbaren Projektstatus. */
  getProjectStatusLabel(): string {
    const status = this.project()?.status;
    if (status === 'completed') return 'Abgeschlossen';
    if (status === 'archived') return 'Archiviert';
    return 'Aktiv';
  }

  /** Prüft, ob die geöffnete Aufgabe zur Vergabe bereitliegt. */
  isReadyForAssignment(task: WorkspaceTask): boolean {
    return isOnDemandReadyTask(task);
  }

  /** Prüft, ob eine Aufgabe in den Pool gegeben werden darf. */
  canReleaseToPool(task: WorkspaceTask): boolean {
    return canReleaseTaskToPool(task);
  }

  /** Prüft, ob eine Person als Mitwirkende eingetragen ist. */
  isCollaborator(task: WorkspaceTask, memberId: string): boolean {
    return task.collaborators.some((item) => item.id === memberId);
  }

  /** Formatiert ein ISO-Datum kompakt. */
  formatDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
  }

  /** Formatiert einen ISO-Zeitpunkt. */
  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  /** Formatiert eine Dateigröße. */
  formatFileSize(sizeBytes: number): string {
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1_048_576) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / 1_048_576).toFixed(1)} MB`;
  }

  /** Persistiert eine neue Boardkopie. */
  private persistColumns(columns: WorkspaceColumn[]): void {
    this.columns.set(columns);
    this.workspaceService.saveBoard(this.projectId(), columns);
  }

  /** Erstellt eine tiefe Kopie des lokalen Boards. */
  private cloneColumns(): WorkspaceColumn[] {
    return this.workspaceService.getBoard(this.projectId());
  }

  /** Wendet mutierte Spalten an und synchronisiert den Drawer. */
  private applyTaskColumns(columns: WorkspaceColumn[], taskId: string): void {
    this.columns.set(columns);
    this.syncSelectedTask(taskId);
  }

  /** Synchronisiert die Detailansicht nach einer Task-Mutation. */
  private syncSelectedTask(taskId: string): void {
    const task = this.columns()
      .flatMap((column) => column.tasks)
      .find((item) => item.id === taskId);
    if (!task) {
      this.resetDrawerImmediately();
      return;
    }
    this.selectedTask.set(this.cloneTask(task));
    this.taskTitleDraft.set(task.title);
    this.taskDescriptionDraft.set(task.description);
  }

  /** Erstellt eine tiefe Task-Kopie für den Drawer. */
  private cloneTask(task: WorkspaceTask): WorkspaceTask {
    return structuredClone(task);
  }

  /** Entfernt den Drawer ohne weitere Animation. */
  private resetDrawerImmediately(): void {
    if (this.closeTimerId !== null) {
      window.clearTimeout(this.closeTimerId);
      this.closeTimerId = null;
    }
    this.selectedTask.set(null);
    this.drawerClosing.set(false);
    this.commentDraft.set('');
    this.subtaskDraft.set('');
  }
}
