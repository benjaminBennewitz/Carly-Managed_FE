// src/app/core/workspace/workspace-automation.service.ts

import { Injectable, signal } from '@angular/core';

import {
  WorkspaceAutomationRule,
  WorkspaceAutomationRuleSavePayload,
  WorkspaceAutomationTrigger,
  WorkspaceTask,
} from './workspace.models';

const WORKSPACE_AUTOMATION_STORAGE_KEY = 'carly-managed-preview-automation-rules-v1';
const DUE_SOON_DAYS = 3;

export interface WorkspaceAutomationEvent {
  boardId: string;
  trigger: WorkspaceAutomationTrigger;
  task: WorkspaceTask;
  sourceColumnId: string | null;
}

const INITIAL_RULES: Record<string, WorkspaceAutomationRule[]> = {
  'carly-managed': [
    {
      id: 'automation-carly-completed-review',
      boardId: 'carly-managed',
      name: 'Erledigte Aufgaben in Review verschieben',
      trigger: 'task.completed',
      conditions: {
        taskScope: 'main_task',
        sourceColumnId: null,
        searchTerm: '',
        dueDateMode: 'any',
      },
      actions: [{ type: 'move_task_tree', targetColumnId: 'review' }],
      isActive: true,
      sortOrder: 0,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
    },
    {
      id: 'automation-carly-reopened-open',
      boardId: 'carly-managed',
      name: 'Wieder geöffnete Aufgaben nach Offen verschieben',
      trigger: 'task.reopened',
      conditions: {
        taskScope: 'main_task',
        sourceColumnId: 'review',
        searchTerm: '',
        dueDateMode: 'any',
      },
      actions: [{ type: 'move_task_tree', targetColumnId: 'todo' }],
      isActive: true,
      sortOrder: 1,
      createdAt: '2026-07-01T10:05:00.000Z',
      updatedAt: '2026-07-01T10:05:00.000Z',
    },
  ],
  personal: [
    {
      id: 'automation-personal-completed',
      boardId: 'personal',
      name: 'Erledigte Aufgaben einsortieren',
      trigger: 'task.completed',
      conditions: {
        taskScope: 'main_task',
        sourceColumnId: null,
        searchTerm: '',
        dueDateMode: 'any',
      },
      actions: [{ type: 'move_task_tree', targetColumnId: 'personal-done' }],
      isActive: true,
      sortOrder: 0,
      createdAt: '2026-07-01T10:10:00.000Z',
      updatedAt: '2026-07-01T10:10:00.000Z',
    },
  ],
  'portfolio-relaunch': [
    {
      id: 'automation-portfolio-completed',
      boardId: 'portfolio-relaunch',
      name: 'Erledigte Aufgaben abschließen',
      trigger: 'task.completed',
      conditions: {
        taskScope: 'main_task',
        sourceColumnId: null,
        searchTerm: '',
        dueDateMode: 'any',
      },
      actions: [{ type: 'move_task_tree', targetColumnId: 'portfolio-done' }],
      isActive: true,
      sortOrder: 0,
      createdAt: '2026-07-01T10:15:00.000Z',
      updatedAt: '2026-07-01T10:15:00.000Z',
    },
  ],
};

function cloneRule(rule: WorkspaceAutomationRule): WorkspaceAutomationRule {
  return {
    ...rule,
    conditions: { ...rule.conditions },
    actions: rule.actions.map((action) => ({ ...action })),
  };
}

function cloneRuleMap(
  rules: Record<string, WorkspaceAutomationRule[]>,
): Record<string, WorkspaceAutomationRule[]> {
  return Object.fromEntries(
    Object.entries(rules).map(([boardId, boardRules]) => [boardId, boardRules.map(cloneRule)]),
  );
}

