// src/app/features/dashboard/pages/dashboard-page/dashboard-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-dashboard-page',
  imports: [PageHeaderComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent {}
