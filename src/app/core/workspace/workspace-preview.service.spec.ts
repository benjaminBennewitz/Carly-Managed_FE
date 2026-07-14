// src/app/core/workspace/workspace-preview.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkspacePreviewService } from './workspace-preview.service';

describe('WorkspacePreviewService', () => {
  let service: WorkspacePreviewService;

  beforeEach(() => {
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

    const result = service.deleteColumn(
      'portfolio-relaunch',
      deletableColumn?.id ?? '',
    );

    expect(result.some((column) => column.id === deletableColumn?.id)).toBe(false);
    expect(service.getTaskCount('portfolio-relaunch')).toBe(before);
  });
});
