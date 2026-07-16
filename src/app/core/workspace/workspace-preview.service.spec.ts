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
  it('schließt ein Projekt ab und entfernt es aus den aktiven Projekten', () => {
    const completedProject = service.completeProject('carly-managed');

    expect(completedProject?.status).toBe('completed');
    expect(completedProject?.completedAt).not.toBeNull();
    expect(completedProject?.isPinned).toBe(false);
    expect(service.projects().some((project) => project.id === 'carly-managed')).toBe(false);
    expect(
      service
        .archivedProjects()
        .some((project) => project.id === 'carly-managed' && project.status === 'completed'),
    ).toBe(true);
    expect(service.getBoard('carly-managed').length).toBeGreaterThan(0);
  });

  it('archiviert ein Projekt unabhängig von offenen Aufgaben', () => {
    const archivedProject = service.archiveProject('portfolio-relaunch');

    expect(archivedProject?.status).toBe('archived');
    expect(archivedProject?.archivedAt).not.toBeNull();
    expect(service.projects().some((project) => project.id === 'portfolio-relaunch')).toBe(false);
    expect(
      service
        .archivedProjects()
        .some((project) => project.id === 'portfolio-relaunch' && project.status === 'archived'),
    ).toBe(true);
  });

  it('löscht Projekt, Board und projektbezogene Task-Spiegelungen', () => {
    expect(
      service
        .getBoard('personal')
        .flatMap((column) => column.tasks)
        .some((task) => task.projectId === 'carly-managed'),
    ).toBe(true);

    const deleted = service.deleteProject('carly-managed');

    expect(deleted).toBe(true);
    expect(service.getProject('carly-managed')).toBeNull();
    expect(service.getBoard('carly-managed')).toEqual([]);
    expect(
      service
        .getBoard('personal')
        .flatMap((column) => column.tasks)
        .some((task) => task.projectId === 'carly-managed'),
    ).toBe(false);
    expect(service.poolTasks().some((task) => task.projectId === 'carly-managed')).toBe(false);
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

  it('normalisiert mehrere Tags und entfernt doppelte Einträge', () => {
    const columns = service.updateTask(
      'carly-managed',
      'task-101',
      { tags: ['Frontend', ' frontend ', 'Review', '<Design>'] },
      'Tags aktualisiert',
      'sell',
    );
    const task = columns.flatMap((column) => column.tasks).find((item) => item.id === 'task-101');

    expect(task?.tags).toEqual(['Frontend', 'Review', 'Design']);
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

  it('spiegelt fremd zugewiesene Unteraufgaben in die persönliche Neu-Spalte', () => {
    service.addSubtask('personal', 'task-personal-1', 'Freigabe abstimmen', 'member-mira');

    const miraBoard = service.getBoard('personal-member-mira');
    const mirrorTask = miraBoard
      .flatMap((column) => column.tasks)
      .find((task) => task.isSubtaskMirror && task.parentTaskId === 'task-personal-1');
    const sourceTask = service.getTaskById('task-personal-1');

    expect(miraBoard.find((column) => column.systemRole === 'new-assigned')).toBeDefined();
    expect(mirrorTask?.title).toBe('Freigabe abstimmen');
    expect(mirrorTask?.parentTaskTitle).toBe(sourceTask?.title);
    expect(mirrorTask?.projectTitle).toBeNull();
    expect(sourceTask?.history[0]?.action).toContain('Mira');
  });

  it('verschiebt eine Unteraufgaben-Spiegelung bei einer neuen Zuweisung', () => {
    service.addSubtask('carly-managed', 'task-101', 'Review koordinieren', 'member-mira');
    const sourceTask = service.getTaskById('task-101');
    const subtask = sourceTask?.subtasks.find((item) => item.title === 'Review koordinieren');

    service.updateSubtaskAssignee('carly-managed', 'task-101', subtask?.id ?? '', 'member-lea');

    expect(
      service
        .getBoard('personal-member-mira')
        .flatMap((column) => column.tasks)
        .some((task) => task.sourceSubtaskId === subtask?.id),
    ).toBe(false);
    expect(
      service
        .getBoard('personal-member-lea')
        .flatMap((column) => column.tasks)
        .some((task) => task.sourceSubtaskId === subtask?.id),
    ).toBe(true);
    expect(service.getTaskById('task-101')?.history[0]?.action).toContain('Lea');
  });

  it('synchronisiert den Abschluss einer gespiegelten Unteraufgabe mit der Hauptaufgabe', () => {
    service.addSubtask('carly-managed', 'task-101', 'Gemeinsam testen', 'member-lea');
    const mirrorTask = service
      .getBoard('personal-member-lea')
      .flatMap((column) => column.tasks)
      .find((task) => task.parentTaskId === 'task-101' && task.title === 'Gemeinsam testen');

    expect(mirrorTask).toBeDefined();

    service.toggleMirroredSubtask('personal-member-lea', mirrorTask!);

    const sourceTask = service.getTaskById('task-101');
    const mirroredState = service
      .getBoard('personal-member-lea')
      .flatMap((column) => column.tasks)
      .find((task) => task.id === mirrorTask?.id);

    expect(sourceTask?.subtasks.find((item) => item.title === 'Gemeinsam testen')?.isDone).toBe(
      true,
    );
    expect(sourceTask?.history[0]?.action).toContain('abgeschlossen');
    expect(mirroredState).toBeUndefined();
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

  it('erstellt und aktualisiert Mitglieder inklusive kontrastreicher Initialenfarbe', () => {
    const createdMember = service.createMember({
      fullName: 'Lina Beispiel',
      email: 'lina@example.test',
      role: 'member',
      avatarColor: '#FFFFFF',
    });

    expect(createdMember?.initials).toBe('LB');
    expect(createdMember?.avatarTextColor).toBe('#241B2E');

    const updatedMember = service.updateMember('member-noah', {
      fullName: 'Noah Beispiel',
      email: 'noah.neu@example.test',
      role: 'manager',
      avatarColor: '#111111',
    });
    const assignedTask = service.getTaskById('task-105');

    expect(updatedMember?.initials).toBe('NB');
    expect(updatedMember?.avatarTextColor).toBe('#FFFFFF');
    expect(assignedTask?.assignee?.fullName).toBe('Noah Beispiel');
    expect(assignedTask?.assignee?.role).toBe('manager');
  });

  it('entfernt Mitglieder und bereinigt aktive Zuweisungen', () => {
    expect(service.deleteMember('member-noah')).toBe(true);

    const pooledTask = service.getTaskById('task-105');
    expect(service.members().some((member) => member.id === 'member-noah')).toBe(false);
    expect(pooledTask?.assignee).toBeNull();
    expect(pooledTask?.isSharedPool).toBe(true);
    expect(service.deleteMember('member-ben')).toBe(false);
  });

  it('gibt Beitrittsanfragen frei oder lehnt sie ab', () => {
    const approvedMember = service.approveJoinRequest('join-request-jona');
    const rejected = service.rejectJoinRequest('join-request-emilia');

    expect(approvedMember?.email).toBe('jona@carly.local');
    expect(service.members().some((member) => member.id === approvedMember?.id)).toBe(true);
    expect(rejected).toBe(true);
    expect(service.joinRequests()).toEqual([]);
  });
});
