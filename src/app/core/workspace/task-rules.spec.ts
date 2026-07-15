// src/app/core/workspace/task-rules.spec.ts

import { describe, expect, it } from 'vitest';

import {
  canClaimPoolTask,
  isTaskAssigneeRequired,
  isTaskDueDateRequired,
  releaseTaskToPool,
  validateWorkspaceTask,
} from './task-rules';
import { WorkspaceMember, WorkspaceTask } from './workspace.models';

const member: WorkspaceMember = {
  id: 'member-1',
  fullName: 'Test Person',
  email: 'test@example.local',
  initials: 'TP',
  avatarColor: '#7752B3',
  avatarTextColor: '#FFFFFF',
  role: 'owner',
  isOnline: true,
};

function createTask(overrides: Partial<WorkspaceTask> = {}): WorkspaceTask {
  return {
    id: 'task-1',
    title: 'Testaufgabe',
    description: '',
    projectId: 'project-1',
    projectTitle: 'Projekt',
    projectAllowsOnDemandTasks: false,
    parentTaskId: null,
    owner: member,
    assignee: member,
    collaborators: [],
    priority: 'mittel',
    startDate: null,
    dueDate: '2026-07-20',
    dueTime: null,
    tags: [],
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
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('task-rules', () => {
  it('verlangt bei normalen Aufgaben Assignee und Fälligkeit', () => {
    const task = createTask({ assignee: null, dueDate: null });

    expect(isTaskAssigneeRequired(task)).toBe(true);
    expect(isTaskDueDateRequired(task)).toBe(true);
    expect(validateWorkspaceTask(task).map((error) => error.field)).toEqual([
      'assignee',
      'dueDate',
    ]);
  });

  it('erlaubt Abruf-Aufgaben zunächst ohne Assignee und Fälligkeit', () => {
    const task = createTask({
      projectAllowsOnDemandTasks: true,
      assignee: null,
      dueDate: null,
    });

    expect(isTaskAssigneeRequired(task)).toBe(false);
    expect(isTaskDueDateRequired(task)).toBe(false);
    expect(validateWorkspaceTask(task)).toEqual([]);
  });

  it('entfernt bei Pool-Freigabe die Zuweisung', () => {
    const releasedTask = releaseTaskToPool(createTask());

    expect(releasedTask.assignee).toBeNull();
    expect(releasedTask.isSharedPool).toBe(true);
  });

  it('erlaubt die Pool-Übernahme nur bei vollständiger Terminierung', () => {
    const incompleteTask = createTask({
      projectAllowsOnDemandTasks: true,
      assignee: null,
      isSharedPool: true,
      dueDate: null,
    });
    const completeTask = { ...incompleteTask, dueDate: '2026-07-20' };

    expect(canClaimPoolTask(incompleteTask)).toBe(false);
    expect(canClaimPoolTask(completeTask)).toBe(true);
  });
});
