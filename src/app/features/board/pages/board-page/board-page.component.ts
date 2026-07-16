// src/app/features/board/pages/board-page/board-page.component.ts

import { CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { canReleaseTaskToPool, isOnDemandReadyTask } from '../../../../core/workspace/task-rules';
import { WorkspaceAutomationService } from '../../../../core/workspace/workspace-automation.service';
import {
  BoardViewMode,
  TaskPriority,
  WorkspaceAutomationRuleSavePayload,
  WorkspaceColumn,
  WorkspaceColumnSortMode,
  WorkspaceMember,
  WorkspaceTask,
  WorkspaceTaskRecurrenceRule,
  WorkspaceTaskRecurrenceSavePayload,
} from '../../../../core/workspace/workspace.models';
import { WorkspaceDisplayPreferencesService } from '../../../../core/workspace/workspace-display-preferences.service';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { MemberSelectComponent } from '../../../../shared/ui/member-select/member-select.component';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '../../../../shared/ui/select-menu/select-menu.component';
import { WorkspaceTaskCardComponent } from '../../../../shared/ui/workspace-task-card/workspace-task-card.component';
import {
  AutomationRuleModalComponent,
  AutomationRuleStateTogglePayload,
} from '../../components/automation-rule-modal/automation-rule-modal.component';
import { BoardColumnComponent } from '../../components/board-column/board-column.component';
import {
  TaskRecurrenceModalComponent,
  TaskRecurrenceStateTogglePayload,
} from '../../components/task-recurrence-modal/task-recurrence-modal.component';

const COLUMN_COLOR_OPTIONS: readonly SelectMenuOption[] = [
  { value: '#7752B3', label: 'Violett', color: '#7752B3' },
  { value: '#D5A646', label: 'Gold', color: '#D5A646' },
  { value: '#4E82A8', label: 'Blau', color: '#4E82A8' },
  { value: '#4F9572', label: 'Salbei', color: '#4F9572' },
  { value: '#B9546A', label: 'Mauve', color: '#B9546A' },
  { value: '#8A8093', label: 'Graphit', color: '#8A8093' },
];

const PRIORITY_OPTIONS: readonly SelectMenuOption[] = [
  { value: 'hoch', label: 'Hoch', icon: 'priority_high' },
  { value: 'mittel', label: 'Mittel', icon: 'drag_handle' },
  { value: 'niedrig', label: 'Niedrig', icon: 'south' },
];

const TASK_DRAWER_CLOSE_MS = 280;
const MAX_TASK_TAGS = 12;
const MAX_TASK_TAG_LENGTH = 32;

type TaskDrawerTab = 'details' | 'subtasks' | 'comments' | 'attachments' | 'history';

@Component({
  selector: 'cm-board-page',
  imports: [
    AutomationRuleModalComponent,
    BoardColumnComponent,
    CdkDropList,
    MemberSelectComponent,
    RouterLink,
    SelectMenuComponent,
    TaskRecurrenceModalComponent,
    WorkspaceTaskCardComponent,
  ],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--completed-task-opacity]': 'displayPreferences.completedTaskOpacity()',
  },
})
export class BoardPageComponent {
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly displayPreferences: WorkspaceDisplayPreferencesService;
  protected readonly automationService: WorkspaceAutomationService;
  protected readonly columnColorOptions = COLUMN_COLOR_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;

  protected readonly projectId = signal('personal');
  protected readonly columns = signal<WorkspaceColumn[]>([]);
  protected readonly viewMode = signal<BoardViewMode>('board');
  protected readonly selectedTask = signal<WorkspaceTask | null>(null);
  protected readonly drawerClosing = signal(false);
  protected readonly activeTaskTab = signal<TaskDrawerTab>('details');
  protected readonly taskTitleDraft = signal('');
  protected readonly taskDescriptionDraft = signal('');
  protected readonly taskTagsDraft = signal('');
  protected readonly commentDraft = signal('');
  protected readonly subtaskDraft = signal('');
  protected readonly subtaskAssigneeDraft = signal<string | null>(null);
  protected readonly focusedSubtaskId = signal<string | null>(null);
  protected readonly editingSubtaskId = signal<string | null>(null);
  protected readonly subtaskEditDraft = signal('');
  protected readonly collaboratorSelection = signal<string | null>(null);
  protected readonly attachmentDragActive = signal(false);
  protected readonly projectActionsOpen = signal(false);
  protected readonly automationModalOpen = signal(false);
  protected readonly recurrenceModalOpen = signal(false);
  protected readonly recurrenceEditorTaskId = signal<string | null>(null);

