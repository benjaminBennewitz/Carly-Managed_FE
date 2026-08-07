// src/app/features/members/pages/invite-page/invite-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { WorkspaceService } from '../../../../core/workspace/workspace.service';

type InviteState = 'pending' | 'error';

@Component({
  selector: 'cm-invite-page',
  imports: [RouterLink],
  templateUrl: './invite-page.component.html',
  styleUrl: './invite-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitePageComponent {
  protected readonly state = signal<InviteState>('pending');
  protected readonly pending = signal(true);

  constructor(
    route: ActivatedRoute,
    private readonly router: Router,
    private readonly workspaceService: WorkspaceService,
  ) {
    const fragmentToken = new URLSearchParams(route.snapshot.fragment ?? '').get('token');
    const queryToken = route.snapshot.queryParamMap.get('token');
    const token = fragmentToken ?? queryToken;

    if (!token) {
      this.pending.set(false);
      this.state.set('error');
      return;
    }

    this.workspaceService
      .acceptInvitationToken(token)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/members']),
        error: () => this.state.set('error'),
      });
  }
}
