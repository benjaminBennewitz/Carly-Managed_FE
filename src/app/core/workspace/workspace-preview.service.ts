// src/app/core/workspace/workspace-preview.service.ts

import { computed, Injectable, signal } from '@angular/core';

import {
  normalizeMultilineInput,
  normalizeSingleLineInput,
} from '../security/frontend-input.utils';
import { releaseTaskToPool } from './task-rules';
import { WorkspaceAutomationService } from './workspace-automation.service';
import { isWorkspaceProjectColor, isWorkspaceProjectIcon } from './workspace-project-options';
import {
  ArchivedTaskEntry,
  TaskPriority,
  WorkspaceAttachment,
  WorkspaceAutomationTrigger,
  WorkspaceColumn,
  WorkspaceColumnSortMode,
  WorkspaceComment,
  WorkspaceHistoryEntry,
  WorkspaceMember,
  WorkspaceMemberInvitePayload,
  WorkspaceMessage,
  WorkspaceMessageCreatePayload,
  WorkspaceProject,
  WorkspaceProjectCreatePayload,
  WorkspaceProjectUpdatePayload,
  WorkspaceRecurrenceScheduleType,
  WorkspaceRecurrenceWeekday,
  WorkspaceSubtask,
  WorkspaceTask,
  WorkspaceTaskRecurrenceRule,
  WorkspaceTaskRecurrenceSavePayload,
} from './workspace.models';

const day = 86_400_000;
const WORKSPACE_PROJECTS_STORAGE_KEY = 'carly-managed-preview-projects-v2';
const WORKSPACE_BOARDS_STORAGE_KEY = 'carly-managed-preview-boards-v2';
const WORKSPACE_MEMBERS_STORAGE_KEY = 'carly-managed-preview-members-v1';
const WORKSPACE_MESSAGES_STORAGE_KEY = 'carly-managed-preview-messages-v1';
const MAX_TASK_TITLE_LENGTH = 160;
const MAX_TASK_DESCRIPTION_LENGTH = 5_000;
const MAX_COMMENT_LENGTH = 2_000;
const MAX_SUBTASK_TITLE_LENGTH = 160;
const PERSONAL_BOARD_ID = 'personal';
const PERSONAL_NEW_COLUMN_ID = 'personal-new';
const POOL_BOARD_ID = 'pool';
const POOL_REVIEW_COLUMN_ID = 'pool-review';
const UNASSIGNED_REVIEW_HINT =
  'Ohne verantwortliche Person erstellt. Bitte Zuweisung und Termin prüfen.';

function isoDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * day);
  return date.toISOString().slice(0, 10);
}