  protected readonly project = computed(() =>
    this.projectId() === 'personal' ? null : this.workspaceService.getProject(this.projectId()),
  );
  protected readonly title = computed(() => this.project()?.name ?? 'Mein Board');
  protected readonly subtitle = computed(() =>
    this.project() ? '' : 'Persönliche Aufgaben und direkt zugewiesene Projektarbeit.',
  );
  protected readonly isReadOnly = computed(
    () => !!this.project() && this.project()?.status !== 'active',
  );
  protected readonly taskEditingDisabled = computed(
    () => this.isReadOnly() || this.selectedTask()?.isDone === true,
  );
  protected readonly taskCount = computed(() =>
    this.columns().reduce((count, column) => count + column.tasks.length, 0),
  );
  protected readonly dropListIds = computed(() => this.columns().map((column) => column.id));
  protected readonly listRows = computed(() =>
    this.columns().flatMap((column) => column.tasks.map((task) => ({ column, task }))),
  );
  protected readonly automationRules = computed(() =>
    this.automationService.getRules(this.projectId()),
  );
  protected readonly activeAutomationRuleCount = computed(() =>
    this.automationService.getActiveRuleCount(this.projectId()),
  );
  protected readonly recurrenceRules = computed(() =>
    this.workspaceService.getRecurrenceRules(this.projectId()),
  );
  protected readonly activeRecurrenceRuleCount = computed(
    () => this.recurrenceRules().filter((rule) => rule.isActive).length,
  );
  protected readonly recurrenceEditorTask = computed(() => {
    const taskId = this.recurrenceEditorTaskId();
    if (!taskId) {
      return null;
    }

    return (
      this.columns()
        .flatMap((column) => column.tasks)
        .find((task) => task.id === taskId) ?? null
    );
  });
  protected readonly scheduleLabel = computed(() => {
    const project = this.project();
    if (!project) {
      return 'Persönlicher Bereich';
    }

    return `${this.formatDate(project.startedAt)} – ${this.formatDate(project.dueAt)}`;
  });

