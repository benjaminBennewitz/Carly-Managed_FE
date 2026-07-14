// src/app/features/legal/pages/privacy-page/privacy-page.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LEGAL_PROVIDER } from '../../../../core/legal/legal.config';
import { LegalLayoutComponent } from '../../../../core/layout/legal-layout/legal-layout.component';

@Component({
  selector: 'cm-privacy-page',
  imports: [LegalLayoutComponent],
  templateUrl: './privacy-page.component.html',
  styleUrl: './privacy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent {
  protected readonly provider = LEGAL_PROVIDER;
}