function isoDateTime(offsetDays: number, hour = 10): string {
  const date = new Date(Date.now() + offsetDays * day);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const RECURRENCE_WEEKDAY_LABELS: Record<WorkspaceRecurrenceWeekday, string> = {
  MO: 'Mo',
  TU: 'Di',
  WE: 'Mi',
  TH: 'Do',
  FR: 'Fr',
  SA: 'Sa',
  SU: 'So',
};

const RECURRENCE_WEEKDAY_INDEX: Record<WorkspaceRecurrenceWeekday, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function parseIsoDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function dateToIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getWeekdayCode(value: string): WorkspaceRecurrenceWeekday {
  const dayIndex = parseIsoDate(value).getDay();
  return (Object.entries(RECURRENCE_WEEKDAY_INDEX).find(([, index]) => index === dayIndex)?.[0] ??
    'MO') as WorkspaceRecurrenceWeekday;
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildRecurrenceSummary(
  scheduleType: WorkspaceRecurrenceScheduleType,
  intervalValue: number,
  weekdays: WorkspaceRecurrenceWeekday[],
  dayOfMonth: number | null,
): string {
  const interval = Math.max(1, Number(intervalValue || 1));

  if (scheduleType === 'weekly_days') {
    const labels = weekdays.map((weekday) => RECURRENCE_WEEKDAY_LABELS[weekday]).join(', ');
    return labels ? `Wöchentlich · ${labels}` : 'Wöchentlich';
  }

  if (scheduleType === 'monthly_day') {
    const monthLabel = interval === 1 ? 'Monatlich' : `Alle ${interval} Monate`;
    return `${monthLabel} · Tag ${dayOfMonth ?? 1}`;
  }

  return interval === 1 ? 'Täglich' : `Alle ${interval} Tage`;
}

function calculateNextRecurrenceDate(rule: WorkspaceTaskRecurrenceRule): string | null {
  if (!rule.startDate) {
    return null;
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const startDate = parseIsoDate(rule.startDate);
  const cursor = startDate > today ? new Date(startDate) : new Date(today);

  if (rule.scheduleType === 'weekly_days') {
    const weekdays = rule.weekdays.length > 0 ? rule.weekdays : [getWeekdayCode(rule.startDate)];
    for (let offset = 0; offset <= 14; offset += 1) {
      const candidate = new Date(cursor);
      candidate.setDate(candidate.getDate() + offset);
      const matches = weekdays.some(
        (weekday) => RECURRENCE_WEEKDAY_INDEX[weekday] === candidate.getDay(),
      );
      if (matches && candidate >= startDate) {
        return dateToIso(candidate);
      }
    }
    return rule.startDate;
  }

  if (rule.scheduleType === 'interval_days') {
    const interval = Math.max(1, rule.intervalValue);
    if (cursor <= startDate) {
      return rule.startDate;
    }
    const elapsedDays = Math.floor((cursor.getTime() - startDate.getTime()) / day);
    const nextStep = Math.ceil(elapsedDays / interval) * interval;
    const candidate = new Date(startDate);
    candidate.setDate(candidate.getDate() + nextStep);
    return dateToIso(candidate);
  }

  const interval = Math.max(1, rule.intervalValue);
  const targetDay = Math.max(1, Math.min(31, rule.dayOfMonth ?? startDate.getDate()));
  const startMonthIndex = startDate.getFullYear() * 12 + startDate.getMonth();
  const cursorMonthIndex = cursor.getFullYear() * 12 + cursor.getMonth();
  let offsetMonths = Math.max(0, cursorMonthIndex - startMonthIndex);
  offsetMonths = Math.ceil(offsetMonths / interval) * interval;

  for (let step = 0; step < 3; step += 1) {
    const absoluteMonth = startMonthIndex + offsetMonths + step * interval;
    const year = Math.floor(absoluteMonth / 12);
    const month = absoluteMonth % 12;
    const candidate = new Date(year, month, Math.min(targetDay, getDaysInMonth(year, month)), 12);
    if (candidate >= cursor && candidate >= startDate) {
      return dateToIso(candidate);
    }
  }

  return rule.startDate;
}

function createDefaultRecurrenceRule(
  taskId: string,
  taskTitle: string,
  boardId: string,
  startDate: string,
): WorkspaceTaskRecurrenceRule {
  const now = new Date().toISOString();
  const weekdays = [getWeekdayCode(startDate)];
  const rule: WorkspaceTaskRecurrenceRule = {
    id: `recurrence-${taskId}`,
    taskId,
    taskTitle,
    taskIsDone: false,
    boardId,
    scheduleType: 'weekly_days',
    startDate,
    intervalValue: 1,
    weekdays,
    dayOfMonth: null,
    summary: buildRecurrenceSummary('weekly_days', 1, weekdays, null),
    nextRunOn: null,
    lastRunAt: null,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  };
  return { ...rule, nextRunOn: calculateNextRecurrenceDate(rule) };
}

function normalizeRecurrenceRule(source: WorkspaceTask): WorkspaceTaskRecurrenceRule | null {
  if (source.recurrenceRule) {
    const rule = {
      ...source.recurrenceRule,
      weekdays: [...(source.recurrenceRule.weekdays ?? [])],
      taskTitle: source.title,
      taskIsDone: source.isDone,
      boardId: source.recurrenceRule.boardId || source.projectId || PERSONAL_BOARD_ID,
    };
    return {
      ...rule,
      summary: buildRecurrenceSummary(
        rule.scheduleType,
        rule.intervalValue,
        rule.weekdays,
        rule.dayOfMonth,
      ),
      nextRunOn: calculateNextRecurrenceDate(rule),
    };
  }

  if (!source.isRecurring) {
    return null;
  }

  const startDate = source.startDate ?? source.dueDate ?? isoDate(0);
  const legacyRule = createDefaultRecurrenceRule(
    source.id,
    source.title,
    source.projectId ?? PERSONAL_BOARD_ID,
    startDate,
  );
  return {
    ...legacyRule,
    isActive: true,
    summary: source.recurrenceLabel ?? legacyRule.summary,
  };
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
    recurrenceRule: null,
    isDone: false,
    completedAt: null,
    isSharedPool: false,
    requiresReview: false,
    reviewHint: null,
    createdOutsideColumn: false,
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
    archivedAt: null,
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
    archivedAt: null,
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
    archivedAt: null,
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
    archivedAt: null,
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
  pool: [
    {
      id: POOL_REVIEW_COLUMN_ID,
      title: 'Prüfung',
      color: '#D5A646',
      isFixedPosition: true,
      isDynamic: true,
      systemRole: 'pool-review',
      tasks: [],
    },
  ],
  personal: [
    {
      id: 'personal-today',
      title: 'Heute',
      color: '#7752B3',
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

  const recurrenceRule = normalizeRecurrenceRule(source);

  return {
    ...source,
    subtasks,
    comments,
    attachments,
    history: source.history ?? [],
    collaborators: source.collaborators ?? [],
    isRecurring: recurrenceRule !== null,
    recurrenceLabel: recurrenceRule?.summary ?? null,
    recurrenceRule,
    requiresReview: source.requiresReview ?? false,
    reviewHint: source.reviewHint ?? null,
    createdOutsideColumn: source.createdOutsideColumn ?? false,
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
    recurrenceRule: source.recurrenceRule
      ? { ...source.recurrenceRule, weekdays: [...source.recurrenceRule.weekdays] }
      : null,
  });
}

function cloneColumns(columns: WorkspaceColumn[]): WorkspaceColumn[] {
  return columns.map((column) => ({
    ...column,
    isFixedPosition: column.systemRole ? true : undefined,
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
    archivedAt: project.archivedAt ?? null,
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

function loadStoredMembers(): WorkspaceMember[] {
  try {
    const storedMembers = window.localStorage.getItem(WORKSPACE_MEMBERS_STORAGE_KEY);
    if (!storedMembers) {
      return MEMBERS.map((member) => ({ ...member }));
    }

    const parsedMembers = JSON.parse(storedMembers) as WorkspaceMember[];
    const uniqueMembers = new Map<string, WorkspaceMember>();
    [...MEMBERS, ...parsedMembers].forEach((member) => {
      uniqueMembers.set(member.email.toLocaleLowerCase('de'), { ...member });
    });
    return [...uniqueMembers.values()];
  } catch {
    return MEMBERS.map((member) => ({ ...member }));
  }
}

function loadStoredMessages(): WorkspaceMessage[] {
  try {
    const storedMessages = window.localStorage.getItem(WORKSPACE_MESSAGES_STORAGE_KEY);
    return storedMessages ? (JSON.parse(storedMessages) as WorkspaceMessage[]) : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspacePreviewService {
  private readonly projectsState = signal<WorkspaceProject[]>(loadStoredProjects());
  private readonly boardsState = signal<Record<string, WorkspaceColumn[]>>(loadStoredBoards());
  private readonly membersState = signal<WorkspaceMember[]>(loadStoredMembers());
  private readonly messagesState = signal<WorkspaceMessage[]>(loadStoredMessages());

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
  readonly members = this.membersState.asReadonly();
  readonly sentMessages = this.messagesState.asReadonly();
  readonly poolTasks = computed(() =>
    cloneColumns(this.boardsState()[POOL_BOARD_ID] ?? [])
      .flatMap((column) => column.tasks)
      .sort(
        (left, right) =>
          Number(right.requiresReview) - Number(left.requiresReview) ||
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
  );
  readonly poolReviewCount = computed(
    () => this.poolTasks().filter((item) => item.requiresReview).length,
  );
  readonly archivedTasks = computed<ArchivedTaskEntry[]>(() => {
    const uniqueTasks = new Map<string, WorkspaceTask>();

    Object.entries(this.boardsState())
      .filter(([boardId]) => boardId !== POOL_BOARD_ID)
      .flatMap(([, columns]) => columns.flatMap((column) => column.tasks))
      .forEach((item) => {
        if (item.isDone && item.completedAt && !uniqueTasks.has(item.id)) {
          uniqueTasks.set(item.id, item);
        }
      });

    return [...uniqueTasks.values()]
      .map((item) => ({
        task: cloneTask(item),
        sourceLabel: item.projectTitle ?? 'Persönliches Board',
        archivedAt: item.completedAt ?? item.updatedAt,
      }))
      .sort(
        (left, right) => new Date(right.archivedAt).getTime() - new Date(left.archivedAt).getTime(),
      );
  });

  constructor(private readonly automationService: WorkspaceAutomationService) {
    this.reconcileWorkspaceIntake();
    this.persistBoards();
  }

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
      [projectId]: this.normalizeDynamicColumns(projectId, cloneColumns(columns)),
    }));
    this.reconcileWorkspaceIntake();
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
   * Aktualisiert die vollständigen Projektdaten und synchronisiert abhängige Tasks.
   */
  updateProject(
    projectId: string,
    payload: WorkspaceProjectUpdatePayload,
  ): WorkspaceProject | null {
    const currentProject = this.getProject(projectId);
    const name = normalizeSingleLineInput(payload.name, 80);
    const slugLabel = normalizeSingleLineInput(payload.slugLabel, 32).toLocaleUpperCase('de');
    const description = normalizeMultilineInput(payload.description, 500);
    const startedAt = /^\d{4}-\d{2}-\d{2}$/.test(payload.startedAt) ? payload.startedAt : '';
    const dueAt = /^\d{4}-\d{2}-\d{2}$/.test(payload.dueAt) ? payload.dueAt : '';
    const owner = this.members().find((member) => member.id === payload.ownerId) ?? null;

    if (
      !currentProject ||
      !name ||
      !slugLabel ||
      !startedAt ||
      !dueAt ||
      !owner ||
      startedAt > dueAt
    ) {
      return null;
    }

    const managerIds = new Set([owner.id, ...payload.managerIds]);
    const managers = this.members().filter((member) => managerIds.has(member.id));
    const managerIdSet = new Set(managers.map((member) => member.id));
    const collaboratorIds = new Set(payload.collaboratorIds);
    const collaborators = this.members().filter(
      (member) => collaboratorIds.has(member.id) && !managerIdSet.has(member.id),
    );
    const color = isWorkspaceProjectColor(payload.color) ? payload.color : currentProject.color;
    const icon = isWorkspaceProjectIcon(payload.icon) ? payload.icon : currentProject.icon;
    const duePresentation = this.getProjectDuePresentation(dueAt);
    const updatedProject: WorkspaceProject = {
      ...currentProject,
      name,
      slugLabel,
      description,
      owner: { ...owner },
      managers: managers.map((member) => ({ ...member })),
      collaborators: collaborators.map((member) => ({ ...member })),
      startedAt,
      dueAt,
      color,
      icon,
      isPinned: payload.isPinned,
      allowsOnDemandTasks: payload.allowsOnDemandTasks,
      dueState: duePresentation.dueState,
      dueSummary: duePresentation.dueSummary,
      updatedAt: new Date().toISOString(),
    };

    this.projectsState.update((projects) =>
      projects.map((project) => (project.id === projectId ? updatedProject : project)),
    );
    this.boardsState.update((boards) =>
      Object.fromEntries(
        Object.entries(boards).map(([boardId, columns]) => [
          boardId,
          columns.map((column) => ({
            ...column,
            tasks: column.tasks.map((currentTask) =>
              currentTask.projectId === projectId
                ? {
                    ...currentTask,
                    projectTitle: name,
                    projectAllowsOnDemandTasks: payload.allowsOnDemandTasks,
                    updatedAt: new Date().toISOString(),
                  }
                : currentTask,
            ),
          })),
        ]),
      ),
    );
    this.persistProjects();
    this.persistBoards();

    return cloneProjects([updatedProject])[0] ?? null;
  }

  /** Markiert ein aktives Projekt als abgeschlossen und erhält Board sowie Aufgaben. */
  completeProject(projectId: string): WorkspaceProject | null {
    const currentProject = this.getProject(projectId);

    if (!currentProject || currentProject.status !== 'active') {
      return currentProject ? (cloneProjects([currentProject])[0] ?? null) : null;
    }

    const now = new Date().toISOString();
    const completedProject: WorkspaceProject = {
      ...currentProject,
      status: 'completed',
      completedAt: now,
      archivedAt: null,
      updatedAt: now,
      isPinned: false,
      dueState: 'geringe-restmenge',
      dueSummary: 'Projekt abgeschlossen',
    };

    this.projectsState.update((projects) =>
      projects.map((project) => (project.id === projectId ? completedProject : project)),
    );
    this.persistProjects();

    return cloneProjects([completedProject])[0] ?? null;
  }

  /** Verschiebt ein Projekt unabhängig vom Aufgabenstatus dauerhaft in das Archiv. */
  archiveProject(projectId: string): WorkspaceProject | null {
    const currentProject = this.getProject(projectId);

    if (!currentProject) {
      return null;
    }

    if (currentProject.status === 'archived') {
      return cloneProjects([currentProject])[0] ?? null;
    }

    const now = new Date().toISOString();
    const archivedProject: WorkspaceProject = {
      ...currentProject,
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
      isPinned: false,
      dueState: 'geringe-restmenge',
      dueSummary: 'Projekt archiviert',
    };

    this.projectsState.update((projects) =>
      projects.map((project) => (project.id === projectId ? archivedProject : project)),
    );
    this.persistProjects();

    return cloneProjects([archivedProject])[0] ?? null;
  }

  /**
   * Löscht ein Projekt einschließlich Board, Task-Spiegelungen und Automationsregeln.
   */
  deleteProject(projectId: string): boolean {
    if (!this.getProject(projectId)) {
      return false;
    }

    this.projectsState.update((projects) => projects.filter((project) => project.id !== projectId));
    this.boardsState.update((boards) =>
      Object.fromEntries(
        Object.entries(boards)
          .filter(([boardId]) => boardId !== projectId)
          .map(([boardId, columns]) => [
            boardId,
            this.normalizeDynamicColumns(
              boardId,
              columns.map((column) => ({
                ...column,
                tasks: column.tasks.filter((task) => task.projectId !== projectId),
              })),
            ),
          ]),
      ),
    );

    this.automationService.deleteBoardRules(projectId);
    this.persistProjects();
    this.persistBoards();

    return true;
  }

  /**
   * Erstellt ein neues lokales Projekt inklusive Startboard.
   */
  createProject(payload?: Partial<WorkspaceProjectCreatePayload>): WorkspaceProject {
    const index = this.projectsState().length + 1;
    const id = `project-${Date.now()}`;
    const name = normalizeSingleLineInput(payload?.name ?? '', 80) || `Neues Projekt ${index}`;
    const description =
      normalizeMultilineInput(payload?.description ?? '', 320) ||
      'Ein neuer gemeinsamer Arbeitsbereich für Aufgaben, Mitglieder und Termine.';
    const dueAt = /^\d{4}-\d{2}-\d{2}$/.test(payload?.dueAt ?? '')
      ? (payload?.dueAt ?? isoDate(30))
      : isoDate(30);
    const createdProject: WorkspaceProject = {
      id,
      routeKey: id,
      slugLabel: `PROJEKT ${String(index).padStart(2, '0')}`,
      name,
      description,
      color: '#7752B3',
      icon: 'folder_open',
      status: 'active',
      owner: BEN,
      managers: [BEN],
      collaborators: [],
      startedAt: isoDate(0),
      dueAt,
      updatedAt: new Date().toISOString(),
      completedAt: null,
      archivedAt: null,
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
   * Legt eine lokale Einladung an und ergänzt die Person optional in einem Projekt.
   */
  inviteMember(payload: WorkspaceMemberInvitePayload): WorkspaceMember {
    const fullName = normalizeSingleLineInput(payload.fullName, 80);
    const email = normalizeSingleLineInput(payload.email, 254).toLocaleLowerCase('de');
    const existingMember = this.membersState().find(
      (member) => member.email.toLocaleLowerCase('de') === email,
    );

    if (existingMember) {
      this.addMemberToProject(existingMember, payload.projectId);
      return { ...existingMember };
    }

    const palette = [
      ['#7752B3', '#FFFFFF'],
      ['#D5A646', '#241B2E'],
      ['#4E82A8', '#FFFFFF'],
      ['#4F9572', '#FFFFFF'],
      ['#B9546A', '#FFFFFF'],
    ] as const;
    const colorPair = palette[this.membersState().length % palette.length] ?? palette[0];
    const initials = fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase('de'))
      .join('');
    const member: WorkspaceMember = {
      id: `member-${Date.now()}`,
      fullName: fullName || email.split('@')[0] || 'Neue Person',
      email,
      initials: initials || 'NP',
      avatarColor: colorPair[0],
      avatarTextColor: colorPair[1],
      role: 'member',
      isOnline: false,
    };

    this.membersState.update((members) => [...members, member]);
    this.persistMembers();
    this.addMemberToProject(member, payload.projectId);
    return { ...member };
  }

  /**
   * Speichert eine lokal versendete Nachricht für die spätere Inbox-Anbindung.
   */
  sendMessage(payload: WorkspaceMessageCreatePayload): WorkspaceMessage | null {
    const recipient = this.membersState().find((member) => member.id === payload.recipientId);
    const subject = normalizeSingleLineInput(payload.subject, 120);
    const body = normalizeMultilineInput(payload.body, 2_000);

    if (!recipient || !subject || !body) {
      return null;
    }

    const message: WorkspaceMessage = {
      id: `message-${Date.now()}`,
      recipient: { ...recipient },
      subject,
      body,
      createdAt: new Date().toISOString(),
    };
    this.messagesState.update((messages) => [message, ...messages]);
    this.persistMessages();
    return structuredClone(message);
  }

  /**
   * Schaltet den Abschlussstatus einer Aufgabe um.
   */
  toggleTaskCompleted(projectId: string, taskId: string): WorkspaceColumn[] {
    const currentTask = this.findTask(taskId);
    const sourceColumnId = this.findTaskColumnId(projectId, taskId);
    if (!currentTask) {
      return this.getBoard(projectId);
    }

    const completed = !currentTask.isDone;
    const updatedTask = this.addHistory(
      {
        ...currentTask,
        isDone: completed,
        completedAt: completed ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      completed ? 'Aufgabe abgeschlossen' : 'Aufgabe wieder geöffnet',
      completed ? 'task_alt' : 'restart_alt',
    );
    this.replaceTaskEverywhere(taskId, updatedTask);
    this.applyAutomationMove(
      projectId,
      completed ? 'task.completed' : 'task.reopened',
      taskId,
      sourceColumnId,
    );
    this.reconcileWorkspaceIntake();
    this.persistBoards();
    this.touchProject(projectId);
    return this.getBoard(projectId);
  }

  /**
   * Gibt eine Aufgabe bewusst in den gemeinsamen Pool frei.
   */
  moveTaskToPool(projectId: string, taskId: string): WorkspaceColumn[] {
    const currentTask = this.findTask(taskId);
    if (!currentTask) {
      return this.getBoard(projectId);
    }

    const pooledTask = this.addHistory(
      releaseTaskToPool(currentTask),
      'In den Pool gegeben',
      'inventory_2',
    );
    this.removeTaskEverywhere(taskId);
    this.addTaskToPool(pooledTask);
    this.reconcileWorkspaceIntake();
    this.persistBoards();
    this.touchProject(projectId);
    return this.getBoard(projectId);
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

    this.boardsState.update((boards) => ({
      ...boards,
      [projectId]: this.normalizeDynamicColumns(projectId, cloneColumns(columns)),
    }));
    this.replaceTaskEverywhere(taskId, taskWithHistory);
    if (sourceColumnId !== targetColumnId) {
      this.applyAutomationMove(projectId, 'column.entered', taskId, targetColumnId);
    }
    this.reconcileWorkspaceIntake();
    this.persistBoards();
    this.touchProject(projectId);
    return this.getBoard(projectId);
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
      assignee: project?.owner ?? BEN,
      dueDate: isoDate(7),
      createdOutsideColumn: false,
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
    this.applyAutomationMove(projectId, 'task.created', newTask.id, columnId);
    this.reconcileWorkspaceIntake();
    this.persistBoards();
    return this.getBoard(projectId);
  }

  /**
   * Erstellt eine Aufgabe außerhalb einer konkreten Spalte.
   * Zugewiesene Aufgaben landen im dynamischen Bereich „Neu“ der Person.
   * Aufgaben ohne Zuweisung werden mit Prüfhinweis in den Pool verschoben.
   */
  createUnplacedTask(
    projectId: string | null,
    assigneeId: string | null,
    title = 'Neue Aufgabe',
  ): WorkspaceTask {
    const project = projectId ? this.getProject(projectId) : null;
    const assignee = assigneeId
      ? (this.members().find((member) => member.id === assigneeId) ?? null)
      : null;
    const createdTask = task(`task-${Date.now()}`, title, {
      projectId: project?.id ?? null,
      projectTitle: project?.name ?? null,
      projectAllowsOnDemandTasks: project?.allowsOnDemandTasks ?? false,
      owner: project?.owner ?? BEN,
      assignee,
      tags: [],
      startDate: null,
      dueDate: assignee ? isoDate(7) : null,
      createdOutsideColumn: true,
      isSharedPool: !assignee,
      requiresReview: !assignee,
      reviewHint: assignee ? null : UNASSIGNED_REVIEW_HINT,
    });

    if (!assignee) {
      this.addTaskToPool(createdTask);
    } else {
      this.addTaskToPersonalNewColumn(assignee.id, createdTask);
    }

    this.reconcileWorkspaceIntake();
    this.persistBoards();
    return cloneTask(createdTask);
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
   * Entfernt eine benutzerverwaltete Spalte und erhält enthaltene Aufgaben.
   */
  deleteColumn(projectId: string, columnId: string): WorkspaceColumn[] {
    const columns = this.getBoard(projectId);
    const deletedColumn = columns.find((column) => column.id === columnId);

    if (!deletedColumn || deletedColumn.systemRole) {
      return columns;
    }

    const remainingColumns = columns.filter((column) => column.id !== columnId);
    const fallbackColumn = remainingColumns[0] ?? null;
    let nextColumns = remainingColumns;

    if (fallbackColumn && deletedColumn.tasks.length > 0) {
      nextColumns = remainingColumns.map((column) =>
        column.id === fallbackColumn.id
          ? { ...column, sortMode: null, tasks: [...column.tasks, ...deletedColumn.tasks] }
          : column,
      );
    } else if (!fallbackColumn && deletedColumn.tasks.length > 0) {
      nextColumns = [
        {
          id: `column-unsorted-${Date.now()}`,
          title: 'Unsortiert',
          color: '#8A8093',
          tasks: deletedColumn.tasks,
        },
      ];
    }

    this.saveBoard(projectId, nextColumns);
    return nextColumns;
  }

  /** Liefert alle Wiederholungsregeln des aktuellen Boardkontexts. */
  getRecurrenceRules(projectId: string): WorkspaceTaskRecurrenceRule[] {
    const uniqueRules = new Map<string, WorkspaceTaskRecurrenceRule>();

    this.getBoard(projectId)
      .flatMap((column) => column.tasks)
      .forEach((currentTask) => {
        if (currentTask.recurrenceRule && !uniqueRules.has(currentTask.id)) {
          uniqueRules.set(currentTask.id, {
            ...currentTask.recurrenceRule,
            taskTitle: currentTask.title,
            taskIsDone: currentTask.isDone,
            weekdays: [...currentTask.recurrenceRule.weekdays],
          });
        }
      });

    return [...uniqueRules.values()].sort((left, right) =>
      (left.nextRunOn ?? '9999-12-31').localeCompare(right.nextRunOn ?? '9999-12-31'),
    );
  }

  /** Reserviert oder entfernt eine Wiederholung für eine Aufgabe. */
  reserveTaskRecurrence(projectId: string, taskId: string, enabled: boolean): WorkspaceColumn[] {
    return this.mutateTask(projectId, taskId, (currentTask) => {
      if (!enabled) {
        return this.addHistory(
          {
            ...currentTask,
            isRecurring: false,
            recurrenceLabel: null,
            recurrenceRule: null,
            updatedAt: new Date().toISOString(),
          },
          'Wiederholung entfernt',
          'repeat_on',
        );
      }

      const startDate = currentTask.startDate ?? currentTask.dueDate ?? isoDate(0);
      const recurrenceRule =
        currentTask.recurrenceRule ??
        createDefaultRecurrenceRule(currentTask.id, currentTask.title, projectId, startDate);

      return this.addHistory(
        {
          ...currentTask,
          isRecurring: true,
          recurrenceLabel: recurrenceRule.summary,
          recurrenceRule,
          updatedAt: new Date().toISOString(),
        },
        'Wiederholung vorbereitet',
        'repeat',
      );
    });
  }

  /** Speichert die Regelparameter einer wiederkehrenden Aufgabe. */
  saveTaskRecurrence(
    projectId: string,
    payload: WorkspaceTaskRecurrenceSavePayload,
  ): WorkspaceColumn[] {
    return this.mutateTask(projectId, payload.taskId, (currentTask) => {
      const now = new Date().toISOString();
      const intervalValue = Math.max(1, Number(payload.intervalValue || 1));
      const weekdays = [...payload.weekdays];
      const summary = buildRecurrenceSummary(
        payload.scheduleType,
        intervalValue,
        weekdays,
        payload.dayOfMonth,
      );
      const recurrenceRule: WorkspaceTaskRecurrenceRule = {
        id: currentTask.recurrenceRule?.id ?? `recurrence-${currentTask.id}`,
        taskId: currentTask.id,
        taskTitle: currentTask.title,
        taskIsDone: currentTask.isDone,
        boardId: projectId,
        scheduleType: payload.scheduleType,
        startDate: payload.startDate,
        intervalValue,
        weekdays,
        dayOfMonth: payload.scheduleType === 'monthly_day' ? payload.dayOfMonth : null,
        summary,
        nextRunOn: null,
        lastRunAt: currentTask.recurrenceRule?.lastRunAt ?? null,
        isActive: payload.isActive,
        createdAt: currentTask.recurrenceRule?.createdAt ?? now,
        updatedAt: now,
      };
      recurrenceRule.nextRunOn = calculateNextRecurrenceDate(recurrenceRule);

      return this.addHistory(
        {
          ...currentTask,
          isRecurring: true,
          recurrenceLabel: summary,
          recurrenceRule,
          updatedAt: now,
        },
        'Wiederholungsregel gespeichert',
        'event_repeat',
      );
    });
  }

  /** Schaltet eine bestehende Wiederholungsregel aktiv oder inaktiv. */
  toggleTaskRecurrence(projectId: string, taskId: string, isActive: boolean): WorkspaceColumn[] {
    return this.mutateTask(projectId, taskId, (currentTask) => {
      if (!currentTask.recurrenceRule) {
        return currentTask;
      }

      const recurrenceRule = {
        ...currentTask.recurrenceRule,
        taskTitle: currentTask.title,
        taskIsDone: currentTask.isDone,
        isActive,
        updatedAt: new Date().toISOString(),
      };
      recurrenceRule.nextRunOn = calculateNextRecurrenceDate(recurrenceRule);

      return this.addHistory(
        {
          ...currentTask,
          recurrenceRule,
          recurrenceLabel: recurrenceRule.summary,
          updatedAt: recurrenceRule.updatedAt,
        },
        isActive ? 'Wiederholung aktiviert' : 'Wiederholung pausiert',
        isActive ? 'play_circle' : 'pause_circle',
      );
    });
  }

  /** Entfernt eine Wiederholungsregel vollständig. */
  deleteTaskRecurrence(projectId: string, taskId: string): WorkspaceColumn[] {
    return this.reserveTaskRecurrence(projectId, taskId, false);
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
    const updatedColumns = this.mutateTask(projectId, taskId, (currentTask) => {
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

    if ('assignee' in changes && changes.assignee) {
      this.applyAutomationMove(
        projectId,
        'task.assigned',
        taskId,
        this.findTaskColumnId(projectId, taskId),
      );
      this.reconcileWorkspaceIntake();
      this.persistBoards();
      return this.getBoard(projectId);
    }

    return updatedColumns;
  }

  /**
   * Entfernt eine Aufgabe vollständig aus ihrem Board.
   */
  deleteTask(projectId: string, taskId: string): WorkspaceColumn[] {
    this.removeTaskEverywhere(taskId);
    this.reconcileWorkspaceIntake();
    this.persistBoards();
    this.touchProject(projectId);
    return this.getBoard(projectId);
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

  /** Liefert die aktuelle Spalte einer Aufgabe in einem konkreten Board. */
  private findTaskColumnId(boardId: string, taskId: string): string | null {
    return (
      (this.boardsState()[boardId] ?? []).find((column) =>
        column.tasks.some((item) => item.id === taskId),
      )?.id ?? null
    );
  }

  /** Wendet eine passende lokale Verschieberegel auf ein Task-Ereignis an. */
  private applyAutomationMove(
    boardId: string,
    trigger: WorkspaceAutomationTrigger,
    taskId: string,
    sourceColumnId: string | null,
  ): void {
    const columns = this.getBoard(boardId);
    const currentColumn = columns.find((column) => column.tasks.some((item) => item.id === taskId));
    const currentTask = currentColumn?.tasks.find((item) => item.id === taskId);

    if (!currentColumn || !currentTask) {
      return;
    }

    const targetColumnId = this.automationService.resolveMoveTarget({
      boardId,
      trigger,
      task: currentTask,
      sourceColumnId,
    });
    const targetColumn = columns.find((column) => column.id === targetColumnId);

    if (!targetColumn || targetColumn.id === currentColumn.id) {
      return;
    }

    currentColumn.tasks = currentColumn.tasks.filter((item) => item.id !== taskId);
    const automatedTask = this.addHistory(
      { ...currentTask, updatedAt: new Date().toISOString() },
      `Automatisch nach „${targetColumn.title}“ verschoben`,
      'automation',
    );
    targetColumn.tasks = [automatedTask, ...targetColumn.tasks];
    currentColumn.sortMode = null;
    targetColumn.sortMode = null;

    this.boardsState.update((boards) => ({
      ...boards,
      [boardId]: this.normalizeDynamicColumns(boardId, cloneColumns(columns)),
    }));
    this.replaceTaskEverywhere(taskId, automatedTask);
  }

  /** Wendet eine immutable Mutation auf alle Spiegelungen einer Aufgabe an. */
  private mutateTask(
    projectId: string,
    taskId: string,
    mutation: (task: WorkspaceTask) => WorkspaceTask,
  ): WorkspaceColumn[] {
    const currentTask = this.findTask(taskId);
    if (!currentTask || currentTask.isDone) {
      return this.getBoard(projectId);
    }

    const updatedTask = normalizeTaskCounters(mutation(cloneTask(currentTask)));
    this.replaceTaskEverywhere(taskId, updatedTask);
    this.reconcileWorkspaceIntake();
    this.persistBoards();
    this.touchProject(projectId);
    return this.getBoard(projectId);
  }

  /** Liefert die erste gespeicherte Ausprägung einer Aufgabe. */
  private findTask(taskId: string): WorkspaceTask | null {
    for (const columns of Object.values(this.boardsState())) {
      for (const column of columns) {
        const foundTask = column.tasks.find((item) => item.id === taskId);
        if (foundTask) {
          return cloneTask(foundTask);
        }
      }
    }

    return null;
  }

  /** Ersetzt alle gespeicherten Spiegelungen einer Aufgabe durch denselben Zustand. */
  private replaceTaskEverywhere(taskId: string, updatedTask: WorkspaceTask): void {
    this.boardsState.update((boards) =>
      Object.fromEntries(
        Object.entries(boards).map(([boardId, columns]) => [
          boardId,
          columns.map((column) => ({
            ...column,
            tasks: column.tasks.map((item) => (item.id === taskId ? cloneTask(updatedTask) : item)),
          })),
        ]),
      ),
    );
  }

  /** Entfernt eine Aufgabe aus sämtlichen Board- und Poolplatzierungen. */
  private removeTaskEverywhere(taskId: string): void {
    this.boardsState.update((boards) =>
      Object.fromEntries(
        Object.entries(boards).map(([boardId, columns]) => [
          boardId,
          this.normalizeDynamicColumns(
            boardId,
            columns.map((column) => ({
              ...column,
              tasks: column.tasks.filter((item) => item.id !== taskId),
            })),
          ),
        ]),
      ),
    );
  }

  /** Fügt eine Aufgabe mit optionalem Prüfstatus in den gemeinsamen Pool ein. */
  private addTaskToPool(taskToAdd: WorkspaceTask): void {
    const pooledTask = cloneTask({
      ...taskToAdd,
      assignee: null,
      isSharedPool: true,
      updatedAt: new Date().toISOString(),
    });

    this.boardsState.update((boards) => {
      const poolColumns = cloneColumns(boards[POOL_BOARD_ID] ?? []);
      const reviewColumn =
        poolColumns.find((column) => column.id === POOL_REVIEW_COLUMN_ID) ??
        this.createPoolReviewColumn();
      reviewColumn.tasks = [
        pooledTask,
        ...reviewColumn.tasks.filter((item) => item.id !== pooledTask.id),
      ];

      return {
        ...boards,
        [POOL_BOARD_ID]: [reviewColumn],
      };
    });
  }

  /** Fügt eine Aufgabe in die dynamische Neu-Spalte einer Person ein. */
  private addTaskToPersonalNewColumn(memberId: string, taskToAdd: WorkspaceTask): void {
    const boardId = this.getPersonalBoardId(memberId);
    this.boardsState.update((boards) => {
      const personalColumns = cloneColumns(boards[boardId] ?? []);
      const existingTaskIds = new Set(
        personalColumns.flatMap((column) => column.tasks.map((item) => item.id)),
      );
      if (existingTaskIds.has(taskToAdd.id)) {
        return boards;
      }

      const newColumn =
        personalColumns.find((column) => column.systemRole === 'new-assigned') ??
        this.createPersonalNewColumn(memberId);
      newColumn.tasks = [cloneTask(taskToAdd), ...newColumn.tasks];
      const otherColumns = personalColumns.filter((column) => column.systemRole !== 'new-assigned');

      return {
        ...boards,
        [boardId]: [newColumn, ...otherColumns],
      };
    });
  }

  /** Gleicht Zuweisungen, dynamische Neu-Spalten und Pool-Fallbacks ab. */
  private reconcileWorkspaceIntake(): void {
    const boards = Object.fromEntries(
      Object.entries(this.boardsState()).map(([boardId, columns]) => [
        boardId,
        cloneColumns(columns),
      ]),
    );
    const poolColumn =
      boards[POOL_BOARD_ID]?.find((column) => column.id === POOL_REVIEW_COLUMN_ID) ??
      this.createPoolReviewColumn();
    const pooledIds = new Set(poolColumn.tasks.map((item) => item.id));

    for (const [boardId, columns] of Object.entries(boards)) {
      if (boardId === POOL_BOARD_ID) {
        continue;
      }

      for (const column of columns) {
        const retainedTasks: WorkspaceTask[] = [];
        for (const currentTask of column.tasks) {
          if (!currentTask.isDone && !currentTask.assignee) {
            if (!pooledIds.has(currentTask.id)) {
              const requiresReview = currentTask.requiresReview || !currentTask.isSharedPool;
              const reviewTask = this.addHistory(
                {
                  ...currentTask,
                  assignee: null,
                  isSharedPool: true,
                  requiresReview,
                  reviewHint: requiresReview ? UNASSIGNED_REVIEW_HINT : null,
                  updatedAt: new Date().toISOString(),
                },
                requiresReview ? 'Zur Prüfung in den Pool verschoben' : 'In den Pool übernommen',
                requiresReview ? 'rate_review' : 'inventory_2',
              );
              poolColumn.tasks.unshift(reviewTask);
              pooledIds.add(reviewTask.id);
            }
            continue;
          }

          retainedTasks.push(currentTask);
        }
        column.tasks = retainedTasks;
      }
    }

    boards[POOL_BOARD_ID] = [poolColumn];

    const assignedTaskMap = new Map<string, WorkspaceTask>();
    Object.entries(boards)
      .filter(([boardId]) => boardId !== POOL_BOARD_ID)
      .flatMap(([, columns]) => columns.flatMap((column) => column.tasks))
      .forEach((item) => {
        if (!item.isDone && !item.isSharedPool && item.assignee && !assignedTaskMap.has(item.id)) {
          assignedTaskMap.set(item.id, item);
        }
      });

    for (const member of this.members()) {
      const personalBoardId = this.getPersonalBoardId(member.id);
      const currentColumns = cloneColumns(boards[personalBoardId] ?? []);
      const assignedProjectTasks = [...assignedTaskMap.values()].filter(
        (item) => item.assignee?.id === member.id,
      );
      const assignedProjectTaskIds = new Set(assignedProjectTasks.map((item) => item.id));
      const cleanedColumns = currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((item) => {
          if (item.createdOutsideColumn || !item.projectId) {
            return item.assignee?.id === member.id && !item.isSharedPool;
          }

          return item.assignee?.id === member.id && !item.isSharedPool;
        }),
      }));
      const existingTaskIds = new Set(
        cleanedColumns.flatMap((column) => column.tasks.map((item) => item.id)),
      );
      const missingTasks = assignedProjectTasks.filter((item) => !existingTaskIds.has(item.id));
      const existingNewColumn = cleanedColumns.find(
        (column) => column.systemRole === 'new-assigned',
      );
      const newColumnTasks = [
        ...missingTasks,
        ...(existingNewColumn?.tasks ?? []).filter(
          (item) => item.createdOutsideColumn || assignedProjectTaskIds.has(item.id),
        ),
      ].filter(
        (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index,
      );
      const regularColumns = cleanedColumns.filter(
        (column) => column.systemRole !== 'new-assigned',
      );

      boards[personalBoardId] = newColumnTasks.length
        ? [
            {
              ...(existingNewColumn ?? this.createPersonalNewColumn(member.id)),
              tasks: newColumnTasks.map(cloneTask),
            },
            ...regularColumns,
          ]
        : regularColumns;
    }

    this.boardsState.set(
      Object.fromEntries(
        Object.entries(boards).map(([boardId, columns]) => [
          boardId,
          this.normalizeDynamicColumns(boardId, columns),
        ]),
      ),
    );
  }

  /** Erstellt die dynamische Neu-Spalte einer Person. */
  private createPersonalNewColumn(memberId: string): WorkspaceColumn {
    return {
      id: `${PERSONAL_NEW_COLUMN_ID}-${memberId}`,
      title: 'Neu',
      color: '#7752B3',
      isFixedPosition: true,
      isDynamic: true,
      systemRole: 'new-assigned',
      tasks: [],
    };
  }

  /** Erstellt die systemverwaltete Prüfspalte des Pools. */
  private createPoolReviewColumn(): WorkspaceColumn {
    return {
      id: POOL_REVIEW_COLUMN_ID,
      title: 'Prüfung',
      color: '#D5A646',
      isFixedPosition: true,
      isDynamic: true,
      systemRole: 'pool-review',
      tasks: [],
    };
  }

  /** Liefert den lokalen Personal-Board-Key einer Person. */
  private getPersonalBoardId(memberId: string): string {
    return memberId === BEN.id ? PERSONAL_BOARD_ID : `personal-${memberId}`;
  }

  /** Prüft, ob ein Board ein persönliches Board repräsentiert. */
  private isPersonalBoardId(boardId: string): boolean {
    return boardId === PERSONAL_BOARD_ID || boardId.startsWith('personal-');
  }

  /** Entfernt leere dynamische Spalten aus normalen Boardansichten. */
  private normalizeDynamicColumns(boardId: string, columns: WorkspaceColumn[]): WorkspaceColumn[] {
    const normalizedColumns = columns.map((column) => ({
      ...column,
      isFixedPosition: column.systemRole ? true : undefined,
    }));

    if (boardId === POOL_BOARD_ID) {
      return normalizedColumns.length ? normalizedColumns : [this.createPoolReviewColumn()];
    }

    return normalizedColumns.filter((column) => !column.isDynamic || column.tasks.length > 0);
  }

  /** Ermittelt Terminstatus und Kurztext für bearbeitete Projekte. */
  private getProjectDuePresentation(dueAt: string): {
    dueState: WorkspaceProject['dueState'];
    dueSummary: string;
  } {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dueDate = new Date(`${dueAt}T12:00:00`);
    const remainingDays = Math.ceil((dueDate.getTime() - today.getTime()) / day);

    if (remainingDays < 0) {
      return { dueState: 'ueberfaellig', dueSummary: 'Projekttermin überschritten' };
    }

    if (remainingDays <= 7) {
      return { dueState: 'kritisch', dueSummary: 'Projekttermin ist kurzfristig' };
    }

    if (remainingDays <= 14) {
      return { dueState: 'bald-faellig', dueSummary: 'Termin rückt näher' };
    }

    return { dueState: 'im-plan', dueSummary: 'Projektzeitraum liegt im Plan' };
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

  /** Ergänzt eine eingeladene Person ohne Duplikate in einem Projekt. */
  private addMemberToProject(member: WorkspaceMember, projectId: string | null): void {
    if (!projectId) {
      return;
    }

    this.projectsState.update((projects) =>
      projects.map((project) => {
        if (
          project.id !== projectId ||
          [...project.managers, ...project.collaborators].some((item) => item.id === member.id)
        ) {
          return project;
        }

        return {
          ...project,
          collaborators: [...project.collaborators, { ...member }],
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    this.persistProjects();
  }

  /** Speichert lokal eingeladene Personen im Browser-Speicher. */
  private persistMembers(): void {
    try {
      window.localStorage.setItem(
        WORKSPACE_MEMBERS_STORAGE_KEY,
        JSON.stringify(this.membersState()),
      );
    } catch {
      // Die Vorschau bleibt ohne Browser-Speicher funktionsfähig.
    }
  }

  /** Speichert lokal versendete Nachrichten im Browser-Speicher. */
  private persistMessages(): void {
    try {
      window.localStorage.setItem(
        WORKSPACE_MESSAGES_STORAGE_KEY,
        JSON.stringify(this.messagesState()),
      );
    } catch {
      // Die Vorschau bleibt ohne Browser-Speicher funktionsfähig.
    }
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
