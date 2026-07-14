// src/app/core/workspace/workspace-preview.service.ts

import { computed, Injectable, signal } from '@angular/core';

import { releaseTaskToPool } from './task-rules';
import {
  ArchivedTaskEntry,
  WorkspaceColumn,
  WorkspaceMember,
  WorkspaceProject,
  WorkspaceTask,
} from './workspace.models';

const day = 86_400_000;

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

function task(
  id: string,
  title: string,
  overrides: Partial<WorkspaceTask> = {},
): WorkspaceTask {
  return {
    id,
    title,
    description: 'Konkrete Arbeitspakete, Absprachen und Ergebnisse übersichtlich festhalten.',
    projectId: 'carly-managed',
    projectTitle: 'Carly Managed',
    projectAllowsOnDemandTasks: true,
    parentTaskId: null,
    owner: BEN,
    assignee: BEN,
    priority: 'mittel',
    startDate: isoDate(-1),
    dueDate: isoDate(5),
    dueTime: null,
    tags: ['Frontend'],
    subtaskCount: 3,
    completedSubtaskCount: 1,
    commentCount: 2,
    attachmentCount: 1,
    isRecurring: false,
    recurrenceLabel: null,
    isDone: false,
    completedAt: null,
    isSharedPool: false,
    createdAt: isoDateTime(-12),
    updatedAt: isoDateTime(-1, 14),
    ...overrides,
  };
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
        subtaskCount: 6,
        completedSubtaskCount: 4,
        commentCount: 4,
        attachmentCount: 3,
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
    description: 'Kollaboratives Task- und Projektmanagement mit Realtime-Workflows und optionaler Carly-Ebene.',
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
    description: 'Neue Projektpräsentation, klare Case Studies und eine schnellere responsive Oberfläche.',
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

function cloneTask(source: WorkspaceTask): WorkspaceTask {
  return {
    ...source,
    owner: { ...source.owner },
    assignee: source.assignee ? { ...source.assignee } : null,
    tags: [...source.tags],
  };
}

function cloneColumns(columns: WorkspaceColumn[]): WorkspaceColumn[] {
  return columns.map((column) => ({
    ...column,
    tasks: column.tasks.map(cloneTask),
  }));
}

@Injectable({ providedIn: 'root' })
export class WorkspacePreviewService {
  private readonly projectsState = signal<WorkspaceProject[]>(
    INITIAL_PROJECTS.map((project) => ({ ...project })),
  );
  private readonly boardsState = signal<Record<string, WorkspaceColumn[]>>(
    Object.fromEntries(
      Object.entries(INITIAL_BOARDS).map(([key, columns]) => [
        key,
        cloneColumns(columns),
      ]),
    ),
  );

  readonly projects = computed(() =>
    this.projectsState()
      .filter((project) => project.status === 'active')
      .sort((left, right) => Number(right.isPinned) - Number(left.isPinned)),
  );
  readonly archivedProjects = computed(() =>
    this.projectsState().filter((project) => project.status !== 'active'),
  );
  readonly collaborativeProjects = computed(() =>
    this.projects().filter((project) =>
      [...project.managers, ...project.collaborators].some(
        (member) => member.id === BEN.id,
      ),
    ),
  );
  readonly lastOpenedProject = computed(() =>
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
        (left, right) =>
          new Date(right.archivedAt).getTime() -
          new Date(left.archivedAt).getTime(),
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
    this.touchProject(projectId);
  }

  /**
   * Liefert die Anzahl aller Aufgaben eines Projekts.
   */
  getTaskCount(projectId: string): number {
    return this.getBoard(projectId).reduce(
      (count, column) => count + column.tasks.length,
      0,
    );
  }

  /**
   * Liefert die Anzahl offener Aufgaben eines Projekts.
   */
  getOpenTaskCount(projectId: string): number {
    return this.getBoard(projectId).reduce(
      (count, column) =>
        count + column.tasks.filter((item) => !item.isDone).length,
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
        column.tasks.filter(
          (item) => !item.isDone && !!item.dueDate && item.dueDate < today,
        ).length,
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
        project.id === projectId
          ? { ...project, isPinned: !project.isPinned }
          : project,
      ),
    );
  }

  /**
   * Aktualisiert den letzten Öffnungszeitpunkt eines Projekts.
   */
  markProjectOpened(projectId: string): void {
    this.projectsState.update((projects) =>
      projects.map((project) =>
        project.id === projectId
          ? { ...project, lastOpenedAt: new Date().toISOString() }
          : project,
      ),
    );
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
      tasks: column.tasks.map((item) =>
        item.id === taskId ? releaseTaskToPool(item) : item,
      ),
    }));
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
      assignee: project?.allowsOnDemandTasks ? null : project?.owner ?? BEN,
      dueDate: project?.allowsOnDemandTasks ? null : isoDate(7),
      tags: [],
      subtaskCount: 0,
      completedSubtaskCount: 0,
      commentCount: 0,
      attachmentCount: 0,
    });

    const columns = this.getBoard(projectId).map((column) =>
      column.id === columnId
        ? { ...column, tasks: [newTask, ...column.tasks] }
        : column,
    );
    this.saveBoard(projectId, columns);
    return columns;
  }

  /**
   * Aktualisiert den Namen einer Boardspalte.
   */
  renameColumn(
    projectId: string,
    columnId: string,
    title: string,
  ): WorkspaceColumn[] {
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
          ? { ...column, tasks: [...column.tasks, ...deletedColumn.tasks] }
          : column,
      );
    this.saveBoard(projectId, nextColumns);
    return nextColumns;
  }

  /**
   * Aktualisiert den Änderungszeitpunkt eines Projekts.
   */
  private touchProject(projectId: string): void {
    this.projectsState.update((projects) =>
      projects.map((project) =>
        project.id === projectId
          ? { ...project, updatedAt: new Date().toISOString() }
          : project,
      ),
    );
  }
}
