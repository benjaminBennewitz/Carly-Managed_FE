// src/app/features/archive/pages/archive-page/archive-page.component.ts

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  ArchivedTaskEntry,
  WorkspaceProject,
} from '../../../../core/workspace/workspace.models';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';

type ArchiveViewMode = 'cards' | 'list';

@Component({
  selector: 'cm-archive-page',
  templateUrl: './archive-page.component.html',
  styleUrl: './archive-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivePageComponent {
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly projectViewMode = signal<ArchiveViewMode>('cards');
  protected readonly taskViewMode = signal<ArchiveViewMode>('cards');
  protected readonly newestFirst = signal(true);
  protected readonly sortedProjects = computed(() =>
    [...this.workspaceService.archivedProjects()].sort((left, right) =>
      this.compareDates(left.completedAt, right.completedAt),
    ),
  );
  protected readonly sortedTasks = computed(() =>
    [...this.workspaceService.archivedTasks()].sort((left, right) =>
      this.newestFirst()
        ? new Date(right.archivedAt).getTime() - new Date(left.archivedAt).getTime()
        : new Date(left.archivedAt).getTime() - new Date(right.archivedAt).getTime(),
    ),
  );

  constructor(
    workspaceService: WorkspacePreviewService,
    private readonly router: Router,
  ) {
    this.workspaceService = workspaceService;
  }

  /**
   * Wechselt die Darstellung der archivierten Projekte.
   */
  setProjectViewMode(mode: ArchiveViewMode): void {
    this.projectViewMode.set(mode);
  }

  /**
   * Wechselt die Darstellung des Aufgabenverlaufs.
   */
  setTaskViewMode(mode: ArchiveViewMode): void {
    this.taskViewMode.set(mode);
  }

  /**
   * Dreht die Sortierung des Aufgabenverlaufs um.
   */
  toggleTaskSort(): void {
    this.newestFirst.update((current) => !current);
  }

  /**
   * Öffnet ein archiviertes Projekt schreibgeschützt im bestehenden Board.
   */
  openProject(project: WorkspaceProject): Promise<boolean> {
    return this.router.navigate(['/projects', project.id, 'board']);
  }

  /**
   * Formatiert einen ISO-Zeitpunkt.
   */
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

  /**
   * Liefert den Aufgabentitel aus einem Archiveintrag.
   */
  getTaskTitle(entry: ArchivedTaskEntry): string {
    return entry.task.title;
  }

  /**
   * Vergleicht zwei optionale Abschlusszeitpunkte.
   */
  private compareDates(left: string | null, right: string | null): number {
    return this.newestFirst()
      ? new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime()
      : new Date(left ?? 0).getTime() - new Date(right ?? 0).getTime();
  }
}
