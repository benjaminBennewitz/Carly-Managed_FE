// src/app/features/projects/pages/projects-page/projects-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-projects-page',
  imports: [PageHeaderComponent],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {}