  protected readonly availableCollaborators = computed(() => {
    const task = this.selectedTask();
    if (!task) {
      return this.workspaceService.members();
    }

    return this.workspaceService
      .members()
      .filter((member) => !task.collaborators.some((item) => item.id === member.id));
  });
  protected readonly mentionCandidates = computed(() => {
    const match = this.commentDraft().match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) {
      return [];
    }

    const query = (match[1] ?? '').toLocaleLowerCase('de');
    return this.workspaceService
      .members()
      .filter((member) =>
        [member.fullName, member.email].some((value) =>
          value.toLocaleLowerCase('de').includes(query),
        ),
      );
  });

  private closeTimerId: number | null = null;
  private requestedTaskId: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    workspaceService: WorkspacePreviewService,
    displayPreferences: WorkspaceDisplayPreferencesService,
    automationService: WorkspaceAutomationService,
    destroyRef: DestroyRef,
  ) {
    this.workspaceService = workspaceService;
    this.displayPreferences = displayPreferences;
    this.automationService = automationService;

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const projectId = params.get('projectId') ?? 'personal';
      this.projectId.set(projectId);
      this.columns.set(this.workspaceService.getBoard(projectId));
      this.resetDrawerImmediately();
      this.closeWorkspaceModals();
      this.openRequestedTask();

      if (projectId !== 'personal') {
        this.workspaceService.markProjectOpened(projectId);
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.requestedTaskId = params.get('task');
      this.openRequestedTask();
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

    const task = event.item.data as WorkspaceTask;
    const nextColumns = this.workspaceService.moveTask(
      this.projectId(),
      task.id,
      event.previousContainer.id,
      event.container.id,
      event.currentIndex,
    );
    this.columns.set(nextColumns);
    if (this.selectedTask()?.id === task.id) {
      this.syncSelectedTask(task.id);
    }
  }

  /** Öffnet die Task-Detailansicht oder die Hauptaufgabe einer Unteraufgaben-Spiegelung. */
  openTask(task: WorkspaceTask): void {
    if (this.closeTimerId !== null) {
      window.clearTimeout(this.closeTimerId);
      this.closeTimerId = null;
    }

    const sourceTask =
      task.isSubtaskMirror && task.sourceTaskId
        ? this.workspaceService.getTaskById(task.sourceTaskId)
        : null;
    const drawerTask = sourceTask ?? task;

    this.drawerClosing.set(false);
    this.selectedTask.set(this.cloneTask(drawerTask));
    this.taskTitleDraft.set(drawerTask.title);
    this.taskDescriptionDraft.set(drawerTask.description);
    this.taskTagsDraft.set(drawerTask.tags.join(', '));
    this.commentDraft.set('');
    this.subtaskDraft.set('');
    this.subtaskAssigneeDraft.set(null);
    this.focusedSubtaskId.set(task.isSubtaskMirror ? task.sourceSubtaskId : null);
    this.editingSubtaskId.set(null);
    this.subtaskEditDraft.set('');
    this.collaboratorSelection.set(null);
    this.attachmentDragActive.set(false);
    this.activeTaskTab.set(task.isSubtaskMirror ? 'subtasks' : 'details');

    if (task.isSubtaskMirror && task.sourceSubtaskId) {
      queueMicrotask(() => {
        document
          .getElementById(`subtask-row-${task.sourceSubtaskId}`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
  }

  /** Startet die animierte Schließbewegung des Task-Drawers. */
  closeTask(): void {
    if (!this.selectedTask() || this.drawerClosing()) {
      return;
    }

    this.drawerClosing.set(true);
    this.closeTimerId = window.setTimeout(() => {
      this.resetDrawerImmediately();
      if (this.requestedTaskId) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { task: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    }, TASK_DRAWER_CLOSE_MS);
  }

  /** Wechselt den Inhaltsbereich des Task-Drawers. */
  setTaskTab(tab: TaskDrawerTab): void {
    this.activeTaskTab.set(tab);
  }

  /** Schaltet eine Aufgabe oder gespiegelte Unteraufgabe zwischen offen und erledigt um. */
  toggleTaskCompleted(task: WorkspaceTask): void {
    if (this.isReadOnly()) {
      return;
    }

    if (task.isSubtaskMirror) {
      this.columns.set(this.workspaceService.toggleMirroredSubtask(this.projectId(), task));
      if (task.sourceTaskId && this.selectedTask()?.id === task.sourceTaskId) {
        this.syncSelectedTask(task.sourceTaskId);
      }
      return;
    }

    this.columns.set(this.workspaceService.toggleTaskCompleted(this.projectId(), task.id));
    this.syncSelectedTask(task.id);
  }

  /** Gibt die geöffnete Hauptaufgabe in den Pool frei. */
  releaseSelectedTaskToPool(): void {
    if (this.taskEditingDisabled()) {
      return;
    }
    const task = this.selectedTask();
    if (!task || !canReleaseTaskToPool(task)) {
      return;
    }

    this.columns.set(this.workspaceService.moveTaskToPool(this.projectId(), task.id));
    this.syncSelectedTask(task.id);
  }

  /** Fügt in einer Spalte eine neue Aufgabe ein. */
  addTask(columnId: string): void {
    if (this.isReadOnly()) {
      return;
    }
    const nextColumns = this.workspaceService.addTask(this.projectId(), columnId);
    this.columns.set(nextColumns);
    const createdTask = nextColumns.find((column) => column.id === columnId)?.tasks[0];

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
        color:
          COLUMN_COLOR_OPTIONS[this.columns().length % COLUMN_COLOR_OPTIONS.length]?.value ??
          '#7752B3',
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
      this.workspaceService.renameColumn(this.projectId(), payload.columnId, payload.title),
    );
  }

  /** Entfernt eine freie Spalte und erhält deren Aufgaben. */
  deleteColumn(columnId: string): void {
    if (this.isReadOnly()) {
      return;
    }
    this.columns.set(this.workspaceService.deleteColumn(this.projectId(), columnId));
  }

  /** Speichert die ausgewählte Spaltenfarbe. */
  changeColumnColor(payload: { columnId: string; color: string }): void {
    if (this.isReadOnly()) {
      return;
    }
    this.columns.set(
      this.workspaceService.updateColumnColor(this.projectId(), payload.columnId, payload.color),
    );
  }

  /** Sortiert eine Spalte und speichert den aktiven Modus. */
  sortColumn(payload: { columnId: string; mode: WorkspaceColumnSortMode }): void {
    if (this.isReadOnly()) {
      return;
    }
    this.columns.set(
      this.workspaceService.sortColumn(this.projectId(), payload.columnId, payload.mode),
    );
  }

  /** Speichert einen bearbeiteten Tasktitel. */
  saveTaskTitle(): void {
    const task = this.selectedTask();
    const title = this.taskTitleDraft().trim();
    if (!task || !title || title === task.title || this.taskEditingDisabled()) {
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
    if (!task || description === task.description || this.taskEditingDisabled()) {
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

  /** Speichert mehrere kommagetrennte Tags und entfernt Duplikate. */
  saveTaskTags(): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    const tags = this.parseTaskTags(this.taskTagsDraft());
    const tagsUnchanged =
      task.tags.length === tags.length && task.tags.every((tag, index) => tag === tags[index]);
    this.taskTagsDraft.set(tags.join(', '));

    if (tagsUnchanged) {
      return;
    }

    this.applyTaskColumns(
      this.workspaceService.updateTask(
        this.projectId(),
        task.id,
        { tags },
        tags.length > 0 ? 'Tags aktualisiert' : 'Tags entfernt',
        'sell',
      ),
      task.id,
    );
  }

  /** Ändert die Priorität der geöffneten Aufgabe. */
  changeTaskPriority(priority: TaskPriority): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.updateTaskPriority(this.projectId(), task.id, priority),
      task.id,
    );
  }

  /** Ändert die verantwortliche Person. */
  changeTaskAssignee(memberId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }
    const member = this.workspaceService.members().find((item) => item.id === memberId) ?? null;
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

  /** Aktiviert oder entfernt das optionale Startdatum. */
  toggleTaskStartDate(enabled: boolean): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    const nextStartDate = enabled
      ? (task.startDate ?? this.getDefaultStartDate(task.dueDate))
      : null;
    this.applyTaskColumns(
      this.workspaceService.updateTask(
        this.projectId(),
        task.id,
        { startDate: nextStartDate },
        enabled ? 'Startdatum aktiviert' : 'Startdatum entfernt',
        enabled ? 'date_range' : 'event_busy',
      ),
      task.id,
    );
  }

  /** Ändert das Startdatum der Aufgabe. */
  changeTaskStartDate(startDate: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }
    const normalizedStartDate = startDate || null;
    const dueDate =
      normalizedStartDate && task.dueDate && normalizedStartDate > task.dueDate
        ? normalizedStartDate
        : task.dueDate;
    this.applyTaskColumns(
      this.workspaceService.updateTask(
        this.projectId(),
        task.id,
        { startDate: normalizedStartDate, dueDate },
        'Zeitraum geändert',
        'date_range',
      ),
      task.id,
    );
  }

  /** Ändert das Fälligkeitsdatum. */
  changeTaskDueDate(dueDate: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.updateTask(
        this.projectId(),
        task.id,
        {
          startDate:
            dueDate && task.startDate && dueDate < task.startDate ? dueDate : task.startDate,
          dueDate: dueDate || null,
        },
        'Zeitraum geändert',
        'event',
      ),
      task.id,
    );
  }

  /** Fügt eine ausgewählte Person als Mitwirkende hinzu. */
  addCollaborator(memberId: string): void {
    const member = this.workspaceService.members().find((item) => item.id === memberId);
    const task = this.selectedTask();
    if (!member || !task || this.taskEditingDisabled() || this.isCollaborator(task, member.id)) {
      this.collaboratorSelection.set(null);
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.toggleTaskCollaborator(this.projectId(), task.id, member.id),
      task.id,
    );
    this.collaboratorSelection.set(null);
  }

  /** Entfernt eine mitwirkende Person direkt aus dem Task. */
  removeCollaborator(member: WorkspaceMember): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled() || !this.isCollaborator(task, member.id)) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.toggleTaskCollaborator(this.projectId(), task.id, member.id),
      task.id,
    );
  }

  /** Fügt eine neue Unteraufgabe hinzu. */
  addSubtask(): void {
    const task = this.selectedTask();
    if (!task || !this.subtaskDraft().trim() || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.addSubtask(
        this.projectId(),
        task.id,
        this.subtaskDraft(),
        this.subtaskAssigneeDraft(),
      ),
      task.id,
    );
    this.subtaskDraft.set('');
    this.subtaskAssigneeDraft.set(null);
    this.editingSubtaskId.set(null);
    this.subtaskEditDraft.set('');
    this.collaboratorSelection.set(null);
    this.attachmentDragActive.set(false);
  }

  /** Ändert die verantwortliche Person einer Unteraufgabe. */
  changeSubtaskAssignee(subtaskId: string, memberId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.applyTaskColumns(
      this.workspaceService.updateSubtaskAssignee(
        this.projectId(),
        task.id,
        subtaskId,
        memberId || null,
      ),
      task.id,
    );
  }

  /** Schaltet eine Unteraufgabe um. */
  toggleSubtask(subtaskId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.toggleSubtask(this.projectId(), task.id, subtaskId),
      task.id,
    );
  }

  /** Öffnet den Bearbeitungsmodus einer Unteraufgabe. */
  startSubtaskEdit(subtaskId: string, title: string): void {
    if (this.taskEditingDisabled()) {
      return;
    }
    this.editingSubtaskId.set(subtaskId);
    this.subtaskEditDraft.set(title);
  }

  /** Speichert den geänderten Titel einer Unteraufgabe. */
  saveSubtaskEdit(): void {
    const task = this.selectedTask();
    const subtaskId = this.editingSubtaskId();
    const title = this.subtaskEditDraft().trim();
    if (!task || !subtaskId || !title || this.taskEditingDisabled()) {
      this.cancelSubtaskEdit();
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.updateSubtask(this.projectId(), task.id, subtaskId, title),
      task.id,
    );
    this.cancelSubtaskEdit();
  }

  /** Verwirft die Bearbeitung einer Unteraufgabe. */
  cancelSubtaskEdit(): void {
    this.editingSubtaskId.set(null);
    this.subtaskEditDraft.set('');
  }

  /** Entfernt eine Unteraufgabe. */
  deleteSubtask(subtaskId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.deleteSubtask(this.projectId(), task.id, subtaskId),
      task.id,
    );
  }

  /** Ergänzt eine ausgewählte Person als Erwähnung im Kommentar. */
  insertMention(member: WorkspaceMember): void {
    if (this.taskEditingDisabled()) {
      return;
    }

    const firstName = member.fullName.trim().split(/\s+/)[0] ?? member.fullName;
    this.commentDraft.update((draft) => draft.replace(/@[^\s@]*$/, `@${firstName} `));
  }

  /** Fügt einen Kommentar hinzu. */
  addComment(): void {
    const task = this.selectedTask();
    if (!task || !this.commentDraft().trim() || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.addComment(this.projectId(), task.id, this.commentDraft()),
      task.id,
    );
    this.commentDraft.set('');
  }

  /** Entfernt einen Kommentar. */
  deleteComment(commentId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.deleteComment(this.projectId(), task.id, commentId),
      task.id,
    );
  }

  /** Übernimmt ausgewählte Dateimetadaten als lokale Anhänge. */
  addAttachments(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addAttachmentFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  /** Aktiviert den visuellen Drag-Zustand des Uploadfelds. */
  handleAttachmentDrag(event: DragEvent, active: boolean): void {
    event.preventDefault();
    if (!this.taskEditingDisabled()) {
      this.attachmentDragActive.set(active);
    }
  }

  /** Übernimmt Dateien aus einem Drag-and-drop-Ereignis. */
  dropAttachments(event: DragEvent): void {
    event.preventDefault();
    this.attachmentDragActive.set(false);
    this.addAttachmentFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  /** Speichert eine Liste ausgewählter Dateien als lokale Anhänge. */
  private addAttachmentFiles(files: File[]): void {
    const task = this.selectedTask();
    if (!task || files.length === 0 || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.addAttachments(this.projectId(), task.id, files),
      task.id,
    );
  }

  /** Entfernt einen Anhang. */
  deleteAttachment(attachmentId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }
    this.applyTaskColumns(
      this.workspaceService.deleteAttachment(this.projectId(), task.id, attachmentId),
      task.id,
    );
  }

  /** Löscht die geöffnete Aufgabe nach Bestätigung. */
  deleteSelectedTask(): void {
    const task = this.selectedTask();
    if (
      !task ||
      this.taskEditingDisabled() ||
      !window.confirm(`Aufgabe „${task.title}“ wirklich löschen?`)
    ) {
      return;
    }
    this.columns.set(this.workspaceService.deleteTask(this.projectId(), task.id));
    this.closeTask();
  }

  /** Öffnet den Regelbaukasten für das aktuelle Board. */
  openAutomationModal(): void {
    this.recurrenceModalOpen.set(false);
    this.recurrenceEditorTaskId.set(null);
    this.automationModalOpen.set(true);
  }

  /** Schließt den Regelbaukasten. */
  closeAutomationModal(): void {
    this.automationModalOpen.set(false);
  }

  /** Erstellt oder aktualisiert eine Boardregel. */
  saveAutomationRule(payload: WorkspaceAutomationRuleSavePayload): void {
    this.automationService.saveRule(this.projectId(), payload);
  }

  /** Schaltet eine Boardregel aktiv oder inaktiv. */
  toggleAutomationRule(payload: AutomationRuleStateTogglePayload): void {
    this.automationService.toggleRule(this.projectId(), payload.ruleId, payload.isActive);
  }

  /** Entfernt eine Boardregel. */
  deleteAutomationRule(ruleId: string): void {
    this.automationService.deleteRule(this.projectId(), ruleId);
  }

  /** Öffnet die Übersicht aller Wiederholungen des aktuellen Boards. */
  openRecurrenceOverview(): void {
    this.automationModalOpen.set(false);
    this.recurrenceEditorTaskId.set(null);
    this.recurrenceModalOpen.set(true);
  }

  /** Öffnet die Wiederholungsregel einer konkreten Aufgabe. */
  openTaskRecurrence(task: WorkspaceTask): void {
    if (!task.isRecurring || !task.recurrenceRule) {
      return;
    }

    this.automationModalOpen.set(false);
    this.recurrenceEditorTaskId.set(task.id);
    this.recurrenceModalOpen.set(true);
  }

  /** Öffnet aus der Übersicht den Editor einer Wiederholungsregel. */
  openRecurrenceRule(rule: WorkspaceTaskRecurrenceRule): void {
    this.recurrenceEditorTaskId.set(rule.taskId);
  }

  /** Schließt die Wiederholungsverwaltung. */
  closeRecurrenceModal(): void {
    this.recurrenceModalOpen.set(false);
    this.recurrenceEditorTaskId.set(null);
  }

  /** Reserviert oder entfernt die Wiederholung der geöffneten Aufgabe. */
  toggleSelectedTaskRecurrence(enabled: boolean): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.applyTaskColumns(
      this.workspaceService.reserveTaskRecurrence(this.projectId(), task.id, enabled),
      task.id,
    );
  }

  /** Speichert die Parameter einer Task-Wiederholung. */
  saveRecurrenceRule(payload: WorkspaceTaskRecurrenceSavePayload): void {
    this.applyTaskColumns(
      this.workspaceService.saveTaskRecurrence(this.projectId(), payload),
      payload.taskId,
    );
    this.closeRecurrenceModal();
  }

  /** Schaltet eine Task-Wiederholung aktiv oder inaktiv. */
  toggleRecurrenceRule(payload: TaskRecurrenceStateTogglePayload): void {
    const nextColumns = this.workspaceService.toggleTaskRecurrence(
      this.projectId(),
      payload.taskId,
      payload.isActive,
    );
    this.columns.set(nextColumns);
    if (this.selectedTask()?.id === payload.taskId) {
      this.syncSelectedTask(payload.taskId);
    }
  }

  /** Entfernt eine Task-Wiederholung. */
  deleteRecurrenceRule(taskId: string): void {
    const editorWasOpen = this.recurrenceEditorTaskId() === taskId;
    const nextColumns = this.workspaceService.deleteTaskRecurrence(this.projectId(), taskId);
    this.columns.set(nextColumns);
    if (this.selectedTask()?.id === taskId) {
      this.syncSelectedTask(taskId);
    }
    if (editorWasOpen) {
      this.closeRecurrenceModal();
    }
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
    const task =
      this.columns()
        .flatMap((column) => column.tasks)
        .find((item) => item.id === taskId) ?? this.workspaceService.getTaskById(taskId);
    if (!task) {
      this.resetDrawerImmediately();
      return;
    }
    this.selectedTask.set(this.cloneTask(task));
    this.taskTitleDraft.set(task.title);
    this.taskDescriptionDraft.set(task.description);
    this.taskTagsDraft.set(task.tags.join(', '));
  }

  /** Öffnet einen über die globale Suche angeforderten Task. */
  private openRequestedTask(): void {
    if (!this.requestedTaskId) {
      return;
    }

    const task =
      this.columns()
        .flatMap((column) => column.tasks)
        .find((item) => item.id === this.requestedTaskId) ??
      this.workspaceService.getTaskById(this.requestedTaskId);
    if (task && this.selectedTask()?.id !== task.id) {
      this.openTask(task);
    }
  }

  /** Wandelt eine kommagetrennte Eingabe in eindeutige, begrenzte Tags um. */
  private parseTaskTags(value: string): string[] {
    const uniqueTags = new Map<string, string>();

    for (const rawTag of value.split(',')) {
      const tag = rawTag.trim().replace(/\s+/g, ' ').slice(0, MAX_TASK_TAG_LENGTH);
      const key = tag.toLocaleLowerCase('de');
      if (tag && !uniqueTags.has(key)) {
        uniqueTags.set(key, tag);
      }
      if (uniqueTags.size >= MAX_TASK_TAGS) {
        break;
      }
    }

    return [...uniqueTags.values()];
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
    this.taskTitleDraft.set('');
    this.taskDescriptionDraft.set('');
    this.taskTagsDraft.set('');
    this.commentDraft.set('');
    this.subtaskDraft.set('');
    this.subtaskAssigneeDraft.set(null);
    this.focusedSubtaskId.set(null);
    this.editingSubtaskId.set(null);
    this.subtaskEditDraft.set('');
    this.collaboratorSelection.set(null);
    this.attachmentDragActive.set(false);
  }
  /** Schließt alle boardbezogenen Modals beim Kontextwechsel. */
  private closeWorkspaceModals(): void {
    this.automationModalOpen.set(false);
    this.recurrenceModalOpen.set(false);
    this.recurrenceEditorTaskId.set(null);
  }

  /** Ermittelt ein gültiges Standarddatum für einen neu aktivierten Zeitraum. */
  private getDefaultStartDate(dueDate: string | null): string {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60_000;
    const today = new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);

    return dueDate && dueDate < today ? dueDate : today;
  }
}
