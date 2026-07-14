// src/app/features/legal/pages/imprint-page/imprint-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LEGAL_PROVIDER } from '../../../../core/legal/legal.config';
import { LegalLayoutComponent } from '../../../../core/layout/legal-layout/legal-layout.component';

@Component({
  selector: 'cm-imprint-page',
  imports: [LegalLayoutComponent],
  templateUrl: './imprint-page.component.html',
  styleUrl: './imprint-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImprintPageComponent {
  protected readonly provider = LEGAL_PROVIDER;
}
