// src/app/core/workspace/workspace-preview.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkspacePreviewService } from './workspace-preview.service';

describe('WorkspacePreviewService', () => {
  let service: WorkspacePreviewService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkspacePreviewService);
  });

  it('liefert Projekte und passende Boardspalten', () => {
    const project = service.getProject('carly-managed');

    expect(project?.name).toBe('Carly Managed');
    expect(service.getBoard('carly-managed').length).toBeGreaterThan(0);
  });

  it('schaltet den Abschlussstatus einer Aufgabe um', () => {
    const initialTask = service
      .getBoard('carly-managed')
      .flatMap((column) => column.tasks)
      .find((task) => task.id === 'task-101');

    expect(initialTask?.isDone).toBe(false);

    const updatedTask = service
      .toggleTaskCompleted('carly-managed', 'task-101')
      .flatMap((column) => column.tasks)
      .find((task) => task.id === 'task-101');

    expect(updatedTask?.isDone).toBe(true);
    expect(updatedTask?.completedAt).not.toBeNull();
  });

  it('verschiebt Aufgaben einer gelöschten Spalte in eine Fallbackspalte', () => {
    const before = service.getTaskCount('portfolio-relaunch');
    const columns = service.getBoard('portfolio-relaunch');
    const deletableColumn = columns.find((column) => !column.isFixedPosition);

    expect(deletableColumn).toBeDefined();

    const result = service.deleteColumn('portfolio-relaunch', deletableColumn?.id ?? '');

    expect(result.some((column) => column.id === deletableColumn?.id)).toBe(false);
    expect(service.getTaskCount('portfolio-relaunch')).toBe(before);
  });
  it('persistiert Spaltenreihenfolge und Farben im Browser-Speicher', () => {
    const columns = service.getBoard('carly-managed');
    const reordered = [{ ...columns[1], color: '#B9546A' }, columns[0], ...columns.slice(2)];

    service.saveBoard('carly-managed', reordered);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restoredService = TestBed.inject(WorkspacePreviewService);
    const restored = restoredService.getBoard('carly-managed');

    expect(restored[0].id).toBe(columns[1].id);
    expect(restored[0].color).toBe('#B9546A');
  });

  it('verwaltet Unteraufgaben, Kommentare und Priorität lokal', () => {
    service.addSubtask('carly-managed', 'task-101', 'Sicherheit prüfen');
    service.addComment('carly-managed', 'task-101', 'Bitte vor dem Merge prüfen.');
    const columns = service.updateTaskPriority('carly-managed', 'task-101', 'niedrig');
    const task = columns.flatMap((column) => column.tasks).find((item) => item.id === 'task-101');

    expect(task?.subtasks.some((item) => item.title === 'Sicherheit prüfen')).toBe(true);
    expect(task?.comments.some((item) => item.body.includes('Merge'))).toBe(true);
    expect(task?.priority).toBe('niedrig');
    expect(task?.history.length).toBeGreaterThan(1);
  });

  it('persistiert Taskverschiebungen zwischen Projektspalten', () => {
    const before = service.getBoard('carly-managed');
    const source = before.find((column) => column.tasks.some((task) => task.id === 'task-101'));
    const target = before.find((column) => column.id !== source?.id);

    expect(source).toBeDefined();
    expect(target).toBeDefined();

    service.moveTask('carly-managed', 'task-101', source?.id ?? '', target?.id ?? '', 0);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restoredService = TestBed.inject(WorkspacePreviewService);
    const restored = restoredService.getBoard('carly-managed');

    expect(
      restored
        .find((column) => column.id === source?.id)
        ?.tasks.some((task) => task.id === 'task-101'),
    ).toBe(false);
    expect(restored.find((column) => column.id === target?.id)?.tasks[0]?.id).toBe('task-101');
  });

  it('persistiert Sortierung und erlaubt das Umbenennen von Unteraufgaben', () => {
    const sorted = service.sortColumn('carly-managed', 'backlog', 'title');
    expect(sorted.find((column) => column.id === 'backlog')?.sortMode).toBe('title');

    service.addSubtask('carly-managed', 'task-101', 'Alter Titel');
    const task = service
      .getBoard('carly-managed')
      .flatMap((column) => column.tasks)
      .find((item) => item.id === 'task-101');
    const subtask = task?.subtasks.find((item) => item.title === 'Alter Titel');

    expect(subtask).toBeDefined();

    const columns = service.updateSubtask(
      'carly-managed',
      'task-101',
      subtask?.id ?? '',
      'Neuer Titel',
    );
    const updatedTask = columns
      .flatMap((column) => column.tasks)
      .find((item) => item.id === 'task-101');

    expect(updatedTask?.subtasks.some((item) => item.title === 'Neuer Titel')).toBe(true);
  });

  it('sperrt Inhaltsänderungen an erledigten Aufgaben bis zur Wiederöffnung', () => {
    service.toggleTaskCompleted('carly-managed', 'task-101');
    service.updateTaskPriority('carly-managed', 'task-101', 'niedrig');

    const lockedTask = service
      .getBoard('carly-managed')
      .flatMap((column) => column.tasks)
      .find((item) => item.id === 'task-101');

    expect(lockedTask?.isDone).toBe(true);
    expect(lockedTask?.priority).toBe('hoch');

    service.toggleTaskCompleted('carly-managed', 'task-101');
    service.updateTaskPriority('carly-managed', 'task-101', 'niedrig');

    const reopenedTask = service
      .getBoard('carly-managed')
      .flatMap((column) => column.tasks)
      .find((item) => item.id === 'task-101');

    expect(reopenedTask?.isDone).toBe(false);
    expect(reopenedTask?.priority).toBe('niedrig');
  });
});
