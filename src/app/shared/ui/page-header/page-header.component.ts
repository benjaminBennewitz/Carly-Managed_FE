// src/app/shared/ui/page-header/page-header.component.ts

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'cm-page-header',
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
}
