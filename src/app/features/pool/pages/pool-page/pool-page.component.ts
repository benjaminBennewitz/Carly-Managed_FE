// src/app/features/pool/pages/pool-page/pool-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { WorkspaceTask } from '../../../../core/workspace/workspace.models';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { WorkspaceTaskCardComponent } from '../../../../shared/ui/workspace-task-card/workspace-task-card.component';
import { WorkspaceTaskDrawerComponent } from '../../../../shared/ui/workspace-task-drawer/workspace-task-drawer.component';

@Component({
  selector: 'cm-pool-page',
  imports: [PageHeaderComponent, WorkspaceTaskCardComponent, WorkspaceTaskDrawerComponent],
  templateUrl: './pool-page.component.html',
  styleUrl: './pool-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolPageComponent {
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly selectedTask = signal<WorkspaceTask | null>(null);

  constructor(workspaceService: WorkspacePreviewService) {
    this.workspaceService = workspaceService;
  }

  /** Öffnet die vollständige Task-Sidebar direkt im Pool. */
  protected openTask(task: WorkspaceTask): void {
    this.selectedTask.set(structuredClone(task));
  }

  /** Schließt die Task-Sidebar im Pool. */
  protected closeTask(): void {
    this.selectedTask.set(null);
  }

  /** Synchronisiert die lokale Auswahl nach Änderungen in der Sidebar. */
  protected updateSelectedTask(task: WorkspaceTask): void {
    this.selectedTask.set(structuredClone(task));
  }
}