function loadRules(): Record<string, WorkspaceAutomationRule[]> {
  try {
    const storedRules = window.localStorage.getItem(WORKSPACE_AUTOMATION_STORAGE_KEY);
    if (!storedRules) {
      return cloneRuleMap(INITIAL_RULES);
    }

    return cloneRuleMap(JSON.parse(storedRules) as Record<string, WorkspaceAutomationRule[]>);
  } catch {
    return cloneRuleMap(INITIAL_RULES);
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceAutomationService {
  private readonly rulesState = signal<Record<string, WorkspaceAutomationRule[]>>(loadRules());

  /** Liefert alle Regeln eines persönlichen oder projektbezogenen Boards. */
  getRules(boardId: string): WorkspaceAutomationRule[] {
    return [...(this.rulesState()[boardId] ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(cloneRule);
  }

  /** Liefert die Anzahl der aktiven Regeln eines Boards. */
  getActiveRuleCount(boardId: string): number {
    return (this.rulesState()[boardId] ?? []).filter((rule) => rule.isActive).length;
  }

  /** Erstellt oder aktualisiert eine Regel im aktuellen Boardkontext. */
  saveRule(boardId: string, payload: WorkspaceAutomationRuleSavePayload): WorkspaceAutomationRule {
    const now = new Date().toISOString();
    const existingRule = payload.ruleId
      ? ((this.rulesState()[boardId] ?? []).find((rule) => rule.id === payload.ruleId) ?? null)
      : null;
    const savedRule: WorkspaceAutomationRule = {
      id: existingRule?.id ?? `automation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      boardId,
      name: payload.name.trim().slice(0, 180),
      trigger: payload.trigger,
      conditions: { ...payload.conditions },
      actions: payload.actions.map((action) => ({ ...action })),
      isActive: payload.isActive,
      sortOrder: existingRule?.sortOrder ?? payload.sortOrder,
      createdAt: existingRule?.createdAt ?? now,
      updatedAt: now,
    };

    this.rulesState.update((rules) => {
      const boardRules = rules[boardId] ?? [];
      const nextBoardRules = existingRule
        ? boardRules.map((rule) => (rule.id === savedRule.id ? savedRule : rule))
        : [...boardRules, savedRule];

      return { ...rules, [boardId]: nextBoardRules };
    });
    this.persistRules();
    return cloneRule(savedRule);
  }

  /** Schaltet eine Regel aktiv oder inaktiv. */
  toggleRule(boardId: string, ruleId: string, isActive: boolean): void {
    this.rulesState.update((rules) => ({
      ...rules,
      [boardId]: (rules[boardId] ?? []).map((rule) =>
        rule.id === ruleId ? { ...rule, isActive, updatedAt: new Date().toISOString() } : rule,
      ),
    }));
    this.persistRules();
  }

  /** Löscht eine Regel aus einem Boardkontext. */
  deleteRule(boardId: string, ruleId: string): void {
    this.rulesState.update((rules) => ({
      ...rules,
      [boardId]: (rules[boardId] ?? []).filter((rule) => rule.id !== ruleId),
    }));
    this.persistRules();
  }

  /** Entfernt sämtliche Regeln eines dauerhaft gelöschten Boardkontexts. */
  deleteBoardRules(boardId: string): void {
    this.rulesState.update((rules) => {
      const nextRules = { ...rules };
      delete nextRules[boardId];
      return nextRules;
    });
    this.persistRules();
  }

  /** Ermittelt die erste passende Zielspalte einer aktiven Verschieberegel. */
  resolveMoveTarget(event: WorkspaceAutomationEvent): string | null {
    const matchingRule = (this.rulesState()[event.boardId] ?? [])
      .filter((rule) => rule.isActive)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .find((rule) => this.matchesRule(rule, event));

    const targetColumnId = matchingRule?.actions.find(
      (action) => action.type === 'move_task_tree',
    )?.targetColumnId;

    return targetColumnId && targetColumnId !== event.sourceColumnId ? targetColumnId : null;
  }

  /** Prüft Trigger und Bedingungen einer Regel gegen ein Workspace-Ereignis. */
  private matchesRule(rule: WorkspaceAutomationRule, event: WorkspaceAutomationEvent): boolean {
    if (rule.trigger !== event.trigger) {
      return false;
    }

    if (rule.conditions.taskScope === 'main_task' && event.task.parentTaskId !== null) {
      return false;
    }

    if (
      rule.conditions.sourceColumnId !== null &&
      rule.conditions.sourceColumnId !== event.sourceColumnId
    ) {
      return false;
    }

    const searchTerm = rule.conditions.searchTerm.trim().toLocaleLowerCase('de');
    if (searchTerm) {
      const searchableText = [event.task.title, event.task.description, ...event.task.tags]
        .join(' ')
        .toLocaleLowerCase('de');
      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }

    return this.matchesDueDate(rule.conditions.dueDateMode, event.task.dueDate);
  }

  /** Prüft den optionalen Datumsfilter einer Regel. */
  private matchesDueDate(
    mode: WorkspaceAutomationRule['conditions']['dueDateMode'],
    dueDate: string | null,
  ): boolean {
    if (mode === 'any') {
      return true;
    }

    if (mode === 'without_date') {
      return dueDate === null;
    }

    if (!dueDate) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayValue = today.toISOString().slice(0, 10);

    if (mode === 'today') {
      return dueDate === todayValue;
    }

    if (mode === 'overdue') {
      return dueDate < todayValue;
    }

    const dueSoonLimit = new Date(today);
    dueSoonLimit.setDate(dueSoonLimit.getDate() + DUE_SOON_DAYS);
    return dueDate > todayValue && dueDate <= dueSoonLimit.toISOString().slice(0, 10);
  }

  /** Speichert sämtliche Regeln im lokalen Browser-Speicher. */
  private persistRules(): void {
    try {
      window.localStorage.setItem(
        WORKSPACE_AUTOMATION_STORAGE_KEY,
        JSON.stringify(this.rulesState()),
      );
    } catch {
      // Der Regelbaukasten bleibt ohne Browser-Speicher in der Sitzung funktionsfähig.
    }
  }
}
