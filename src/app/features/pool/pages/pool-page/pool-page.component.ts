// src/app/features/pool/pages/pool-page/pool-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-pool-page',
  imports: [PageHeaderComponent],
  templateUrl: './pool-page.component.html',
  styleUrl: './pool-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolPageComponent {}
