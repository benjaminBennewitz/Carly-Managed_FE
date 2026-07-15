// src/app/core/workspace/workspace-automation.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkspaceAutomationService } from './workspace-automation.service';
import { WorkspaceTask } from './workspace.models';

const TASK: WorkspaceTask = {
  id: 'task-test',
  title: 'Review vorbereiten',
  description: 'Frontend prüfen',
  projectId: 'carly-managed',
  projectTitle: 'Carly Managed',
  projectAllowsOnDemandTasks: true,
  parentTaskId: null,
  owner: {
    id: 'member-ben',
    fullName: 'Benjamin Bennewitz',
    email: 'demo@carly.local',
    initials: 'BB',
    avatarColor: '#7752B3',
    avatarTextColor: '#FFFFFF',
    role: 'owner',
    isOnline: true,
  },
  assignee: null,
  collaborators: [],
  priority: 'mittel',
  startDate: null,
  dueDate: null,
  dueTime: null,
  tags: ['Frontend'],
  subtasks: [],
  comments: [],
  attachments: [],
  history: [],
  subtaskCount: 0,
  completedSubtaskCount: 0,
  commentCount: 0,
  attachmentCount: 0,
  isRecurring: false,
  recurrenceLabel: null,
  recurrenceRule: null,
  isDone: false,
  completedAt: null,
  isSharedPool: false,
  requiresReview: false,
  reviewHint: null,
  createdOutsideColumn: false,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

describe('WorkspaceAutomationService', () => {
  let service: WorkspaceAutomationService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkspaceAutomationService);
  });

  it('liefert die vorbereiteten Projektregeln', () => {
    expect(service.getRules('carly-managed')).toHaveLength(2);
    expect(service.getActiveRuleCount('carly-managed')).toBe(2);
  });

  it('speichert und aktualisiert Regeln pro Board', () => {
    const created = service.saveRule('studio-operations', {
      ruleId: null,
      name: 'Frontend nach Review',
      trigger: 'task.created',
      conditions: {
        taskScope: 'main_task',
        sourceColumnId: null,
        searchTerm: 'Frontend',
        dueDateMode: 'any',
      },
      actions: [{ type: 'move_task_tree', targetColumnId: 'studio-progress' }],
      isActive: true,
      sortOrder: 0,
    });

    service.toggleRule('studio-operations', created.id, false);

    expect(service.getRules('studio-operations')[0]?.isActive).toBe(false);
  });

  it('entfernt alle Regeln eines gelöschten Boardkontexts', () => {
    expect(service.getActiveRuleCount('carly-managed')).toBeGreaterThan(0);

    service.deleteBoardRules('carly-managed');

    expect(service.getRules('carly-managed')).toEqual([]);
    expect(service.getActiveRuleCount('carly-managed')).toBe(0);
  });

  it('ermittelt für passende Ereignisse die Zielspalte', () => {
    const target = service.resolveMoveTarget({
      boardId: 'carly-managed',
      trigger: 'task.completed',
      task: { ...TASK, isDone: true },
      sourceColumnId: 'progress',
    });

    expect(target).toBe('review');
  });

  it('beachtet Suchbegriffe und Quellspalten', () => {
    const created = service.saveRule('test-board', {
      ruleId: null,
      name: 'Frontend verschieben',
      trigger: 'column.entered',
      conditions: {
        taskScope: 'main_task',
        sourceColumnId: 'source',
        searchTerm: 'Frontend',
        dueDateMode: 'without_date',
      },
      actions: [{ type: 'move_task_tree', targetColumnId: 'target' }],
      isActive: true,
      sortOrder: 0,
    });

    expect(created.id).toBeTruthy();
    expect(
      service.resolveMoveTarget({
        boardId: 'test-board',
        trigger: 'column.entered',
        task: TASK,
        sourceColumnId: 'source',
      }),
    ).toBe('target');
    expect(
      service.resolveMoveTarget({
        boardId: 'test-board',
        trigger: 'column.entered',
        task: TASK,
        sourceColumnId: 'other',
      }),
    ).toBeNull();
  });
});
