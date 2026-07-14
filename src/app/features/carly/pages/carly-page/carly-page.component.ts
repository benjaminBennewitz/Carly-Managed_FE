// src/app/features/carly/pages/carly-page/carly-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'cm-carly-page',
  imports: [PageHeaderComponent],
  templateUrl: './carly-page.component.html',
  styleUrl: './carly-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarlyPageComponent {}
