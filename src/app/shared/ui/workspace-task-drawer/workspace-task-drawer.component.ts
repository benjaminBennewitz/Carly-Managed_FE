// src/app/shared/ui/workspace-task-drawer/workspace-task-drawer.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';

import { canReleaseTaskToPool, isOnDemandReadyTask } from '../../../core/workspace/task-rules';
import {
  TaskPriority,
  WorkspaceMember,
  WorkspaceTask,
} from '../../../core/workspace/workspace.models';
import { WorkspaceService } from '../../../core/workspace/workspace.service';
import { MemberSelectComponent } from '../member-select/member-select.component';
import { SelectMenuComponent, SelectMenuOption } from '../select-menu/select-menu.component';
import { WorkspaceTaskCardComponent } from '../workspace-task-card/workspace-task-card.component';

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
  selector: 'cm-workspace-task-drawer',
  imports: [MemberSelectComponent, SelectMenuComponent, WorkspaceTaskCardComponent],
  templateUrl: './workspace-task-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceTaskDrawerComponent {
  @Input()
  set task(value: WorkspaceTask | null) {
    if (!value) {
      this.resetDrawerImmediately();
      return;
    }

    if (this.selectedTask()?.id !== value.id) {
      this.openTask(value);
    }
  }

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly taskUpdated = new EventEmitter<WorkspaceTask>();
  @Output() readonly taskDeleted = new EventEmitter<string>();

  protected readonly workspaceService: WorkspaceService;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
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

  protected readonly boardId = computed(() => this.selectedTask()?.projectId ?? 'personal');
  protected readonly project = computed(() => {
    const projectId = this.selectedTask()?.projectId;
    return projectId ? this.workspaceService.getProject(projectId) : null;
  });
  protected readonly drawerTitle = computed(
    () => this.project()?.name ?? this.selectedTask()?.projectTitle ?? 'Mein Board',
  );
  protected readonly isReadOnly = computed(
    () => !!this.project() && this.project()?.status !== 'active',
  );
  protected readonly taskEditingDisabled = computed(
    () => this.isReadOnly() || this.selectedTask()?.isDone === true,
  );
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

  constructor(workspaceService: WorkspaceService, destroyRef: DestroyRef) {
    this.workspaceService = workspaceService;

    destroyRef.onDestroy(() => {
      if (this.closeTimerId !== null) {
        window.clearTimeout(this.closeTimerId);
      }
    });
  }

  /** Öffnet die Task-Detailansicht oder die Hauptaufgabe einer Unteraufgaben-Spiegelung. */
  private openTask(task: WorkspaceTask): void {
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
    this.selectedTask.set(structuredClone(drawerTask));
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
  protected closeTask(): void {
    if (!this.selectedTask() || this.drawerClosing()) {
      return;
    }

    this.drawerClosing.set(true);
    this.closeTimerId = window.setTimeout(() => {
      this.resetDrawerImmediately();
      this.closed.emit();
    }, TASK_DRAWER_CLOSE_MS);
  }

  /** Wechselt den Inhaltsbereich des Task-Drawers. */
  protected setTaskTab(tab: TaskDrawerTab): void {
    this.activeTaskTab.set(tab);
  }

  /** Schaltet eine Aufgabe oder gespiegelte Unteraufgabe zwischen offen und erledigt um. */
  protected toggleTaskCompleted(task: WorkspaceTask): void {
    if (this.isReadOnly()) {
      return;
    }

    if (task.isSubtaskMirror) {
      this.workspaceService.toggleMirroredSubtask(this.boardId(), task);
      if (task.sourceTaskId) {
        this.syncSelectedTask(task.sourceTaskId);
      }
      return;
    }

    this.workspaceService.toggleTaskCompleted(this.boardId(), task.id);
    this.syncSelectedTask(task.id);
  }

  /** Gibt die geöffnete Hauptaufgabe in den Pool frei. */
  protected releaseSelectedTaskToPool(): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled() || !canReleaseTaskToPool(task)) {
      return;
    }

    this.workspaceService.moveTaskToPool(this.boardId(), task.id);
    this.syncSelectedTask(task.id);
  }

  /** Speichert einen bearbeiteten Tasktitel. */
  protected saveTaskTitle(): void {
    const task = this.selectedTask();
    const title = this.taskTitleDraft().trim();
    if (!task || !title || title === task.title || this.taskEditingDisabled()) {
      this.taskTitleDraft.set(task?.title ?? '');
      return;
    }

    this.workspaceService.updateTask(this.boardId(), task.id, { title }, 'Titel geändert', 'title');
    this.syncSelectedTask(task.id);
  }

  /** Speichert die bearbeitete Beschreibung. */
  protected saveTaskDescription(): void {
    const task = this.selectedTask();
    const description = this.taskDescriptionDraft().trim();
    if (!task || description === task.description || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.updateTask(
      this.boardId(),
      task.id,
      { description },
      'Beschreibung geändert',
      'description',
    );
    this.syncSelectedTask(task.id);
  }

  /** Speichert mehrere kommagetrennte Tags und entfernt Duplikate. */
  protected saveTaskTags(): void {
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

    this.workspaceService.updateTask(
      this.boardId(),
      task.id,
      { tags },
      tags.length > 0 ? 'Tags aktualisiert' : 'Tags entfernt',
      'sell',
    );
    this.syncSelectedTask(task.id);
  }

  /** Ändert die Priorität der geöffneten Aufgabe. */
  protected changeTaskPriority(priority: TaskPriority): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.updateTaskPriority(this.boardId(), task.id, priority);
    this.syncSelectedTask(task.id);
  }

  /** Ändert die verantwortliche Person. */
  protected changeTaskAssignee(memberId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    const member = this.workspaceService.members().find((item) => item.id === memberId) ?? null;
    this.workspaceService.updateTask(
      this.boardId(),
      task.id,
      { assignee: member },
      member ? `${member.fullName} zugewiesen` : 'Zuweisung entfernt',
      'assignment_ind',
    );
    this.syncSelectedTask(task.id);
  }

  /** Aktiviert oder entfernt das optionale Startdatum. */
  protected toggleTaskStartDate(enabled: boolean): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    const nextStartDate = enabled
      ? (task.startDate ?? this.getDefaultStartDate(task.dueDate))
      : null;
    this.workspaceService.updateTask(
      this.boardId(),
      task.id,
      { startDate: nextStartDate },
      enabled ? 'Startdatum aktiviert' : 'Startdatum entfernt',
      enabled ? 'date_range' : 'event_busy',
    );
    this.syncSelectedTask(task.id);
  }

  /** Ändert das Startdatum der Aufgabe. */
  protected changeTaskStartDate(startDate: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    const normalizedStartDate = startDate || null;
    const dueDate =
      normalizedStartDate && task.dueDate && normalizedStartDate > task.dueDate
        ? normalizedStartDate
        : task.dueDate;
    this.workspaceService.updateTask(
      this.boardId(),
      task.id,
      { startDate: normalizedStartDate, dueDate },
      'Zeitraum geändert',
      'date_range',
    );
    this.syncSelectedTask(task.id);
  }

  /** Ändert das Fälligkeitsdatum. */
  protected changeTaskDueDate(dueDate: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.updateTask(
      this.boardId(),
      task.id,
      {
        startDate: dueDate && task.startDate && dueDate < task.startDate ? dueDate : task.startDate,
        dueDate: dueDate || null,
      },
      'Zeitraum geändert',
      'event',
    );
    this.syncSelectedTask(task.id);
  }

  /** Fügt eine ausgewählte Person als Mitwirkende hinzu. */
  protected addCollaborator(memberId: string): void {
    const member = this.workspaceService.members().find((item) => item.id === memberId);
    const task = this.selectedTask();
    if (!member || !task || this.taskEditingDisabled() || this.isCollaborator(task, member.id)) {
      this.collaboratorSelection.set(null);
      return;
    }

    this.workspaceService.toggleTaskCollaborator(this.boardId(), task.id, member.id);
    this.syncSelectedTask(task.id);
    this.collaboratorSelection.set(null);
  }

  /** Entfernt eine mitwirkende Person direkt aus dem Task. */
  protected removeCollaborator(member: WorkspaceMember): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled() || !this.isCollaborator(task, member.id)) {
      return;
    }

    this.workspaceService.toggleTaskCollaborator(this.boardId(), task.id, member.id);
    this.syncSelectedTask(task.id);
  }

  /** Fügt eine neue Unteraufgabe hinzu. */
  protected addSubtask(): void {
    const task = this.selectedTask();
    if (!task || !this.subtaskDraft().trim() || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.addSubtask(
      this.boardId(),
      task.id,
      this.subtaskDraft(),
      this.subtaskAssigneeDraft(),
    );
    this.syncSelectedTask(task.id);
    this.subtaskDraft.set('');
    this.subtaskAssigneeDraft.set(null);
    this.cancelSubtaskEdit();
  }

  /** Ändert die verantwortliche Person einer Unteraufgabe. */
  protected changeSubtaskAssignee(subtaskId: string, memberId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.updateSubtaskAssignee(
      this.boardId(),
      task.id,
      subtaskId,
      memberId || null,
    );
    this.syncSelectedTask(task.id);
  }

  /** Schaltet eine Unteraufgabe um. */
  protected toggleSubtask(subtaskId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.toggleSubtask(this.boardId(), task.id, subtaskId);
    this.syncSelectedTask(task.id);
  }

  /** Öffnet den Bearbeitungsmodus einer Unteraufgabe. */
  protected startSubtaskEdit(subtaskId: string, title: string): void {
    if (this.taskEditingDisabled()) {
      return;
    }

    this.editingSubtaskId.set(subtaskId);
    this.subtaskEditDraft.set(title);
  }

  /** Speichert den geänderten Titel einer Unteraufgabe. */
  protected saveSubtaskEdit(): void {
    const task = this.selectedTask();
    const subtaskId = this.editingSubtaskId();
    const title = this.subtaskEditDraft().trim();
    if (!task || !subtaskId || !title || this.taskEditingDisabled()) {
      this.cancelSubtaskEdit();
      return;
    }

    this.workspaceService.updateSubtask(this.boardId(), task.id, subtaskId, title);
    this.syncSelectedTask(task.id);
    this.cancelSubtaskEdit();
  }

  /** Verwirft die Bearbeitung einer Unteraufgabe. */
  protected cancelSubtaskEdit(): void {
    this.editingSubtaskId.set(null);
    this.subtaskEditDraft.set('');
  }

  /** Entfernt eine Unteraufgabe. */
  protected deleteSubtask(subtaskId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.deleteSubtask(this.boardId(), task.id, subtaskId);
    this.syncSelectedTask(task.id);
  }

  /** Ergänzt eine ausgewählte Person als Erwähnung im Kommentar. */
  protected insertMention(member: WorkspaceMember): void {
    if (this.taskEditingDisabled()) {
      return;
    }

    const firstName = member.fullName.trim().split(/\s+/)[0] ?? member.fullName;
    this.commentDraft.update((draft) => draft.replace(/@[^\s@]*$/, `@${firstName} `));
  }

  /** Fügt einen Kommentar hinzu. */
  protected addComment(): void {
    const task = this.selectedTask();
    if (!task || !this.commentDraft().trim() || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.addComment(this.boardId(), task.id, this.commentDraft());
    this.syncSelectedTask(task.id);
    this.commentDraft.set('');
  }

  /** Entfernt einen Kommentar. */
  protected deleteComment(commentId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.deleteComment(this.boardId(), task.id, commentId);
    this.syncSelectedTask(task.id);
  }

  /** Übernimmt ausgewählte Dateimetadaten als lokale Anhänge. */
  protected addAttachments(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addAttachmentFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  /** Aktiviert den visuellen Drag-Zustand des Uploadfelds. */
  protected handleAttachmentDrag(event: DragEvent, active: boolean): void {
    event.preventDefault();
    if (!this.taskEditingDisabled()) {
      this.attachmentDragActive.set(active);
    }
  }

  /** Übernimmt Dateien aus einem Drag-and-drop-Ereignis. */
  protected dropAttachments(event: DragEvent): void {
    event.preventDefault();
    this.attachmentDragActive.set(false);
    this.addAttachmentFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  /** Entfernt einen Anhang. */
  protected deleteAttachment(attachmentId: string): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.deleteAttachment(this.boardId(), task.id, attachmentId);
    this.syncSelectedTask(task.id);
  }

  /** Löscht die geöffnete Aufgabe nach Bestätigung. */
  protected deleteSelectedTask(): void {
    const task = this.selectedTask();
    if (
      !task ||
      this.taskEditingDisabled() ||
      !window.confirm(`Aufgabe „${task.title}“ wirklich löschen?`)
    ) {
      return;
    }

    this.workspaceService.deleteTask(this.boardId(), task.id);
    this.taskDeleted.emit(task.id);
    this.closeTask();
  }

  /** Reserviert oder entfernt die Wiederholung der geöffneten Aufgabe. */
  protected toggleSelectedTaskRecurrence(enabled: boolean): void {
    const task = this.selectedTask();
    if (!task || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.reserveTaskRecurrence(this.boardId(), task.id, enabled);
    this.syncSelectedTask(task.id);
  }

  /** Prüft, ob die geöffnete Aufgabe zur Vergabe bereitliegt. */
  protected isReadyForAssignment(task: WorkspaceTask): boolean {
    return isOnDemandReadyTask(task);
  }

  /** Prüft, ob eine Aufgabe in den Pool gegeben werden darf. */
  protected canReleaseToPool(task: WorkspaceTask): boolean {
    return canReleaseTaskToPool(task);
  }

  /** Prüft, ob eine Person als Mitwirkende eingetragen ist. */
  private isCollaborator(task: WorkspaceTask, memberId: string): boolean {
    return task.collaborators.some((item) => item.id === memberId);
  }

  /** Formatiert ein ISO-Datum kompakt. */
  protected formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
  }

  /** Formatiert einen ISO-Zeitpunkt. */
  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  /** Formatiert eine Dateigröße. */
  protected formatFileSize(sizeBytes: number): string {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    }
    if (sizeBytes < 1_048_576) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / 1_048_576).toFixed(1)} MB`;
  }

  /** Speichert eine Liste ausgewählter Dateien als lokale Anhänge. */
  private addAttachmentFiles(files: File[]): void {
    const task = this.selectedTask();
    if (!task || files.length === 0 || this.taskEditingDisabled()) {
      return;
    }

    this.workspaceService.addAttachments(this.boardId(), task.id, files);
    this.syncSelectedTask(task.id);
  }

  /** Synchronisiert die Detailansicht nach einer Task-Mutation. */
  private syncSelectedTask(taskId: string): void {
    const task = this.workspaceService.getTaskById(taskId);
    if (!task) {
      this.resetDrawerImmediately();
      this.closed.emit();
      return;
    }

    this.selectedTask.set(structuredClone(task));
    this.taskTitleDraft.set(task.title);
    this.taskDescriptionDraft.set(task.description);
    this.taskTagsDraft.set(task.tags.join(', '));
    this.taskUpdated.emit(structuredClone(task));
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

  /** Ermittelt ein gültiges Standarddatum für einen neu aktivierten Zeitraum. */
  private getDefaultStartDate(dueDate: string | null): string {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60_000;
    const today = new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);

    return dueDate && dueDate < today ? dueDate : today;
  }
}
