// src/app/core/layout/app-shell/app-shell.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { PrimaryNavigationComponent } from '../primary-navigation/primary-navigation.component';

@Component({
  selector: 'cm-app-shell',
  imports: [PrimaryNavigationComponent, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {}
