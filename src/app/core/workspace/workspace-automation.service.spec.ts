// src/app/core/workspace/workspace-automation.service.spec.ts

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceAutomationRule, WorkspaceAutomationRuleSavePayload } from './workspace.models';
import { WorkspaceAutomationService } from './workspace-automation.service';
import { WorkspaceService } from './workspace.service';

const RULE: WorkspaceAutomationRule = {
  id: 'rule-1',
  boardId: 'board-api-1',
  name: 'Erledigte Aufgaben prüfen',
  trigger: 'task.completed',
  conditions: {
    taskScope: 'main_task',
    sourceColumnId: null,
    searchTerm: '',
    dueDateMode: 'any',
  },
  actions: [{ type: 'move_task_tree', targetColumnId: 'column-review' }],
  isActive: true,
  sortOrder: 2,
  createdAt: '2026-07-17T09:00:00.000Z',
  updatedAt: '2026-07-17T09:00:00.000Z',
  version: 3,
};

const PAYLOAD: WorkspaceAutomationRuleSavePayload = {
  ruleId: null,
  name: 'Neue Regel',
  trigger: 'task.created',
  conditions: {
    taskScope: 'any_task',
    sourceColumnId: null,
    searchTerm: 'Frontend',
    dueDateMode: 'any',
  },
  actions: [{ type: 'move_task_tree', targetColumnId: 'column-progress' }],
  isActive: true,
  sortOrder: 1,
};

describe('WorkspaceAutomationService', () => {
  let service: WorkspaceAutomationService;
  let httpTesting: HttpTestingController;
  const workspaceService = {
    getBoardApiId: vi.fn<(boardId: string) => string | null>(),
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    workspaceService.getBoardApiId.mockReset();
    workspaceService.getBoardApiId.mockReturnValue('board-api-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkspaceService, useValue: workspaceService },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WorkspaceAutomationService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /** Lädt einen Regelstand für das angegebene UI-Board. */
  function flushRules(boardId = 'project-1', rules: WorkspaceAutomationRule[] = [RULE]): void {
    expect(service.getRules(boardId)).toEqual([]);
    const request = httpTesting.expectOne(`/api/v1/workspaces/automations/?boardId=board-api-1`);
    expect(request.request.method).toBe('GET');
    request.flush(rules);
  }

  it('lädt Regeln beim ersten Zugriff genau einmal und sortiert sie', () => {
    const earlier = { ...RULE, id: 'rule-0', sortOrder: 0 };
    flushRules('project-1', [RULE, earlier]);

    expect(service.getRules('project-1').map((rule) => rule.id)).toEqual(['rule-0', 'rule-1']);
    service.getRules('project-1');
    httpTesting.expectNone('/api/v1/workspaces/automations/?boardId=board-api-1');
  });

  it('zählt ausschließlich aktive Regeln', () => {
    flushRules('project-1', [RULE, { ...RULE, id: 'rule-2', isActive: false }]);

    expect(service.getActiveRuleCount('project-1')).toBe(1);
  });

  it('erstellt eine Regel optimistisch und persistiert sie mit der Board-UUID', () => {
    flushRules('project-1', []);
    const optimistic = service.saveRule('project-1', PAYLOAD);

    expect(optimistic.name).toBe('Neue Regel');
    expect(service.getRules('project-1')).toContainEqual(optimistic);
    const request = httpTesting.expectOne('/api/v1/workspaces/automations/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.boardId).toBe('board-api-1');
    expect(request.request.body.ruleId).toBeUndefined();

    const saved = { ...optimistic, id: 'rule-new', version: 1 };
    request.flush(saved);
    expect(service.getRules('project-1').some((rule) => rule.id === 'rule-new')).toBe(true);
  });

  it('aktualisiert vorhandene Regeln mit Versionsstand', () => {
    flushRules();

    service.saveRule('project-1', { ...PAYLOAD, ruleId: RULE.id, name: 'Geänderte Regel' });

    const request = httpTesting.expectOne(`/api/v1/workspaces/automations/${RULE.id}/`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.version).toBe(3);
    expect(request.request.body.name).toBe('Geänderte Regel');
    request.flush({ ...RULE, name: 'Geänderte Regel', version: 4 });

    expect(service.getRules('project-1')[0]?.name).toBe('Geänderte Regel');
  });

  it('schaltet und löscht Regeln über versionsgesicherte API-Aufrufe', () => {
    flushRules();

    service.toggleRule('project-1', RULE.id, false);
    expect(service.getRules('project-1')[0]?.isActive).toBe(false);
    const toggleRequest = httpTesting.expectOne(`/api/v1/workspaces/automations/${RULE.id}/`);
    expect(toggleRequest.request.body).toEqual({ isActive: false, version: 3 });
    toggleRequest.flush({ ...RULE, isActive: false, version: 4 });

    service.deleteRule('project-1', RULE.id);
    expect(service.getRules('project-1')).toEqual([]);
    const deleteRequest = httpTesting.expectOne(
      `/api/v1/workspaces/automations/${RULE.id}/?version=4`,
    );
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
  });

  it('verwirft den lokalen Cache eines gelöschten Boards', () => {
    flushRules();
    expect(service.getRules('project-1')).toHaveLength(1);

    service.deleteBoardRules('project-1');
    expect(service.getRules('project-1')).toEqual([]);
    httpTesting.expectOne('/api/v1/workspaces/automations/?boardId=board-api-1').flush([]);
  });

  it('führt serverseitige Automationen nicht zusätzlich im Browser aus', () => {
    expect(
      service.resolveMoveTarget({
        boardId: 'project-1',
        trigger: 'task.completed',
        task: {} as never,
        sourceColumnId: 'column-progress',
      }),
    ).toBeNull();
  });
});
