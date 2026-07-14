// src/app/app.routes.ts

import { Routes } from '@angular/router';

import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'datenschutz',
    title: 'Datenschutz | Carly Managed',
    loadComponent: () =>
      import('./features/legal/pages/privacy-page/privacy-page.component').then(
        (module) => module.PrivacyPageComponent,
      ),
  },
  {
    path: 'impressum',
    title: 'Impressum | Carly Managed',
    loadComponent: () =>
      import('./features/legal/pages/imprint-page/imprint-page.component').then(
        (module) => module.ImprintPageComponent,
      ),
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./core/layout/auth-layout/auth-layout.component').then(
        (module) => module.AuthLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login',
      },
      {
        path: 'login',
        title: 'Anmelden | Carly Managed',
        loadComponent: () =>
          import('./features/auth/pages/login-page/login-page.component').then(
            (module) => module.LoginPageComponent,
          ),
      },
      {
        path: 'register',
        title: 'Registrieren | Carly Managed',
        loadComponent: () =>
          import('./features/auth/pages/register-page/register-page.component').then(
            (module) => module.RegisterPageComponent,
          ),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/app-shell/app-shell.component').then(
        (module) => module.AppShellComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        title: 'Dashboard | Carly Managed',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
            (module) => module.DashboardPageComponent,
          ),
      },
      {
        path: 'projects',
        title: 'Projekte | Carly Managed',
        loadComponent: () =>
          import('./features/projects/pages/projects-page/projects-page.component').then(
            (module) => module.ProjectsPageComponent,
          ),
      },
      {
        path: 'projects/:projectId/board',
        title: 'Projektboard | Carly Managed',
        loadComponent: () =>
          import('./features/board/pages/board-page/board-page.component').then(
            (module) => module.BoardPageComponent,
          ),
      },
      {
        path: 'board',
        title: 'Board | Carly Managed',
        loadComponent: () =>
          import('./features/board/pages/board-page/board-page.component').then(
            (module) => module.BoardPageComponent,
          ),
      },
      {
        path: 'members',
        title: 'Mitglieder | Carly Managed',
        loadComponent: () =>
          import('./features/members/pages/members-page/members-page.component').then(
            (module) => module.MembersPageComponent,
          ),
      },
      {
        path: 'inbox',
        title: 'Inbox | Carly Managed',
        loadComponent: () =>
          import('./features/inbox/pages/inbox-page/inbox-page.component').then(
            (module) => module.InboxPageComponent,
          ),
      },
      {
        path: 'pool',
        title: 'Pool | Carly Managed',
        loadComponent: () =>
          import('./features/pool/pages/pool-page/pool-page.component').then(
            (module) => module.PoolPageComponent,
          ),
      },
      {
        path: 'archive',
        title: 'Archiv | Carly Managed',
        loadComponent: () =>
          import('./features/archive/pages/archive-page/archive-page.component').then(
            (module) => module.ArchivePageComponent,
          ),
      },
      {
        path: 'carly',
        title: 'Carly | Carly Managed',
        loadComponent: () =>
          import('./features/carly/pages/carly-page/carly-page.component').then(
            (module) => module.CarlyPageComponent,
          ),
      },
      {
        path: 'settings',
        title: 'Einstellungen | Carly Managed',
        loadComponent: () =>
          import('./features/settings/pages/settings-page/settings-page.component').then(
            (module) => module.SettingsPageComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
