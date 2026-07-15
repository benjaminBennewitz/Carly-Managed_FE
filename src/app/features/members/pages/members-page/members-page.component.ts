// src/app/features/members/pages/members-page/members-page.component.ts

import { ChangeDetectionStrategy, Component, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { WorkspaceMember } from '../../../../core/workspace/workspace.models';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-members-page',
  imports: [PageHeaderComponent],
  templateUrl: './members-page.component.html',
  styleUrl: './members-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPageComponent {
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly selectedMemberId = signal<string | null>(null);

  constructor(
    workspaceService: WorkspacePreviewService,
    route: ActivatedRoute,
    destroyRef: DestroyRef,
  ) {
    this.workspaceService = workspaceService;
    route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      this.selectedMemberId.set(params.get('member'));
    });
  }

  /** Liefert die persönliche Rollenbezeichnung eines Mitglieds. */
  getRoleLabel(member: WorkspaceMember): string {
    if (member.role === 'owner') return 'Owner';
    if (member.role === 'manager') return 'Manager';
    return 'Mitglied';
  }
}
