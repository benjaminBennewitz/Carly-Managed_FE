// src/app/core/demo/demo-data.service.ts

import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { finalize, Observable, tap } from 'rxjs';

import { API_BASE_URL } from '../api/api.config';

export interface DemoDataStatus {
  enabled: boolean;
  canReset: boolean;
  workspaceName: string;
}

export interface DemoDataResetResult {
  workspaceId: string;
  workspaceName: string;
  projects: number;
  tasks: number;
  members: number;
  notifications: number;
}

@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly statusState = signal<DemoDataStatus>({
    enabled: false,
    canReset: false,
    workspaceName: 'Carly Managed Demo',
  });
  private readonly pendingState = signal(false);

  readonly status = this.statusState.asReadonly();
  readonly pending = this.pendingState.asReadonly();

  constructor(private readonly http: HttpClient) {
    this.reloadStatus();
  }

  /** Prüft, ob der angemeldete Staff-Nutzer Testdaten zurücksetzen darf. */
  reloadStatus(): void {
    this.http.get<DemoDataStatus>(`${API_BASE_URL}/demo/status/`).subscribe({
      next: (status) => this.statusState.set(status),
      error: () =>
        this.statusState.set({
          enabled: false,
          canReset: false,
          workspaceName: 'Carly Managed Demo',
        }),
    });
  }

  /** Setzt ausschließlich den abgegrenzten Demo-Workspace atomar zurück. */
  reset(): Observable<DemoDataResetResult> {
    this.pendingState.set(true);
    return this.http.post<DemoDataResetResult>(`${API_BASE_URL}/demo/reset/`, {}).pipe(
      tap(() => this.reloadStatus()),
      finalize(() => this.pendingState.set(false)),
    );
  }
}
