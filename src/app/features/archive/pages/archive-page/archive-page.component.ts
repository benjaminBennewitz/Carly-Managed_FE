// src/app/features/archive/pages/archive-page/archive-page.component.ts

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  ArchivedTaskEntry,
  WorkspaceMember,
  WorkspaceProject,
  WorkspaceTask,
} from '../../../../core/workspace/workspace.models';
import { WorkspaceService } from '../../../../core/workspace/workspace.service';
import { WorkspaceTaskDrawerComponent } from '../../../../shared/ui/workspace-task-drawer/workspace-task-drawer.component';

type ArchiveViewMode = 'cards' | 'list';

@Component({
  selector: 'cm-archive-page',
  imports: [WorkspaceTaskDrawerComponent],
  templateUrl: './archive-page.component.html',
  styleUrl: './archive-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivePageComponent {
  protected readonly workspaceService: WorkspaceService;
  protected readonly projectViewMode = signal<ArchiveViewMode>('cards');
  protected readonly taskViewMode = signal<ArchiveViewMode>('cards');
  protected readonly projectsNewestFirst = signal(true);
  protected readonly tasksNewestFirst = signal(true);
  protected readonly selectedTask = signal<WorkspaceTask | null>(null);
  protected readonly sortedProjects = computed(() =>
    [...this.workspaceService.archivedProjects()].sort((left, right) =>
      this.compareDates(
        this.getProjectLifecycleDate(left),
        this.getProjectLifecycleDate(right),
        this.projectsNewestFirst(),
      ),
    ),
  );
  protected readonly sortedTasks = computed(() =>
    [...this.workspaceService.archivedTasks()].sort((left, right) =>
      this.compareDates(left.archivedAt, right.archivedAt, this.tasksNewestFirst()),
    ),
  );

  constructor(
    workspaceService: WorkspaceService,
    private readonly router: Router,
  ) {
    this.workspaceService = workspaceService;
  }

  /** Wechselt die Darstellung der archivierten Projekte. */
  setProjectViewMode(mode: ArchiveViewMode): void {
    this.projectViewMode.set(mode);
  }

  /** Wechselt die Darstellung des Aufgabenverlaufs. */
  setTaskViewMode(mode: ArchiveViewMode): void {
    this.taskViewMode.set(mode);
  }

  /** Dreht die Sortierung der Projekte nach ihrem Statusdatum um. */
  toggleProjectSort(): void {
    this.projectsNewestFirst.update((current) => !current);
  }

  /** Dreht die Sortierung der Aufgaben nach ihrem Abschlussdatum um. */
  toggleTaskSort(): void {
    this.tasksNewestFirst.update((current) => !current);
  }

  /** Öffnet ein archiviertes Projekt schreibgeschützt im bestehenden Board. */
  openProject(project: WorkspaceProject): Promise<boolean> {
    return this.router.navigate(['/projects', project.id, 'board']);
  }

  /** Öffnet die vollständige Task-Sidebar direkt im Archiv. */
  protected openTask(entry: ArchivedTaskEntry): void {
    this.selectedTask.set(structuredClone(entry.task));
  }

  /** Schließt die Task-Sidebar im Archiv. */
  protected closeTask(): void {
    this.selectedTask.set(null);
  }

  /** Synchronisiert die lokale Auswahl nach Änderungen in der Sidebar. */
  protected updateSelectedTask(task: WorkspaceTask): void {
    this.selectedTask.set(structuredClone(task));
  }

  /** Formatiert einen ISO-Zeitpunkt. */
  formatDate(value: string | null, withTime = false): string {
    if (!value) {
      return '—';
    }

    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };

    if (withTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return new Intl.DateTimeFormat('de-DE', options).format(new Date(value));
  }

  /** Liefert den sichtbaren Status eines abgeschlossenen oder archivierten Projekts. */
  getProjectStatusLabel(project: WorkspaceProject): string {
    return project.status === 'archived' ? 'Archiviert' : 'Abgeschlossen';
  }

  /** Liefert die Datumsbezeichnung passend zum Projektstatus. */
  getProjectDateLabel(project: WorkspaceProject): string {
    return project.status === 'archived' ? 'Archiviert am' : 'Erledigt am';
  }

  /** Liefert das passende Statussymbol eines Projekts. */
  getProjectStatusIcon(project: WorkspaceProject): string {
    return project.status === 'archived' ? 'inventory_2' : 'task_alt';
  }

  /** Liefert den relevanten Lifecycle-Zeitpunkt für Sortierung und Darstellung. */
  getProjectLifecycleDate(project: WorkspaceProject): string | null {
    return project.status === 'archived'
      ? (project.archivedAt ?? project.updatedAt)
      : project.completedAt;
  }

  /** Liefert alle Projektmitglieder ohne den Owner und ohne Duplikate. */
  getProjectTeam(project: WorkspaceProject): WorkspaceMember[] {
    return this.uniqueMembers([...project.managers, ...project.collaborators]).filter(
      (member) => member.id !== project.owner.id,
    );
  }

  /** Liefert alle an einer Aufgabe beteiligten Personen ohne den Owner. */
  getTaskTeam(task: WorkspaceTask): WorkspaceMember[] {
    return this.uniqueMembers([
      ...(task.assignee ? [task.assignee] : []),
      ...task.collaborators,
      ...task.subtasks.flatMap((subtask) => (subtask.assignee ? [subtask.assignee] : [])),
    ]).filter((member) => member.id !== task.owner.id);
  }

  /** Liefert eine lesbare Prioritätsbezeichnung. */
  getPriorityLabel(task: WorkspaceTask): string {
    return `${task.priority.slice(0, 1).toUpperCase()}${task.priority.slice(1)}`;
  }

  /** Vergleicht zwei optionale Zeitpunkte in der gewählten Richtung. */
  private compareDates(left: string | null, right: string | null, newestFirst: boolean): number {
    const leftTimestamp = new Date(left ?? 0).getTime();
    const rightTimestamp = new Date(right ?? 0).getTime();
    return newestFirst ? rightTimestamp - leftTimestamp : leftTimestamp - rightTimestamp;
  }

  /** Entfernt doppelte Personen anhand ihrer ID. */
  private uniqueMembers(members: WorkspaceMember[]): WorkspaceMember[] {
    return [...new Map(members.map((member) => [member.id, member])).values()];
  }
}
