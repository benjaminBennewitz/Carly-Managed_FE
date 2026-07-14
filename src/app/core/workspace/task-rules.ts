// src/app/core/workspace/task-rules.ts

import { TaskValidationError, WorkspaceTask } from './workspace.models';

/**
 * Prüft, ob eine Aufgabe ohne direkte Zuweisung als Abruf-Aufgabe bereitliegt.
 */
export function isOnDemandReadyTask(task: WorkspaceTask): boolean {
  return (
    task.projectAllowsOnDemandTasks && !task.parentTaskId && !task.isSharedPool && !task.assignee
  );
}

/**
 * Prüft, ob für eine Aufgabe eine verantwortliche Person verpflichtend ist.
 */
export function isTaskAssigneeRequired(task: WorkspaceTask): boolean {
  return !task.isSharedPool && !task.projectAllowsOnDemandTasks;
}

/**
 * Prüft, ob ein Fälligkeitsdatum verpflichtend ist.
 */
export function isTaskDueDateRequired(task: WorkspaceTask): boolean {
  return !isOnDemandReadyTask(task);
}

/**
 * Prüft, ob eine Aufgabe in den gemeinsamen Pool freigegeben werden darf.
 */
export function canReleaseTaskToPool(task: WorkspaceTask): boolean {
  return !task.isDone && !task.parentTaskId && !task.isSharedPool;
}

/**
 * Prüft, ob eine Aufgabe aus dem Pool übernommen werden darf.
 */
export function canClaimPoolTask(task: WorkspaceTask): boolean {
  if (task.isDone || task.assignee || !task.isSharedPool) {
    return false;
  }

  if (task.projectAllowsOnDemandTasks && !task.dueDate) {
    return false;
  }

  return true;
}

/**
 * Normalisiert eine Aufgabe für die bewusste Pool-Freigabe.
 */
export function releaseTaskToPool(task: WorkspaceTask): WorkspaceTask {
  return {
    ...task,
    assignee: null,
    isSharedPool: true,
    requiresReview: false,
    reviewHint: null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Prüft alle zentralen Pflichtregeln einer Hauptaufgabe.
 */
export function validateWorkspaceTask(task: WorkspaceTask): TaskValidationError[] {
  const errors: TaskValidationError[] = [];

  if (!task.title.trim()) {
    errors.push({
      field: 'title',
      message: 'Bitte einen Aufgabentitel eintragen.',
    });
  }

  if (isTaskAssigneeRequired(task) && !task.assignee) {
    errors.push({
      field: 'assignee',
      message: 'Bitte eine verantwortliche Person auswählen.',
    });
  }

  if (!task.priority) {
    errors.push({
      field: 'priority',
      message: 'Bitte eine Priorität auswählen.',
    });
  }

  if (isTaskDueDateRequired(task) && !task.dueDate) {
    errors.push({
      field: 'dueDate',
      message: 'Bitte ein Fälligkeitsdatum festlegen.',
    });
  }

  return errors;
}
