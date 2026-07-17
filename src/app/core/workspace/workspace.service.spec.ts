// src/app/core/workspace/workspace.service.spec.ts

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionService } from '../auth/services/session.service';
import { WorkspaceInboxService } from '../inbox/workspace-inbox.service';
import {
  WorkspaceColumn,
  WorkspaceJoinRequest,
  WorkspaceMember,
  WorkspaceProject,
  WorkspaceTask,
} from './workspace.models';
import { WorkspaceService } from './workspace.service';

const MEMBER_BEN: WorkspaceMember = {
  id: 'member-ben',
  fullName: 'Ben Beispiel',
  email: 'ben@example.test',
  initials: 'BB',
  avatarColor: '#7752B3',
  avatarTextColor: '#FFFFFF',
  role: 'owner',
  isOnline: true,
};

const MEMBER_LEA: WorkspaceMember = {
  id: 'member-lea',
  fullName: 'Lea Beispiel',
  email: 'lea@example.test',
  initials: 'LB',
  avatarColor: '#4B7A78',
  avatarTextColor: '#FFFFFF',
  role: 'member',
  isOnline: false,
};

const PROJECT: WorkspaceProject = {
  id: 'project-1',
  routeKey: 'project-1',
  slugLabel: 'PROJEKT',
  name: 'Carly Managed',
  description: 'Testprojekt',
  color: '#7752B3',
  icon: 'folder',
  status: 'active',
  owner: MEMBER_BEN,
  managers: [MEMBER_BEN],
  collaborators: [MEMBER_LEA],
  startedAt: '2026-07-01',
  dueAt: '2026-08-01',
  updatedAt: '2026-07-17T09:00:00.000Z',
  completedAt: null,
  archivedAt: null,
  lastOpenedAt: '2026-07-17T09:00:00.000Z',
  isPinned: false,
  allowsOnDemandTasks: true,
  dueState: 'im-plan',
  dueSummary: 'Im Plan',
  version: 5,
};

const TASK: WorkspaceTask = {
  id: 'task-1',
  title: 'API anbinden',
  description: 'Daten aus Django laden',
  projectId: PROJECT.id,
  projectTitle: PROJECT.name,
  projectAllowsOnDemandTasks: true,
  parentTaskId: null,
  parentTaskTitle: null,
  isSubtaskMirror: false,
  sourceTaskId: null,
  sourceSubtaskId: null,
  owner: MEMBER_BEN,
  assignee: MEMBER_LEA,
  collaborators: [MEMBER_BEN],
  priority: 'hoch',
  startDate: '2026-07-17',
  dueDate: '2026-07-18',
  dueTime: '12:00',
  tags: ['Backend'],
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
  createdAt: '2026-07-17T09:00:00.000Z',
  updatedAt: '2026-07-17T09:00:00.000Z',
  version: 7,
};

const COLUMNS: WorkspaceColumn[] = [
  {
    id: 'column-backlog',
    title: 'Backlog',
    color: '#7752B3',
    tasks: [TASK],
    position: 0,
    version: 2,
  },
  {
    id: 'column-review',
    title: 'Review',
    color: '#4B7A78',
    tasks: [],
    position: 1,
    version: 1,
  },
];

