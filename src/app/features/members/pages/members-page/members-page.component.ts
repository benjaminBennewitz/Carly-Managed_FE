// src/app/features/members/pages/members-page/members-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SessionService } from '../../../../core/auth/services/session.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-members-page',
  imports: [PageHeaderComponent],
  templateUrl: './members-page.component.html',
  styleUrl: './members-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPageComponent {
  protected readonly sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }
}
