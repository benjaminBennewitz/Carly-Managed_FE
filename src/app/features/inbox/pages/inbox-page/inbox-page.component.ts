// src/app/features/inbox/pages/inbox-page/inbox-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-inbox-page',
  imports: [PageHeaderComponent],
  templateUrl: './inbox-page.component.html',
  styleUrl: './inbox-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPageComponent {}
