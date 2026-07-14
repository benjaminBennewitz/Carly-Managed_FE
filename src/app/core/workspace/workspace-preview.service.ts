// src/app/core/workspace/workspace-preview.service.ts

import { computed, Injectable, signal } from '@angular/core';

import { releaseTaskToPool } from './task-rules';
import {
  ArchivedTaskEntry,
  TaskPriority,
  WorkspaceAttachment,
  WorkspaceColumn,
  WorkspaceColumnSortMode,
  WorkspaceComment,
  WorkspaceHistoryEntry,
  WorkspaceMember,
  WorkspaceProject,
  WorkspaceSubtask,
  WorkspaceTask,
} from './workspace.models';

const day = 86_400_000;
const WORKSPACE_PROJECTS_STORAGE_KEY = 'carly-managed-preview-projects-v2';
const WORKSPACE_BOARDS_STORAGE_KEY = 'carly-managed-preview-boards-v2';
const MAX_TASK_TITLE_LENGTH = 160;
const MAX_TASK_DESCRIPTION_LENGTH = 5_000;
const MAX_COMMENT_LENGTH = 2_000;
const MAX_SUBTASK_TITLE_LENGTH = 160;

function isoDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * day);
  return date.toISOString().slice(0, 10);
}

function isoDateTime(offsetDays: number, hour = 10): string {
  const date = new Date(Date.now() + offsetDays * day);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const BEN: WorkspaceMember = {
  id: 'member-ben',
  fullName: 'Benjamin Bennewitz',
  email: 'demo@carly.local',
  initials: 'BB',
  avatarColor: '#7752B3',
  avatarTextColor: '#FFFFFF',
  role: 'owner',
  isOnline: true,
};

const MIRA: WorkspaceMember = {
  id: 'member-mira',
  fullName: 'Mira König',
  email: 'mira@carly.local',
  initials: 'MK',
  avatarColor: '#D5A646',
  avatarTextColor: '#241B2E',
  role: 'manager',
  isOnline: true,
};

const NOAH: WorkspaceMember = {
  id: 'member-noah',
  fullName: 'Noah Peters',
  email: 'noah@carly.local',
  initials: 'NP',
  avatarColor: '#4E82A8',
  avatarTextColor: '#FFFFFF',
  role: 'member',
  isOnline: false,
};

const LEA: WorkspaceMember = {
  id: 'member-lea',
  fullName: 'Lea Sommer',
  email: 'lea@carly.local',
  initials: 'LS',
  avatarColor: '#4F9572',
  avatarTextColor: '#FFFFFF',
  role: 'member',
  isOnline: true,
};

const MEMBERS = [BEN, MIRA, NOAH, LEA];

function task(id: string, title: string, overrides: Partial<WorkspaceTask> = {}): WorkspaceTask {
  const createdTask: WorkspaceTask = {
    id,
    title,
    description: 'Konkrete Arbeitspakete, Absprachen und Ergebnisse übersichtlich festhalten.',
    projectId: 'carly-managed',
    projectTitle: 'Carly Managed',
    projectAllowsOnDemandTasks: true,
    parentTaskId: null,
    owner: BEN,
    assignee: BEN,
    collaborators: [],
    priority: 'mittel',
    startDate: isoDate(-1),
    dueDate: isoDate(5),
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
    isDone: false,
    completedAt: null,
    isSharedPool: false,
    createdAt: isoDateTime(-12),
    updatedAt: isoDateTime(-1, 14),
    ...overrides,
  };

  if (createdTask.subtasks.length === 0 && (overrides.subtaskCount ?? 0) > 0) {
    createdTask.subtasks = Array.from({ length: overrides.subtaskCount ?? 0 }, (_, index) => ({
      id: `subtask-${id}-${index + 1}`,
      title: `Arbeitsschritt ${index + 1}`,
      isDone: index < (overrides.completedSubtaskCount ?? 0),
      createdAt: createdTask.createdAt,
    }));
  }

  if (createdTask.comments.length === 0 && (overrides.commentCount ?? 0) > 0) {
    createdTask.comments = Array.from({ length: overrides.commentCount ?? 0 }, (_, index) => ({
      id: `comment-${id}-${index + 1}`,
      author: index % 2 === 0 ? MIRA : BEN,
      body: `Abstimmung ${index + 1} zur Aufgabe.`,
      createdAt: isoDateTime(-Math.max(1, index + 1), 14),
    }));
  }

  if (createdTask.attachments.length === 0 && (overrides.attachmentCount ?? 0) > 0) {
    createdTask.attachments = Array.from(
      { length: overrides.attachmentCount ?? 0 },
      (_, index) => ({
        id: `attachment-${id}-${index + 1}`,
        fileName: `anhang-${index + 1}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 128_000 + index * 32_000,
        uploadedBy: BEN,
        createdAt: isoDateTime(-Math.max(1, index + 1), 10),
      }),
    );
  }

  if (createdTask.history.length === 0) {
    createdTask.history = [
      {
        id: `history-${id}-created`,
        actor: createdTask.owner,
        action: 'Aufgabe erstellt',
        icon: 'add_task',
        createdAt: createdTask.createdAt,
      },
    ];
  }

  return normalizeTaskCounters(createdTask);
}

const CARLY_BOARD: WorkspaceColumn[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    color: '#8A8093',
    isFixedPosition: true,
    tasks: [
      task('task-101', 'Board-Einladungen konzipieren', {
        assignee: MIRA,
        priority: 'hoch',
        dueDate: isoDate(2),
        tags: ['Backend', 'Security'],
        commentCount: 5,
      }),
      task('task-102', 'Carly-Reaktionen priorisieren', {
        assignee: null,
        priority: 'niedrig',
        dueDate: null,
        tags: ['Carly', 'UX'],
        subtaskCount: 4,
        completedSubtaskCount: 0,
      }),
      task('task-103', 'Theme-Erweiterungen dokumentieren', {
        assignee: LEA,
        dueDate: isoDate(8),
        tags: ['Designsystem'],
        attachmentCount: 2,
      }),
    ],
  },
  {
    id: 'todo',
    title: 'Offen',
    color: '#7752B3',
    tasks: [
      task('task-104', 'Task-Detailansicht strukturieren', {
        assignee: BEN,
        priority: 'hoch',
        dueDate: isoDate(1),
        tags: ['Frontend', 'UX'],
        subtaskCount: 5,
        completedSubtaskCount: 2,
      }),
      task('task-105', 'WebSocket-Ereignisse definieren', {
        assignee: NOAH,
        priority: 'hoch',
        dueDate: isoDate(3),
        tags: ['Realtime'],
        commentCount: 8,
      }),
    ],
  },
  {
    id: 'progress',
    title: 'In Arbeit',
    color: '#D5A646',
    tasks: [
      task('task-106', 'Projekt- und Boardansicht übertragen', {
        assignee: BEN,
        priority: 'hoch',
        dueDate: isoDate(0),
        tags: ['Frontend', 'Migration'],
        collaborators: [MIRA, LEA],
        subtasks: [
          {
            id: 'subtask-106-1',
            title: 'Spaltenlayout übertragen',
            isDone: true,
            createdAt: isoDateTime(-4),
          },
          {
            id: 'subtask-106-2',
            title: 'Drag-Vorschau prüfen',
            isDone: true,
            createdAt: isoDateTime(-3),
          },
          {
            id: 'subtask-106-3',
            title: 'Task-Drawer ausbauen',
            isDone: false,
            createdAt: isoDateTime(-2),
          },
        ],
        comments: [
          {
            id: 'comment-106-1',
            author: MIRA,
            body: 'Die horizontale Boardfläche sollte den verfügbaren Viewport vollständig nutzen.',
            createdAt: isoDateTime(-2, 15),
          },
          {
            id: 'comment-106-2',
            author: BEN,
            body: 'Spalten erhalten jeweils einen eigenen vertikalen Scrollbereich.',
            createdAt: isoDateTime(-1, 11),
          },
        ],
        attachments: [
          {
            id: 'attachment-106-1',
            fileName: 'board-layout-reference.png',
            mimeType: 'image/png',
            sizeBytes: 248320,
            uploadedBy: LEA,
            createdAt: isoDateTime(-1, 9),
          },
        ],
      }),
      task('task-107', 'Pool-Regeln abstimmen', {
        assignee: MIRA,
        priority: 'mittel',
        dueDate: isoDate(4),
        tags: ['Workflow'],
        isRecurring: true,
        recurrenceLabel: 'Wöchentlich',
      }),
    ],
  },
  {
    id: 'review',
    title: 'Review',
    color: '#4E82A8',
    tasks: [
      task('task-108', 'Auth-Formulare prüfen', {
        assignee: LEA,
        priority: 'mittel',
        dueDate: isoDate(-1),
        tags: ['Security', 'QA'],
        commentCount: 6,
      }),
    ],
  },
];

const PORTFOLIO_BOARD: WorkspaceColumn[] = [
  {
    id: 'portfolio-ideas',
    title: 'Ideen',
    color: '#8A8093',
    isFixedPosition: true,
    tasks: [
      task('task-201', 'Case Study Storyline festlegen', {
        projectId: 'portfolio-relaunch',
        projectTitle: 'Portfolio Relaunch',
        projectAllowsOnDemandTasks: false,
        assignee: BEN,
        tags: ['Content'],
        dueDate: isoDate(7),
      }),
    ],
  },
  {
    id: 'portfolio-build',
    title: 'Umsetzung',
    color: '#4E82A8',
    tasks: [
      task('task-202', 'Projektbilder optimieren', {
        projectId: 'portfolio-relaunch',
        projectTitle: 'Portfolio Relaunch',
        projectAllowsOnDemandTasks: false,
        assignee: LEA,
        tags: ['Assets'],
        dueDate: isoDate(5),
      }),
      task('task-203', 'Responsive Navigation testen', {
        projectId: 'portfolio-relaunch',
        projectTitle: 'Portfolio Relaunch',
        projectAllowsOnDemandTasks: false,
        assignee: BEN,
        priority: 'hoch',
        tags: ['Frontend'],
        dueDate: isoDate(2),
      }),
    ],
  },
  {
    id: 'portfolio-done',
    title: 'Erledigt',
    color: '#4F9572',
    tasks: [
      task('task-204', 'Neue Projekttexte glätten', {
        projectId: 'portfolio-relaunch',
        projectTitle: 'Portfolio Relaunch',
        projectAllowsOnDemandTasks: false,
        assignee: MIRA,
        tags: ['Content'],
        isDone: true,
        completedAt: isoDateTime(-2, 16),
      }),
    ],
  },
];

const STUDIO_BOARD: WorkspaceColumn[] = [
  {
    id: 'studio-ready',
    title: 'Bereit zur Vergabe',
    color: '#D5A646',
    isFixedPosition: true,
    tasks: [
      task('task-301', 'Social-Media-Vorlagen exportieren', {
        projectId: 'studio-operations',
        projectTitle: 'Studio Operations',
        projectAllowsOnDemandTasks: true,
        assignee: null,
        dueDate: null,
        tags: ['Design'],
      }),
      task('task-302', 'Monatsreport vorbereiten', {
        projectId: 'studio-operations',
        projectTitle: 'Studio Operations',
        projectAllowsOnDemandTasks: true,
        assignee: null,
        dueDate: null,
        tags: ['Reporting'],
      }),
    ],
  },
  {
    id: 'studio-active',
    title: 'Aktiv',
    color: '#7752B3',
    tasks: [
      task('task-303', 'Asset-Bibliothek bereinigen', {
        projectId: 'studio-operations',
        projectTitle: 'Studio Operations',
        projectAllowsOnDemandTasks: true,
        assignee: NOAH,
        dueDate: isoDate(6),
        tags: ['Assets'],
      }),
    ],
  },
  {
    id: 'studio-review',
    title: 'Freigabe',
    color: '#4E82A8',
    tasks: [],
  },
];

const ARCHIVED_PROJECT_BOARD: WorkspaceColumn[] = [
  {
    id: 'archive-done',
    title: 'Abgeschlossen',
    color: '#4F9572',
    tasks: [
      task('task-401', 'MVP-Konzept finalisieren', {
        projectId: 'client-workspace',
        projectTitle: 'Client Workspace',
        projectAllowsOnDemandTasks: false,
        assignee: BEN,
        tags: ['Konzept'],
        isDone: true,
        completedAt: isoDateTime(-20, 11),
      }),
      task('task-402', 'Abnahme dokumentieren', {
        projectId: 'client-workspace',
        projectTitle: 'Client Workspace',
        projectAllowsOnDemandTasks: false,
        assignee: MIRA,
        tags: ['Dokumentation'],
        isDone: true,
        completedAt: isoDateTime(-18, 15),
      }),
    ],
  },
];

const INITIAL_PROJECTS: WorkspaceProject[] = [
  {
    id: 'carly-managed',
    routeKey: 'carly-managed',
    slugLabel: 'CM / Produkt',
    name: 'Carly Managed',
    description:
      'Kollaboratives Task- und Projektmanagement mit Realtime-Workflows und optionaler Carly-Ebene.',
    color: '#7752B3',
    icon: 'auto_awesome',
    status: 'active',
    owner: BEN,
    managers: [BEN, MIRA],
    collaborators: [NOAH, LEA],
    startedAt: isoDate(-42),
    dueAt: isoDate(24),
    updatedAt: isoDateTime(-1, 14),
    completedAt: null,
    lastOpenedAt: isoDateTime(-1, 11),
    isPinned: true,
    allowsOnDemandTasks: true,
    dueState: 'kritisch',
    dueSummary: 'Hohe Restmenge bei kurzer Laufzeit',
  },
  {
    id: 'portfolio-relaunch',
    routeKey: 'portfolio-relaunch',
    slugLabel: 'WEB / Portfolio',
    name: 'Portfolio Relaunch',
    description:
      'Neue Projektpräsentation, klare Case Studies und eine schnellere responsive Oberfläche.',
    color: '#4E82A8',
    icon: 'web',
    status: 'active',
    owner: BEN,
    managers: [BEN],
    collaborators: [LEA],
    startedAt: isoDate(-18),
    dueAt: isoDate(36),
    updatedAt: isoDateTime(-2, 16),
    completedAt: null,
    lastOpenedAt: isoDateTime(-3, 9),
    isPinned: false,
    allowsOnDemandTasks: false,
    dueState: 'im-plan',
    dueSummary: 'Arbeitsmenge und Restlaufzeit passen zusammen',
  },
  {
    id: 'studio-operations',
    routeKey: 'studio-operations',
    slugLabel: 'OPS / Studio',
    name: 'Studio Operations',
    description: 'Wiederkehrende Studioaufgaben, Übergaben und frei übernehmbare Arbeitspakete.',
    color: '#D5A646',
    icon: 'space_dashboard',
    status: 'active',
    owner: MIRA,
    managers: [MIRA],
    collaborators: [BEN, NOAH, LEA],
    startedAt: isoDate(-30),
    dueAt: isoDate(12),
    updatedAt: isoDateTime(-1, 8),
    completedAt: null,
    lastOpenedAt: null,
    isPinned: false,
    allowsOnDemandTasks: true,
    dueState: 'bald-faellig',
    dueSummary: 'Termin rückt näher',
  },
  {
    id: 'client-workspace',
    routeKey: 'client-workspace',
    slugLabel: 'ARCHIV / Kunde',
    name: 'Client Workspace',
    description: 'Abgeschlossener Kundenbereich mit Aufgabenverlauf und dokumentierter Abnahme.',
    color: '#4F9572',
    icon: 'inventory',
    status: 'completed',
    owner: BEN,
    managers: [BEN],
    collaborators: [MIRA],
    startedAt: isoDate(-90),
    dueAt: isoDate(-18),
    updatedAt: isoDateTime(-18, 15),
    completedAt: isoDateTime(-18, 15),
    lastOpenedAt: isoDateTime(-19, 10),
    isPinned: false,
    allowsOnDemandTasks: false,
    dueState: 'geringe-restmenge',
    dueSummary: 'Projekt abgeschlossen',
  },
];

const INITIAL_BOARDS: Record<string, WorkspaceColumn[]> = {
  'carly-managed': CARLY_BOARD,
  'portfolio-relaunch': PORTFOLIO_BOARD,
  'studio-operations': STUDIO_BOARD,
  'client-workspace': ARCHIVED_PROJECT_BOARD,
  personal: [
    {
      id: 'personal-today',
      title: 'Heute',
      color: '#7752B3',
      isFixedPosition: true,
      tasks: [
        task('task-personal-1', 'Board-Ansicht prüfen', {
          projectId: null,
          projectTitle: null,
          projectAllowsOnDemandTasks: false,
          assignee: BEN,
          tags: ['Fokus'],
          dueDate: isoDate(0),
        }),
      ],
    },
    {
      id: 'personal-next',
      title: 'Als Nächstes',
      color: '#4E82A8',
      tasks: [
        task('task-personal-2', 'Backend-Grundgerüst vorbereiten', {
          projectId: null,
          projectTitle: null,
          projectAllowsOnDemandTasks: false,
          assignee: BEN,
          tags: ['Backend'],
          dueDate: isoDate(3),
        }),
      ],
    },
    {
      id: 'personal-done',
      title: 'Erledigt',
      color: '#4F9572',
      tasks: [],
    },
  ],
};

function cloneMember(member: WorkspaceMember): WorkspaceMember {
  return { ...member };
}

function normalizeTaskCounters(source: WorkspaceTask): WorkspaceTask {
  const subtasks = source.subtasks ?? [];
  const comments = source.comments ?? [];
  const attachments = source.attachments ?? [];

  return {
    ...source,
    subtasks,
    comments,
    attachments,
    history: source.history ?? [],
    collaborators: source.collaborators ?? [],
    subtaskCount: subtasks.length,
    completedSubtaskCount: subtasks.filter((item) => item.isDone).length,
    commentCount: comments.length,
    attachmentCount: attachments.length,
  };
}

function cloneTask(source: WorkspaceTask): WorkspaceTask {
  return normalizeTaskCounters({
    ...source,
    owner: cloneMember(source.owner),
    assignee: source.assignee ? cloneMember(source.assignee) : null,
    collaborators: (source.collaborators ?? []).map(cloneMember),
    tags: [...source.tags],
    subtasks: (source.subtasks ?? []).map((item) => ({ ...item })),
    comments: (source.comments ?? []).map((item) => ({
      ...item,
      author: cloneMember(item.author),
    })),
    attachments: (source.attachments ?? []).map((item) => ({
      ...item,
      uploadedBy: cloneMember(item.uploadedBy),
    })),
    history: (source.history ?? []).map((item) => ({
      ...item,
      actor: cloneMember(item.actor),
    })),
  });
}

function cloneColumns(columns: WorkspaceColumn[]): WorkspaceColumn[] {
  return columns.map((column) => ({
    ...column,
    tasks: column.tasks.map(cloneTask),
  }));
}

function sortTasks(
  tasks: WorkspaceTask[],
  mode: Exclude<WorkspaceColumnSortMode, null>,
): WorkspaceTask[] {
  return [...tasks].sort((left, right) => {
    if (mode === 'title') {
      return left.title.localeCompare(right.title, 'de');
    }

    return (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31');
  });
}

function cloneProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
  return projects.map((project) => ({
    ...project,
    owner: cloneMember(project.owner),
    managers: project.managers.map(cloneMember),
    collaborators: project.collaborators.map(cloneMember),
  }));
}

function loadStoredProjects(): WorkspaceProject[] {
  try {
    const storedProjects = window.localStorage.getItem(WORKSPACE_PROJECTS_STORAGE_KEY);
    return storedProjects
      ? cloneProjects(JSON.parse(storedProjects) as WorkspaceProject[])
      : cloneProjects(INITIAL_PROJECTS);
  } catch {
    return cloneProjects(INITIAL_PROJECTS);
  }
}

function loadStoredBoards(): Record<string, WorkspaceColumn[]> {
  const fallback = (): Record<string, WorkspaceColumn[]> =>
    Object.fromEntries(
      Object.entries(INITIAL_BOARDS).map(([key, columns]) => [key, cloneColumns(columns)]),
    );

  try {
    const storedBoards = window.localStorage.getItem(WORKSPACE_BOARDS_STORAGE_KEY);
    if (!storedBoards) {
      return fallback();
    }

    const parsedBoards = JSON.parse(storedBoards) as Record<string, WorkspaceColumn[]>;
    return Object.fromEntries(
      Object.entries(parsedBoards).map(([key, columns]) => [key, cloneColumns(columns)]),
    );
  } catch {
    return fallback();
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspacePreviewService {
  private readonly projectsState = signal<WorkspaceProject[]>(loadStoredProjects());
  private readonly boardsState = signal<Record<string, WorkspaceColumn[]>>(loadStoredBoards());

  readonly projects = computed(() =>
    this.projectsState()
      .filter((project) => project.status === 'active')
      .sort((left, right) => Number(right.isPinned) - Number(left.isPinned)),
  );
  readonly pinnedProjects = computed(() => this.projects().filter((project) => project.isPinned));
  readonly archivedProjects = computed(() =>
    this.projectsState().filter((project) => project.status !== 'active'),
  );
  readonly collaborativeProjects = computed(() =>
    this.projects().filter((project) =>
      [...project.managers, ...project.collaborators].some((member) => member.id === BEN.id),
    ),
  );
  readonly lastOpenedProject = computed(
    () =>
      [...this.projects()]
        .filter((project) => project.lastOpenedAt)
        .sort(
          (left, right) =>
            new Date(right.lastOpenedAt ?? 0).getTime() -
            new Date(left.lastOpenedAt ?? 0).getTime(),
        )[0] ?? null,
  );
  readonly members = signal(MEMBERS.map((member) => ({ ...member }))).asReadonly();
  readonly archivedTasks = computed<ArchivedTaskEntry[]>(() =>
    Object.values(this.boardsState())
      .flatMap((columns) => columns.flatMap((column) => column.tasks))
      .filter((item) => item.isDone && item.completedAt)
      .map((item) => ({
        task: cloneTask(item),
        sourceLabel: item.projectTitle ?? 'Persönliches Board',
        archivedAt: item.completedAt ?? item.updatedAt,
      }))
      .sort(
        (left, right) => new Date(right.archivedAt).getTime() - new Date(left.archivedAt).getTime(),
      ),
  );

  /**
   * Liefert ein Projekt anhand des Route-Keys.
   */
  getProject(projectId: string): WorkspaceProject | null {
    return this.projectsState().find((project) => project.id === projectId) ?? null;
  }

  /**
   * Liefert eine bearbeitbare Kopie eines Boards.
   */
  getBoard(projectId: string): WorkspaceColumn[] {
    return cloneColumns(this.boardsState()[projectId] ?? []);
  }

  /**
   * Speichert eine vollständige Board-Kopie im lokalen Vorschauzustand.
   */
  saveBoard(projectId: string, columns: WorkspaceColumn[]): void {
    this.boardsState.update((boards) => ({
      ...boards,
      [projectId]: cloneColumns(columns),
    }));
    this.persistBoards();
    this.touchProject(projectId);
  }

  /**
   * Liefert die Anzahl aller Aufgaben eines Projekts.
   */
  getTaskCount(projectId: string): number {
    return this.getBoard(projectId).reduce((count, column) => count + column.tasks.length, 0);
  }

  /**
   * Liefert die Anzahl offener Aufgaben eines Projekts.
   */
  getOpenTaskCount(projectId: string): number {
    return this.getBoard(projectId).reduce(
      (count, column) => count + column.tasks.filter((item) => !item.isDone).length,
      0,
    );
  }

  /**
   * Liefert die Anzahl überfälliger offener Aufgaben eines Projekts.
   */
  getOverdueTaskCount(projectId: string): number {
    const today = new Date().toISOString().slice(0, 10);
    return this.getBoard(projectId).reduce(
      (count, column) =>
        count +
        column.tasks.filter((item) => !item.isDone && !!item.dueDate && item.dueDate < today)
          .length,
      0,
    );
  }

  /**
   * Liefert die Anzahl der Spalten eines Projekts.
   */
  getColumnCount(projectId: string): number {
    return this.getBoard(projectId).length;
  }

  /**
   * Pinnt oder entpinnt ein Projekt.
   */
  toggleProjectPinned(projectId: string): void {
    this.projectsState.update((projects) =>
      projects.map((project) =>
        project.id === projectId ? { ...project, isPinned: !project.isPinned } : project,
      ),
    );
    this.persistProjects();
  }

  /**
   * Aktualisiert den letzten Öffnungszeitpunkt eines Projekts.
   */
  markProjectOpened(projectId: string): void {
    this.projectsState.update((projects) =>
      projects.map((project) =>
        project.id === projectId ? { ...project, lastOpenedAt: new Date().toISOString() } : project,
      ),
    );
    this.persistProjects();
  }

  /**
   * Erstellt ein neues lokales Projekt inklusive Startboard.
   */
  createProject(): WorkspaceProject {
    const index = this.projectsState().length + 1;
    const id = `project-${Date.now()}`;
    const createdProject: WorkspaceProject = {
      id,
      routeKey: id,
      slugLabel: `PROJEKT ${String(index).padStart(2, '0')}`,
      name: `Neues Projekt ${index}`,
      description: 'Ein neuer gemeinsamer Arbeitsbereich für Aufgaben, Mitglieder und Termine.',
      color: '#7752B3',
      icon: 'folder_open',
      status: 'active',
      owner: BEN,
      managers: [BEN],
      collaborators: [],
      startedAt: isoDate(0),
      dueAt: isoDate(30),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      lastOpenedAt: null,
      isPinned: false,
      allowsOnDemandTasks: false,
      dueState: 'im-plan',
      dueSummary: 'Neues Projekt ohne Terminrisiko',
    };

    this.projectsState.update((projects) => [...projects, createdProject]);
    this.boardsState.update((boards) => ({
      ...boards,
      [id]: [
        {
          id: `${id}-backlog`,
          title: 'Backlog',
          color: '#8A8093',
          isFixedPosition: true,
          tasks: [],
        },
        {
          id: `${id}-open`,
          title: 'Offen',
          color: '#7752B3',
          tasks: [],
        },
        {
          id: `${id}-done`,
          title: 'Erledigt',
          color: '#4F9572',
          tasks: [],
        },
      ],
    }));
    this.persistProjects();
    this.persistBoards();

    return createdProject;
  }

  /**
   * Schaltet den Abschlussstatus einer Aufgabe um.
   */
  toggleTaskCompleted(projectId: string, taskId: string): WorkspaceColumn[] {
    const columns = this.getBoard(projectId).map((column) => ({
      ...column,
      tasks: column.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              isDone: !item.isDone,
              completedAt: item.isDone ? null : new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    }));
    this.saveBoard(projectId, columns);
    return columns;
  }

  /**
   * Gibt eine Aufgabe bewusst in den gemeinsamen Pool frei.
   */
  moveTaskToPool(projectId: string, taskId: string): WorkspaceColumn[] {
    const columns = this.getBoard(projectId).map((column) => ({
      ...column,
      tasks: column.tasks.map((item) => (item.id === taskId ? releaseTaskToPool(item) : item)),
    }));
    this.saveBoard(projectId, columns);
    return columns;
  }

  /**
   * Verschiebt eine Aufgabe innerhalb oder zwischen Boardspalten.
   */
  moveTask(
    projectId: string,
    taskId: string,
    sourceColumnId: string,
    targetColumnId: string,
    targetIndex: number,
  ): WorkspaceColumn[] {
    const columns = this.getBoard(projectId);
    const sourceColumn = columns.find((column) => column.id === sourceColumnId);
    const targetColumn = columns.find((column) => column.id === targetColumnId);
    const taskIndex = sourceColumn?.tasks.findIndex((item) => item.id === taskId) ?? -1;

    if (!sourceColumn || !targetColumn || taskIndex < 0) {
      return columns;
    }

    const [movedTask] = sourceColumn.tasks.splice(taskIndex, 1);
    if (!movedTask) {
      return columns;
    }

    const safeTargetIndex = Math.max(0, Math.min(targetIndex, targetColumn.tasks.length));
    const taskWithHistory = this.addHistory(
      { ...movedTask, updatedAt: new Date().toISOString() },
      sourceColumnId === targetColumnId
        ? 'Aufgabenreihenfolge geändert'
        : `In „${targetColumn.title}“ verschoben`,
      'drag_indicator',
    );
    targetColumn.tasks.splice(safeTargetIndex, 0, taskWithHistory);
    sourceColumn.sortMode = null;
    targetColumn.sortMode = null;

    this.saveBoard(projectId, columns);
    return columns;
  }

  /**
   * Speichert die Akzentfarbe einer Boardspalte.
   */
  updateColumnColor(projectId: string, columnId: string, color: string): WorkspaceColumn[] {
    const columns = this.getBoard(projectId).map((column) =>
      column.id === columnId ? { ...column, color } : column,
    );
    this.saveBoard(projectId, columns);
    return columns;
  }

  /**
   * Sortiert eine Spalte und speichert die aktive Sortierung.
   */
  sortColumn(
    projectId: string,
    columnId: string,
    mode: WorkspaceColumnSortMode,
  ): WorkspaceColumn[] {
    const columns = this.getBoard(projectId).map((column) => {
      if (column.id !== columnId) {
        return column;
      }

      return {
        ...column,
        sortMode: mode,
        tasks: mode ? sortTasks(column.tasks, mode) : column.tasks,
      };
    });
    this.saveBoard(projectId, columns);
    return columns;
  }

  /**
   * Fügt eine neue Aufgabe am Anfang einer Spalte ein.
   */
  addTask(projectId: string, columnId: string): WorkspaceColumn[] {
    const project = this.getProject(projectId);
    const newTask = task(`task-${Date.now()}`, 'Neue Aufgabe', {
      projectId: project?.id ?? null,
      projectTitle: project?.name ?? null,
      projectAllowsOnDemandTasks: project?.allowsOnDemandTasks ?? false,
      owner: project?.owner ?? BEN,
      assignee: project?.allowsOnDemandTasks ? null : (project?.owner ?? BEN),
      dueDate: project?.allowsOnDemandTasks ? null : isoDate(7),
      tags: [],
      subtaskCount: 0,
      completedSubtaskCount: 0,
      commentCount: 0,
      attachmentCount: 0,
    });

    const columns = this.getBoard(projectId).map((column) =>
      column.id === columnId
        ? { ...column, sortMode: null, tasks: [newTask, ...column.tasks] }
        : column,
    );
    this.saveBoard(projectId, columns);
    return columns;
  }

  /**
   * Aktualisiert den Namen einer Boardspalte.
   */
  renameColumn(projectId: string, columnId: string, title: string): WorkspaceColumn[] {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return this.getBoard(projectId);
    }

    const columns = this.getBoard(projectId).map((column) =>
      column.id === columnId ? { ...column, title: normalizedTitle } : column,
    );
    this.saveBoard(projectId, columns);
    return columns;
  }

  /**
   * Entfernt eine freie Spalte und verschiebt ihre Aufgaben in die erste Spalte.
   */
  deleteColumn(projectId: string, columnId: string): WorkspaceColumn[] {
    const columns = this.getBoard(projectId);
    const deletedColumn = columns.find((column) => column.id === columnId);
    const fallbackColumn = columns.find((column) => column.id !== columnId);

    if (!deletedColumn || deletedColumn.isFixedPosition || !fallbackColumn) {
      return columns;
    }

    const nextColumns = columns
      .filter((column) => column.id !== columnId)
      .map((column) =>
        column.id === fallbackColumn.id
          ? { ...column, sortMode: null, tasks: [...column.tasks, ...deletedColumn.tasks] }
          : column,
      );
    this.saveBoard(projectId, nextColumns);
    return nextColumns;
  }

  /**
   * Aktualisiert die bearbeitbaren Kerndaten einer Aufgabe.
   */
  updateTask(
    projectId: string,
    taskId: string,
    changes: Partial<
      Pick<
        WorkspaceTask,
        'title' | 'description' | 'priority' | 'assignee' | 'startDate' | 'dueDate'
      >
    >,
    historyAction = 'Aufgabe aktualisiert',
    historyIcon = 'edit_note',
  ): WorkspaceColumn[] {
    return this.mutateTask(projectId, taskId, (currentTask) => {
      const nextTitle = changes.title?.trim().slice(0, MAX_TASK_TITLE_LENGTH);
      const nextDescription = changes.description?.trim().slice(0, MAX_TASK_DESCRIPTION_LENGTH);
      const nextTask = {
        ...currentTask,
        ...changes,
        title: nextTitle || currentTask.title,
        description: nextDescription === undefined ? currentTask.description : nextDescription,
        updatedAt: new Date().toISOString(),
      };

      return this.addHistory(nextTask, historyAction, historyIcon);
    });
  }

  /**
   * Entfernt eine Aufgabe vollständig aus ihrem Board.
   */
  deleteTask(projectId: string, taskId: string): WorkspaceColumn[] {
    const columns = this.getBoard(projectId).map((column) => ({
      ...column,
      tasks: column.tasks.filter((item) => item.id !== taskId),
    }));
    this.saveBoard(projectId, columns);
    return columns;
  }

  /** Fügt einer Aufgabe eine Unteraufgabe hinzu. */
  addSubtask(projectId: string, taskId: string, title: string): WorkspaceColumn[] {
    const cleanTitle = title.trim().slice(0, MAX_SUBTASK_TITLE_LENGTH);
    if (!cleanTitle) return this.getBoard(projectId);
    return this.mutateTask(projectId, taskId, (currentTask) => {
      const subtask: WorkspaceSubtask = {
        id: `subtask-${Date.now()}`,
        title: cleanTitle,
        isDone: false,
        createdAt: new Date().toISOString(),
      };
      return this.addHistory(
        normalizeTaskCounters({
          ...currentTask,
          subtasks: [...currentTask.subtasks, subtask],
          updatedAt: new Date().toISOString(),
        }),
        'Unteraufgabe hinzugefügt',
        'account_tree',
      );
    });
  }

  /** Schaltet den Status einer Unteraufgabe um. */
  toggleSubtask(projectId: string, taskId: string, subtaskId: string): WorkspaceColumn[] {
    return this.mutateTask(projectId, taskId, (currentTask) =>
      this.addHistory(
        normalizeTaskCounters({
          ...currentTask,
          subtasks: currentTask.subtasks.map((item) =>
            item.id === subtaskId ? { ...item, isDone: !item.isDone } : item,
          ),
          updatedAt: new Date().toISOString(),
        }),
        'Unteraufgabe aktualisiert',
        'task_alt',
      ),
    );
  }

  /** Ändert den Titel einer Unteraufgabe. */
  updateSubtask(
    projectId: string,
    taskId: string,
    subtaskId: string,
    title: string,
  ): WorkspaceColumn[] {
    const cleanTitle = title.trim().slice(0, MAX_SUBTASK_TITLE_LENGTH);
    if (!cleanTitle) return this.getBoard(projectId);
    return this.mutateTask(projectId, taskId, (currentTask) =>
      this.addHistory(
        normalizeTaskCounters({
          ...currentTask,
          subtasks: currentTask.subtasks.map((item) =>
            item.id === subtaskId ? { ...item, title: cleanTitle } : item,
          ),
          updatedAt: new Date().toISOString(),
        }),
        'Unteraufgabe umbenannt',
        'edit',
      ),
    );
  }

  /** Entfernt eine Unteraufgabe. */
  deleteSubtask(projectId: string, taskId: string, subtaskId: string): WorkspaceColumn[] {
    return this.mutateTask(projectId, taskId, (currentTask) =>
      this.addHistory(
        normalizeTaskCounters({
          ...currentTask,
          subtasks: currentTask.subtasks.filter((item) => item.id !== subtaskId),
          updatedAt: new Date().toISOString(),
        }),
        'Unteraufgabe entfernt',
        'delete',
      ),
    );
  }

  /** Fügt einen Kommentar hinzu. */
  addComment(projectId: string, taskId: string, body: string): WorkspaceColumn[] {
    const cleanBody = body.trim().slice(0, MAX_COMMENT_LENGTH);
    if (!cleanBody) return this.getBoard(projectId);
    return this.mutateTask(projectId, taskId, (currentTask) => {
      const comment: WorkspaceComment = {
        id: `comment-${Date.now()}`,
        author: BEN,
        body: cleanBody,
        createdAt: new Date().toISOString(),
      };
      return this.addHistory(
        normalizeTaskCounters({
          ...currentTask,
          comments: [...currentTask.comments, comment],
          updatedAt: new Date().toISOString(),
        }),
        'Kommentar hinzugefügt',
        'forum',
      );
    });
  }

  /** Entfernt einen lokalen Kommentar. */
  deleteComment(projectId: string, taskId: string, commentId: string): WorkspaceColumn[] {
    return this.mutateTask(projectId, taskId, (currentTask) =>
      this.addHistory(
        normalizeTaskCounters({
          ...currentTask,
          comments: currentTask.comments.filter((item) => item.id !== commentId),
          updatedAt: new Date().toISOString(),
        }),
        'Kommentar entfernt',
        'delete',
      ),
    );
  }

  /** Speichert Dateimetadaten als lokale Vorschauanhänge. */
  addAttachments(projectId: string, taskId: string, files: File[]): WorkspaceColumn[] {
    if (files.length === 0) return this.getBoard(projectId);
    return this.mutateTask(projectId, taskId, (currentTask) => {
      const createdAt = new Date().toISOString();
      const attachments: WorkspaceAttachment[] = files.map((file, index) => ({
        id: `attachment-${Date.now()}-${index}`,
        fileName: file.name.slice(0, 255),
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        uploadedBy: BEN,
        createdAt,
      }));
      return this.addHistory(
        normalizeTaskCounters({
          ...currentTask,
          attachments: [...currentTask.attachments, ...attachments],
          updatedAt: createdAt,
        }),
        `${attachments.length} Anhang${attachments.length === 1 ? '' : 'e'} hinzugefügt`,
        'attach_file',
      );
    });
  }

  /** Entfernt einen Anhang. */
  deleteAttachment(projectId: string, taskId: string, attachmentId: string): WorkspaceColumn[] {
    return this.mutateTask(projectId, taskId, (currentTask) =>
      this.addHistory(
        normalizeTaskCounters({
          ...currentTask,
          attachments: currentTask.attachments.filter((item) => item.id !== attachmentId),
          updatedAt: new Date().toISOString(),
        }),
        'Anhang entfernt',
        'delete',
      ),
    );
  }

  /** Fügt eine Person als Mitwirkende hinzu oder entfernt sie. */
  toggleTaskCollaborator(projectId: string, taskId: string, memberId: string): WorkspaceColumn[] {
    const member = this.members().find((item) => item.id === memberId);
    if (!member) return this.getBoard(projectId);
    return this.mutateTask(projectId, taskId, (currentTask) => {
      const isCollaborator = currentTask.collaborators.some((item) => item.id === memberId);
      const collaborators = isCollaborator
        ? currentTask.collaborators.filter((item) => item.id !== memberId)
        : [...currentTask.collaborators, member];
      return this.addHistory(
        { ...currentTask, collaborators, updatedAt: new Date().toISOString() },
        isCollaborator ? `${member.fullName} entfernt` : `${member.fullName} hinzugefügt`,
        'group',
      );
    });
  }

  /** Ändert die Priorität einer Aufgabe. */
  updateTaskPriority(projectId: string, taskId: string, priority: TaskPriority): WorkspaceColumn[] {
    return this.updateTask(
      projectId,
      taskId,
      { priority },
      `Priorität auf ${priority} gesetzt`,
      'flag',
    );
  }

  /** Wendet eine immutable Mutation auf eine einzelne Aufgabe an. */
  private mutateTask(
    projectId: string,
    taskId: string,
    mutation: (task: WorkspaceTask) => WorkspaceTask,
  ): WorkspaceColumn[] {
    const columns = this.getBoard(projectId).map((column) => ({
      ...column,
      tasks: column.tasks.map((item) =>
        item.id === taskId && !item.isDone ? normalizeTaskCounters(mutation(item)) : item,
      ),
    }));
    this.saveBoard(projectId, columns);
    return columns;
  }

  /** Ergänzt einen Verlaufseintrag. */
  private addHistory(task: WorkspaceTask, action: string, icon: string): WorkspaceTask {
    const entry: WorkspaceHistoryEntry = {
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actor: BEN,
      action,
      icon,
      createdAt: new Date().toISOString(),
    };
    return { ...task, history: [entry, ...task.history] };
  }

  /** Speichert Projektzustände im lokalen Browser-Speicher. */
  private persistProjects(): void {
    try {
      window.localStorage.setItem(
        WORKSPACE_PROJECTS_STORAGE_KEY,
        JSON.stringify(this.projectsState()),
      );
    } catch {
      // Die Vorschau bleibt ohne Browser-Speicher funktionsfähig.
    }
  }

  /** Speichert Boardzustände im lokalen Browser-Speicher. */
  private persistBoards(): void {
    try {
      window.localStorage.setItem(WORKSPACE_BOARDS_STORAGE_KEY, JSON.stringify(this.boardsState()));
    } catch {
      // Die Vorschau bleibt ohne Browser-Speicher funktionsfähig.
    }
  }

  /**
   * Aktualisiert den Änderungszeitpunkt eines Projekts.
   */
  private touchProject(projectId: string): void {
    this.projectsState.update((projects) =>
      projects.map((project) =>
        project.id === projectId ? { ...project, updatedAt: new Date().toISOString() } : project,
      ),
    );
    this.persistProjects();
  }
}
