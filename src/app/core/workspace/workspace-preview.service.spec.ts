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

  it('löscht jede benutzerverwaltete Projektspalte und erhält deren Aufgaben', () => {
    const before = service.getTaskCount('portfolio-relaunch');
    const columns = service.getBoard('portfolio-relaunch');
    const ideasColumn = columns.find((column) => column.id === 'portfolio-ideas');

    expect(ideasColumn).toBeDefined();
    expect(ideasColumn?.systemRole).toBeUndefined();

    const result = service.deleteColumn('portfolio-relaunch', 'portfolio-ideas');

    expect(result.some((column) => column.id === 'portfolio-ideas')).toBe(false);
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

  it('verschiebt erledigte Aufgaben über eine aktive Regel in die Zielspalte', () => {
    const columns = service.toggleTaskCompleted('carly-managed', 'task-106');
    const reviewColumn = columns.find((column) => column.id === 'review');

    expect(reviewColumn?.tasks.some((task) => task.id === 'task-106')).toBe(true);
  });

  it('reserviert und speichert Wiederholungsregeln pro Aufgabe', () => {
    service.reserveTaskRecurrence('carly-managed', 'task-101', true);
    const columns = service.saveTaskRecurrence('carly-managed', {
      taskId: 'task-101',
      scheduleType: 'weekly_days',
      startDate: '2026-07-20',
      intervalValue: 1,
      weekdays: ['MO', 'WE'],
      dayOfMonth: null,
      isActive: true,
    });
    const task = columns.flatMap((column) => column.tasks).find((item) => item.id === 'task-101');

    expect(task?.isRecurring).toBe(true);
    expect(task?.recurrenceRule?.isActive).toBe(true);
    expect(task?.recurrenceRule?.weekdays).toEqual(['MO', 'WE']);
    expect(service.getRecurrenceRules('carly-managed')).toContainEqual(
      expect.objectContaining({ taskId: 'task-101', isActive: true }),
    );
  });

  it('spiegelt neue Projektzuweisungen in die dynamische Neu-Spalte', () => {
    const personalBoard = service.getBoard('personal');
    const newColumn = personalBoard.find((column) => column.systemRole === 'new-assigned');

    expect(newColumn?.title).toBe('Neu');
    expect(newColumn?.isDynamic).toBe(true);
    expect(newColumn?.tasks.some((task) => task.id === 'task-104')).toBe(true);
  });

  it('legt Aufgaben ohne Zuweisung mit Prüfhinweis im Pool ab', () => {
    const createdTask = service.createUnplacedTask('carly-managed', null, 'Ungeklärte Aufgabe');
    const pooledTask = service.poolTasks().find((task) => task.id === createdTask.id);

    expect(pooledTask?.assignee).toBeNull();
    expect(pooledTask?.isSharedPool).toBe(true);
    expect(pooledTask?.requiresReview).toBe(true);
    expect(pooledTask?.reviewHint).toContain('Zuweisung');
  });

  it('verschiebt eine entfernte Zuweisung automatisch in den Pool', () => {
    service.updateTask(
      'carly-managed',
      'task-101',
      { assignee: null },
      'Zuweisung entfernt',
      'assignment_ind',
    );

    expect(
      service
        .getBoard('carly-managed')
        .flatMap((column) => column.tasks)
        .some((task) => task.id === 'task-101'),
    ).toBe(false);
    expect(service.poolTasks().find((task) => task.id === 'task-101')?.requiresReview).toBe(true);
  });

  it('entfernt eine leere dynamische Neu-Spalte nach der Einsortierung', () => {
    const createdTask = service.createUnplacedTask(null, 'member-mira', 'Miras neue Aufgabe');
    const boardId = 'personal-member-mira';
    const initialBoard = service.getBoard(boardId);
    const newColumn = initialBoard.find((column) => column.systemRole === 'new-assigned');

    expect(newColumn).toBeDefined();

    service.saveBoard(boardId, [
      ...initialBoard,
      {
        id: 'mira-open',
        title: 'Offen',
        color: '#4E82A8',
        tasks: [],
      },
    ]);
    const tasksToSort = [...(newColumn?.tasks ?? [])];
    for (const task of tasksToSort) {
      const activeNewColumn = service
        .getBoard(boardId)
        .find((column) => column.systemRole === 'new-assigned');
      service.moveTask(boardId, task.id, activeNewColumn?.id ?? '', 'mira-open', 0);
    }

    const updatedBoard = service.getBoard(boardId);
    expect(updatedBoard.some((column) => column.systemRole === 'new-assigned')).toBe(false);
    expect(
      updatedBoard
        .find((column) => column.id === 'mira-open')
        ?.tasks.some((task) => task.id === createdTask.id),
    ).toBe(true);
  });

  it('speichert Projektdaten, Rollen und Darstellung zentral', () => {
    const updatedProject = service.updateProject('portfolio-relaunch', {
      name: 'Portfolio 2027',
      slugLabel: 'Portfolio Next',
      description: 'Neue Case Studies und ein überarbeitetes Designsystem.',
      ownerId: 'member-mira',
      managerIds: ['member-mira', 'member-ben'],
      collaboratorIds: ['member-lea'],
      startedAt: '2026-08-01',
      dueAt: '2026-12-15',
      color: '#4E82A8',
      icon: 'rocket_launch',
      isPinned: true,
      allowsOnDemandTasks: true,
    });

    expect(updatedProject?.name).toBe('Portfolio 2027');
    expect(updatedProject?.slugLabel).toBe('PORTFOLIO NEXT');
    expect(updatedProject?.owner.id).toBe('member-mira');
    expect(updatedProject?.managers.map((member) => member.id)).toContain('member-ben');
    expect(updatedProject?.collaborators.map((member) => member.id)).toEqual(['member-lea']);
    expect(updatedProject?.icon).toBe('rocket_launch');
    expect(updatedProject?.color).toBe('#4E82A8');
    expect(updatedProject?.isPinned).toBe(true);

    const projectTask = service
      .getBoard('portfolio-relaunch')
      .flatMap((column) => column.tasks)
      .find((task) => task.id === 'task-201');

    expect(projectTask?.projectTitle).toBe('Portfolio 2027');
    expect(projectTask?.projectAllowsOnDemandTasks).toBe(true);
  });

  it('erstellt Projekte mit sicheren Schnellaktionsdaten', () => {
    const project = service.createProject({
      name: '  <Launch>  ',
      description: '  Gemeinsamer   Relaunch  ',
      dueAt: '2026-09-30',
    });

    expect(project.name).toBe('Launch');
    expect(project.description).toBe('Gemeinsamer Relaunch');
    expect(project.dueAt).toBe('2026-09-30');
    expect(service.getBoard(project.id).length).toBe(3);
  });

  it('speichert Einladungen und Nachrichten lokal', () => {
    const member = service.inviteMember({
      fullName: 'Nina Beispiel',
      email: 'nina@example.test',
      projectId: 'carly-managed',
    });
    const message = service.sendMessage({
      recipientId: member.id,
      subject: 'Willkommen',
      body: 'Schön, dass du dabei bist.',
    });

    expect(service.members().some((item) => item.id === member.id)).toBe(true);
    expect(
      service.getProject('carly-managed')?.collaborators.some((item) => item.id === member.id),
    ).toBe(true);
    expect(message?.recipient.id).toBe(member.id);
    expect(service.sentMessages()[0]?.subject).toBe('Willkommen');
  });
});
