// src/app/features/projects/pages/projects-page/projects-page.component.ts

import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ProjectDueState, WorkspaceProject } from '../../../../core/workspace/workspace.models';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';

@Component({
  selector: 'cm-projects-page',
  imports: [RouterLink],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly projects;
  protected readonly collaborativeProjects;
  protected readonly lastOpenedProject;
  protected readonly myOpenProjects = computed(() =>
    this.workspaceService
      .projects()
      .filter((project) => this.workspaceService.getOpenTaskCount(project.id) > 0),
  );

  constructor(
    workspaceService: WorkspacePreviewService,
    private readonly router: Router,
  ) {
    this.workspaceService = workspaceService;
    this.projects = workspaceService.projects;
    this.collaborativeProjects = workspaceService.collaborativeProjects;
    this.lastOpenedProject = workspaceService.lastOpenedProject;
  }

  /**
   * Erstellt ein neues lokales Projekt und öffnet dessen Board.
   */
  createProject(): void {
    const project = this.workspaceService.createProject();
    void this.openProject(project);
  }

  /**
   * Öffnet das Board eines Projekts.
   */
  openProject(project: WorkspaceProject): Promise<boolean> {
    this.workspaceService.markProjectOpened(project.id);
    return this.router.navigate(['/projects', project.id, 'board']);
  }

  /**
   * Pinnt oder entpinnt eine Projektkarte.
   */
  togglePinned(event: MouseEvent, project: WorkspaceProject): void {
    event.stopPropagation();
    this.workspaceService.toggleProjectPinned(project.id);
  }

  /**
   * Liefert die CSS-Klasse eines Fälligkeitszustands.
   */
  getDueStateClass(state: ProjectDueState): string {
    return `project-card--due-${state}`;
  }

  /**
   * Formatiert ein ISO-Datum oder einen ISO-Zeitpunkt.
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
   * Liefert den sichtbaren Projektzeitraum.
   */
  getScheduleLabel(project: WorkspaceProject): string {
    return `${this.formatDate(project.startedAt)} – ${this.formatDate(project.dueAt)}`;
  }

  /**
   * Liefert die Anzahl aller Mitglieder ohne Duplikate.
   */
  getMemberCount(project: WorkspaceProject): number {
    return new Set([...project.managers, ...project.collaborators].map((member) => member.id)).size;
  }
}
