// src/app/features/pool/pages/pool-page/pool-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';

import { WorkspaceTask } from '../../../../core/workspace/workspace.models';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { WorkspaceTaskCardComponent } from '../../../../shared/ui/workspace-task-card/workspace-task-card.component';

@Component({
  selector: 'cm-pool-page',
  imports: [PageHeaderComponent, WorkspaceTaskCardComponent],
  templateUrl: './pool-page.component.html',
  styleUrl: './pool-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolPageComponent {
  protected readonly workspaceService: WorkspacePreviewService;

  constructor(
    workspaceService: WorkspacePreviewService,
    private readonly router: Router,
  ) {
    this.workspaceService = workspaceService;
  }

  /** Öffnet die vollständige Task-Sidebar im zugehörigen Board. */
  openTask(task: WorkspaceTask): Promise<boolean> {
    const commands = task.projectId ? ['/projects', task.projectId, 'board'] : ['/board'];
    return this.router.navigate(commands, { queryParams: { task: task.id } });
  }
}