const JOIN_REQUEST: WorkspaceJoinRequest = {
  id: 'request-1',
  fullName: 'Mira Beispiel',
  email: 'mira@example.test',
  avatarColor: '#B9546A',
  requestedAt: '2026-07-17T08:00:00.000Z',
  status: 'pending',
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let httpTesting: HttpTestingController;
  const sessionService = {
    currentUser: vi.fn(() => ({
      id: MEMBER_BEN.id,
      displayName: MEMBER_BEN.fullName,
      email: MEMBER_BEN.email,
      emailVerified: true,
      avatarUrl: null,
    })),
  };
  const inboxService = {
    reload: vi.fn(),
    createConversation: vi.fn(),
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionService.currentUser.mockClear();
    inboxService.reload.mockReset();
    inboxService.createConversation.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: sessionService },
        { provide: WorkspaceInboxService, useValue: inboxService },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WorkspaceService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /** Beantwortet sämtliche Requests des initialen Workspace-Snapshots. */
  function flushSnapshot(): void {
    httpTesting.expectOne('/api/v1/workspaces/').flush([
      {
        id: 'workspace-1',
        name: 'Carly Managed Demo',
        currentRole: 'owner',
        version: 1,
      },
    ]);
    httpTesting
      .expectOne('/api/v1/workspaces/workspace-1/members/')
      .flush([MEMBER_BEN, MEMBER_LEA]);
    httpTesting.expectOne('/api/v1/workspaces/projects/?workspaceId=workspace-1').flush([PROJECT]);
    httpTesting.expectOne('/api/v1/workspaces/boards/').flush([
      {
        id: 'board-project-1',
        title: PROJECT.name,
        kind: 'project',
        projectId: PROJECT.id,
        columns: COLUMNS,
        version: 4,
      },
      {
        id: 'board-personal-1',
        title: 'Mein Board',
        kind: 'personal',
        projectId: null,
        columns: [],
        version: 1,
      },
    ]);
    httpTesting
      .expectOne('/api/v1/workspaces/join-requests/?workspaceId=workspace-1')
      .flush([JOIN_REQUEST]);
    httpTesting.expectOne('/api/v1/workspaces/tasks/?archived=true').flush([]);
  }

  it('lädt den vollständigen Workspace-Snapshot aus der API', () => {
    flushSnapshot();

    expect(service.workspaceId()).toBe('workspace-1');
    expect(service.projects()).toEqual([PROJECT]);
    expect(service.members()).toEqual([MEMBER_BEN, MEMBER_LEA]);
    expect(service.getBoard(PROJECT.id)).toEqual(COLUMNS);
    expect(service.getBoardApiId(PROJECT.id)).toBe('board-project-1');
    expect(service.joinRequests()).toEqual([JOIN_REQUEST]);
    expect(inboxService.reload).toHaveBeenCalledWith('workspace-1');
  });

  it('setzt den Zustand zurück, wenn kein Workspace vorhanden ist', () => {
    httpTesting.expectOne('/api/v1/workspaces/').flush([]);

    expect(service.workspaceId()).toBeNull();
    expect(service.projects()).toEqual([]);
    expect(service.members()).toEqual([]);
    expect(service.getBoard(PROJECT.id)).toEqual([]);
  });

  it('berechnet Projekt- und Task-Kennzahlen aus dem geladenen Snapshot', () => {
    flushSnapshot();

    expect(service.getColumnCount(PROJECT.id)).toBe(2);
    expect(service.getTaskCount(PROJECT.id)).toBe(1);
    expect(service.getOpenTaskCount(PROJECT.id)).toBe(1);
    expect(service.getTaskById(TASK.id)).toEqual(TASK);
    expect(service.collaborativeProjects()).toEqual([PROJECT]);
  });

  it('pinnt Projekte optimistisch und ersetzt den Zustand durch die Serverantwort', () => {
    flushSnapshot();

    service.toggleProjectPinned(PROJECT.id);
    expect(service.getProject(PROJECT.id)?.isPinned).toBe(true);

    const request = httpTesting.expectOne(`/api/v1/workspaces/projects/${PROJECT.id}/pin/`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ isPinned: true });
    request.flush({ ...PROJECT, isPinned: true, version: 6 });

    expect(service.pinnedProjects()[0]?.version).toBe(6);
  });

  it('aktualisiert Projekte mit Mitgliedszuordnung und Versionsprüfung', () => {
    flushSnapshot();

    const updated = service.updateProject(PROJECT.id, {
      name: 'Carly Managed 2',
      slugLabel: 'CARLY2',
      description: 'Aktualisiert',
      ownerId: MEMBER_BEN.id,
      managerIds: [MEMBER_BEN.id],
      collaboratorIds: [MEMBER_LEA.id],
      startedAt: '2026-07-01',
      dueAt: '2026-08-15',
      color: '#123456',
      icon: 'rocket_launch',
      isPinned: true,
      allowsOnDemandTasks: false,
    });

    expect(updated?.name).toBe('Carly Managed 2');
    expect(updated?.collaborators).toEqual([MEMBER_LEA]);
    const request = httpTesting.expectOne(`/api/v1/workspaces/projects/${PROJECT.id}/`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.version).toBe(5);
    request.flush({ ...updated!, version: 6 });

    expect(service.getProject(PROJECT.id)?.version).toBe(6);
  });

  it('schaltet Aufgaben über den fachlichen API-Endpunkt um', () => {
    flushSnapshot();

    service.toggleTaskCompleted(PROJECT.id, TASK.id);
    expect(service.getTaskById(TASK.id)?.isDone).toBe(true);

    const request = httpTesting.expectOne(`/api/v1/workspaces/tasks/${TASK.id}/complete/`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ version: 7 });
    request.flush({
      ...TASK,
      isDone: true,
      completedAt: '2026-07-17T12:00:00.000Z',
      version: 8,
    });

    expect(service.getTaskById(TASK.id)?.version).toBe(8);
  });

  it('verschiebt Aufgaben positionsgenau und sendet Zielspalte sowie Version', () => {
    flushSnapshot();

    const columns = service.moveTask(PROJECT.id, TASK.id, 'column-backlog', 'column-review', 0);
    expect(columns[0]?.tasks).toEqual([]);
    expect(columns[1]?.tasks[0]?.id).toBe(TASK.id);

    const request = httpTesting.expectOne(`/api/v1/workspaces/tasks/${TASK.id}/move/`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      targetColumnId: 'column-review',
      targetPosition: 0,
      version: 7,
    });
    request.flush({ ...TASK, version: 8 });
  });

  it('erstellt Unteraufgaben und Kommentare über getrennte API-Ressourcen', () => {
    flushSnapshot();

    service.addSubtask(PROJECT.id, TASK.id, 'Sicherheit prüfen', MEMBER_LEA.id);
    const subtaskRequest = httpTesting.expectOne(`/api/v1/workspaces/tasks/${TASK.id}/subtasks/`);
    expect(subtaskRequest.request.method).toBe('POST');
    expect(subtaskRequest.request.body.title).toBe('Sicherheit prüfen');
    expect(subtaskRequest.request.body.assigneeId).toBe(MEMBER_LEA.id);
    const subtaskId = subtaskRequest.request.body.id as string;
    subtaskRequest.flush({
      id: subtaskId,
      title: 'Sicherheit prüfen',
      assignee: MEMBER_LEA,
      isDone: false,
      createdAt: '2026-07-17T12:00:00.000Z',
      version: 1,
    });

    service.addComment(PROJECT.id, TASK.id, 'Bitte vor dem Merge prüfen.');
    const commentRequest = httpTesting.expectOne(`/api/v1/workspaces/tasks/${TASK.id}/comments/`);
    expect(commentRequest.request.method).toBe('POST');
    expect(commentRequest.request.body.body).toBe('Bitte vor dem Merge prüfen.');
    const commentId = commentRequest.request.body.id as string;
    commentRequest.flush({
      id: commentId,
      author: MEMBER_BEN,
      body: 'Bitte vor dem Merge prüfen.',
      createdAt: '2026-07-17T12:05:00.000Z',
      version: 1,
    });

    const task = service.getTaskById(TASK.id);
    expect(task?.subtasks[0]?.id).toBe(subtaskId);
    expect(task?.subtasks[0]?.version).toBe(1);
    expect(task?.comments[0]?.id).toBe(commentId);
    expect(task?.comments[0]?.version).toBe(1);
  });

  it('verwaltet Mitglieder und Einladungen über den aktiven Workspace', () => {
    flushSnapshot();

    service.updateMember(MEMBER_LEA.id, {
      fullName: MEMBER_LEA.fullName,
      email: MEMBER_LEA.email,
      role: 'manager',
      avatarColor: '#111111',
    });
    const updateRequest = httpTesting.expectOne('/api/v1/workspaces/workspace-1/members/');
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({
      memberId: MEMBER_LEA.id,
      role: 'manager',
      avatarColor: '#111111',
    });
    updateRequest.flush({ ...MEMBER_LEA, role: 'manager', avatarColor: '#111111' });

    service
      .inviteMember({
        fullName: 'Mira Beispiel',
        email: 'mira@example.test',
        projectId: PROJECT.id,
      })
      .subscribe();
    const inviteRequest = httpTesting.expectOne('/api/v1/workspaces/invitations/');
    expect(inviteRequest.request.method).toBe('POST');
    expect(inviteRequest.request.body.workspaceId).toBe('workspace-1');
    inviteRequest.flush({});

    expect(service.members().find((member) => member.id === MEMBER_LEA.id)?.role).toBe('manager');
  });
});
