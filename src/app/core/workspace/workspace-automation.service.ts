// src/app/core/workspace/workspace-automation.service.ts

import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

import { API_BASE_URL } from '../api/api.config';
import { PaginatedResponse, unwrapCollection } from '../api/api.models';
import {
  WorkspaceAutomationRule,
  WorkspaceAutomationRuleSavePayload,
  WorkspaceAutomationTrigger,
  WorkspaceTask,
} from './workspace.models';
import { WorkspaceService } from './workspace.service';

export interface WorkspaceAutomationEvent {
  boardId: string;
  trigger: WorkspaceAutomationTrigger;
  task: WorkspaceTask;
  sourceColumnId: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceAutomationService {
  private readonly rulesState = signal<Record<string, WorkspaceAutomationRule[]>>({});
  private readonly loadedBoards = new Set<string>();

  constructor(
    private readonly http: HttpClient,
    private readonly workspaceService: WorkspaceService,
  ) {}

  /** Liefert Regeln und stößt bei Bedarf den API-Abruf an. */
  getRules(boardId: string): WorkspaceAutomationRule[] {
    this.ensureLoaded(boardId);
    return [...(this.rulesState()[boardId] ?? [])].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );
  }

  /** Liefert die Anzahl aktiver Regeln. */
  getActiveRuleCount(boardId: string): number {
    return this.getRules(boardId).filter((rule) => rule.isActive).length;
  }

  /** Erstellt oder aktualisiert eine serverseitige Regel. */
  saveRule(boardId: string, payload: WorkspaceAutomationRuleSavePayload): WorkspaceAutomationRule {
    const existing = payload.ruleId
      ? (this.getRules(boardId).find((rule) => rule.id === payload.ruleId) ?? null)
      : null;
    const boardApiId = this.workspaceService.getBoardApiId(boardId);
    const now = new Date().toISOString();
    const optimistic: WorkspaceAutomationRule = {
      id: existing?.id ?? crypto.randomUUID(),
      boardId: boardApiId ?? boardId,
      name: payload.name.trim(),
      trigger: payload.trigger,
      conditions: payload.conditions,
      actions: payload.actions,
      isActive: payload.isActive,
      sortOrder: payload.sortOrder,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: existing?.version ?? 1,
    };
    this.replaceRule(boardId, optimistic);

    if (!boardApiId) return optimistic;
    const { ruleId: _ruleId, ...writePayload } = payload;
    const request = existing
      ? this.http.patch<WorkspaceAutomationRule>(
          `${API_BASE_URL}/workspaces/automations/${existing.id}/`,
          { ...writePayload, boardId: boardApiId, version: existing.version ?? 1 },
        )
      : this.http.post<WorkspaceAutomationRule>(`${API_BASE_URL}/workspaces/automations/`, {
          ...writePayload,
          boardId: boardApiId,
        });
    request.subscribe({
      next: (rule) => this.replaceRule(boardId, rule),
      error: () => this.reload(boardId),
    });
    return optimistic;
  }

  /** Aktiviert oder deaktiviert eine Regel. */
  toggleRule(boardId: string, ruleId: string, isActive: boolean): void {
    const rule = this.getRules(boardId).find((item) => item.id === ruleId);
    if (!rule) return;
    this.replaceRule(boardId, { ...rule, isActive });
    this.http
      .patch<WorkspaceAutomationRule>(`${API_BASE_URL}/workspaces/automations/${ruleId}/`, {
        isActive,
        version: rule.version ?? 1,
      })
      .subscribe({
        next: (saved) => this.replaceRule(boardId, saved),
        error: () => this.reload(boardId),
      });
  }

  /** Löscht eine einzelne Regel. */
  deleteRule(boardId: string, ruleId: string): void {
    const rule = this.getRules(boardId).find((item) => item.id === ruleId);
    if (!rule) return;
    this.rulesState.update((rules) => ({
      ...rules,
      [boardId]: (rules[boardId] ?? []).filter((item) => item.id !== ruleId),
    }));
    this.http
      .delete<void>(
        `${API_BASE_URL}/workspaces/automations/${ruleId}/?version=${rule.version ?? 1}`,
      )
      .subscribe({ error: () => this.reload(boardId) });
  }

  /** Entfernt den lokalen Regelcache eines gelöschten Boards. */
  deleteBoardRules(boardId: string): void {
    this.rulesState.update((rules) => {
      const next = { ...rules };
      delete next[boardId];
      return next;
    });
    this.loadedBoards.delete(boardId);
  }

  /** Serverautomationen werden nicht zusätzlich im Browser ausgeführt. */
  resolveMoveTarget(_event: WorkspaceAutomationEvent): string | null {
    return null;
  }

  /** Lädt Regeln beim ersten Zugriff. */
  private ensureLoaded(boardId: string): void {
    if (this.loadedBoards.has(boardId)) return;
    this.loadedBoards.add(boardId);
    this.reload(boardId);
  }

  /** Lädt die Regeln eines Boards neu. */
  private reload(boardId: string): void {
    const boardApiId = this.workspaceService.getBoardApiId(boardId);
    if (!boardApiId) return;
    this.http
      .get<WorkspaceAutomationRule[] | PaginatedResponse<WorkspaceAutomationRule>>(
        `${API_BASE_URL}/workspaces/automations/?boardId=${boardApiId}`,
      )
      .subscribe({
        next: (response) =>
          this.rulesState.update((rules) => ({
            ...rules,
            [boardId]: unwrapCollection(response),
          })),
      });
  }

  /** Ersetzt eine Regel im lokalen Cache. */
  private replaceRule(boardId: string, rule: WorkspaceAutomationRule): void {
    this.rulesState.update((rules) => {
      const current = rules[boardId] ?? [];
      return {
        ...rules,
        [boardId]: current.some((item) => item.id === rule.id)
          ? current.map((item) => (item.id === rule.id ? rule : item))
          : [...current, rule],
      };
    });
  }
}
