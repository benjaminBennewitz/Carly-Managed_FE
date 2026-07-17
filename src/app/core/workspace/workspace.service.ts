// src/app/core/workspace/workspace.service.ts

import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

import { API_BASE_URL } from '../api/api.config';
import { PaginatedResponse, unwrapCollection } from '../api/api.models';
import { SessionService } from '../auth/services/session.service';
import { WorkspaceInboxService } from '../inbox/workspace-inbox.service';
import {
  ArchivedTaskEntry,
  TaskPriority,
  WorkspaceAttachment,
  WorkspaceColumn,
  WorkspaceColumnSortMode,
  WorkspaceComment,
  WorkspaceJoinRequest,
  WorkspaceMember,
  WorkspaceMemberInvitePayload,
  WorkspaceMemberSavePayload,
  WorkspaceMessage,
  WorkspaceMessageCreatePayload,
  WorkspaceProject,
  WorkspaceProjectCreatePayload,
  WorkspaceProjectUpdatePayload,
  WorkspaceSubtask,
  WorkspaceTask,
  WorkspaceTaskRecurrenceRule,
  WorkspaceTaskRecurrenceSavePayload,
} from './workspace.models';

interface WorkspaceApiModel {
  id: string;
  name: string;
  currentRole: 'owner' | 'manager' | 'member';
  version: number;
}

interface BoardApiModel {
  id: string;
  title: string;
  kind: 'personal' | 'project';
  projectId: string | null;
  columns: WorkspaceColumn[];
  version: number;
}

interface BoardMeta {
  id: string;
  version: number;
}

const PERSONAL_BOARD_KEY = 'personal';
const DEFAULT_PROJECT_COLOR = '#7752B3';
const DEFAULT_PROJECT_ICON = 'folder';

/** Erzeugt eine von den Signalzuständen unabhängige Kopie. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Erzeugt eine sichere temporäre UUID für optimistische Eingaben. */
function createUuid(): string {
  return crypto.randomUUID();
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly workspaceIdState = signal<string | null>(null);
  private readonly projectsState = signal<WorkspaceProject[]>([]);
  private readonly boardsState = signal<Record<string, WorkspaceColumn[]>>({});
  private readonly boardMetaState = signal<Record<string, BoardMeta>>({});
  private readonly membersState = signal<WorkspaceMember[]>([]);
  private readonly joinRequestsState = signal<WorkspaceJoinRequest[]>([]);
  private readonly messagesState = signal<WorkspaceMessage[]>([]);
  private readonly archivedTaskState = signal<WorkspaceTask[]>([]);
  private readonly loadingState = signal(false);

  readonly loading = this.loadingState.asReadonly();
  readonly workspaceId = this.workspaceIdState.asReadonly();
  readonly projects = computed(() =>
    this.projectsState()
      .filter((project) => project.status === 'active')
      .sort((left, right) => Number(right.isPinned) - Number(left.isPinned)),
  );
  readonly pinnedProjects = computed(() => this.projects().filter((project) => project.isPinned));
  readonly archivedProjects = computed(() =>
    this.projectsState().filter((project) => project.status !== 'active'),
  );
  readonly collaborativeProjects = computed(() => {
    const currentUserId = this.sessionService.currentUser()?.id;
    return this.projects().filter((project) =>
      [...project.managers, ...project.collaborators].some((member) => member.id === currentUserId),
    );
  });
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
  readonly joinRequests = this.joinRequestsState.asReadonly();
  readonly sentMessages = this.messagesState.asReadonly();
  readonly poolTasks = computed(() =>
    Object.values(this.boardsState())
      .flatMap((columns) => columns.flatMap((column) => column.tasks))
      .filter((task) => task.isSharedPool)
      .sort(
        (left, right) =>
          Number(right.requiresReview) - Number(left.requiresReview) ||
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
  );
  readonly poolReviewCount = computed(
    () => this.poolTasks().filter((task) => task.requiresReview).length,
  );
  readonly archivedTasks = computed<ArchivedTaskEntry[]>(() =>
    this.archivedTaskState().map((task) => ({
      task,
      sourceLabel: task.projectTitle ?? 'Mein Board',
      archivedAt: task.updatedAt,
    })),
  );

  constructor(
    private readonly http: HttpClient,
    private readonly sessionService: SessionService,
    private readonly inboxService: WorkspaceInboxService,
  ) {
    this.reload();
  }

  /** Lädt den vollständigen persistierten Workspace-Snapshot. */
  reload(): void {
    this.loadData().subscribe();
  }

  /** Lädt alle für die Oberfläche benötigten Daten und meldet den Abschluss. */
  loadData(): Observable<void> {
    this.loadingState.set(true);
    return this.http.get<WorkspaceApiModel[]>(`${API_BASE_URL}/workspaces/`).pipe(
      switchMap((workspaces) => {
        const workspace =
          workspaces.find((item) => item.name === 'Carly Managed Demo') ?? workspaces[0] ?? null;
        if (!workspace) {
          this.clearState();
          return of(undefined);
        }

        this.workspaceIdState.set(workspace.id);
        return forkJoin({
          members: this.http.get<WorkspaceMember[]>(
            `${API_BASE_URL}/workspaces/${workspace.id}/members/`,
          ),
          projects: this.http.get<WorkspaceProject[] | PaginatedResponse<WorkspaceProject>>(
            `${API_BASE_URL}/workspaces/projects/?workspaceId=${workspace.id}`,
          ),
          boards: this.http.get<BoardApiModel[]>(`${API_BASE_URL}/workspaces/boards/`),
          joinRequests: this.http.get<
            WorkspaceJoinRequest[] | PaginatedResponse<WorkspaceJoinRequest>
          >(`${API_BASE_URL}/workspaces/join-requests/?workspaceId=${workspace.id}`),
          archivedTasks: this.http.get<WorkspaceTask[] | PaginatedResponse<WorkspaceTask>>(
            `${API_BASE_URL}/workspaces/tasks/?archived=true`,
          ),
        }).pipe(
          tap(({ members, projects, boards, joinRequests, archivedTasks }) => {
            this.membersState.set(members);
            this.projectsState.set(unwrapCollection(projects));
            this.joinRequestsState.set(
              unwrapCollection(joinRequests).filter(
                (request) => !request.status || request.status === 'pending',
              ),
            );
            this.archivedTaskState.set(unwrapCollection(archivedTasks));
            this.applyBoards(boards);
            this.inboxService.reload(workspace.id);
          }),
          map(() => undefined),
        );
      }),
      tap({ finalize: () => this.loadingState.set(false) }),
      catchError(() => {
        this.loadingState.set(false);
        return of(undefined);
      }),
    );
  }

  /** Liefert die Anzahl dynamisch eingegangener Aufgaben. */
  getDynamicNewColumnTaskCount(): number {
    return Object.values(this.boardsState())
      .flatMap((columns) => columns)
      .filter((column) => column.systemRole === 'new-assigned')
      .reduce((sum, column) => sum + column.tasks.length, 0);
  }

  /** Lädt den Workspace nach geänderten Intake-Einstellungen neu. */
  refreshIntakePreferences(): void {
    this.reload();
  }

  /** Synchronisiert die serverseitig gespeicherten Mitgliedsdaten neu. */
  applyCurrentMemberPrivacy(): void {
    this.reload();
  }

  /** Liefert ein Projekt anhand seiner UUID. */
  getProject(projectId: string): WorkspaceProject | null {
    return clone(this.projectsState().find((project) => project.id === projectId) ?? null);
  }

  /** Liefert die persistierte Board-UUID für einen Route-Schlüssel. */
  getBoardApiId(projectId: string): string | null {
    return this.boardMetaState()[projectId]?.id ?? null;
  }

  /** Liefert ein persönliches oder projektbezogenes Board. */
  getBoard(projectId: string): WorkspaceColumn[] {
    return clone(this.boardsState()[projectId] ?? []);
  }

  /** Übernimmt einen bereits über Einzelaktionen persistierten Boardzustand lokal. */
  saveBoard(projectId: string, columns: WorkspaceColumn[]): void {
    this.boardsState.update((boards) => ({ ...boards, [projectId]: clone(columns) }));
  }

  /** Zählt sämtliche Aufgaben eines Boards. */
  getTaskCount(projectId: string): number {
    return this.getBoard(projectId).reduce((sum, column) => sum + column.tasks.length, 0);
  }

  /** Zählt offene Aufgaben eines Boards. */
  getOpenTaskCount(projectId: string): number {
    return this.getBoard(projectId).reduce(
      (sum, column) => sum + column.tasks.filter((task) => !task.isDone).length,
      0,
    );
  }

  /** Zählt überfällige offene Aufgaben eines Boards. */
  getOverdueTaskCount(projectId: string): number {
    const today = new Date().toISOString().slice(0, 10);
    return this.getBoard(projectId).reduce(
      (sum, column) =>
        sum +
        column.tasks.filter((task) => !task.isDone && !!task.dueDate && task.dueDate < today)
          .length,
      0,
    );
  }

  /** Zählt die Spalten eines Boards. */
  getColumnCount(projectId: string): number {
    return this.getBoard(projectId).length;
  }

  /** Pinnt oder entpinnt ein Projekt nutzerspezifisch. */
  toggleProjectPinned(projectId: string): void {
    const project = this.getProject(projectId);
    if (!project) return;
    this.patchProjectState({ ...project, isPinned: !project.isPinned });
    this.http
      .post<WorkspaceProject>(`${API_BASE_URL}/workspaces/projects/${projectId}/pin/`, {
        isPinned: !project.isPinned,
      })
      .subscribe({
        next: (updated) => this.patchProjectState(updated),
        error: () => this.reload(),
      });
  }

  /** Aktualisiert den letzten Öffnungszeitpunkt serverseitig. */
  markProjectOpened(projectId: string): void {
    const project = this.getProject(projectId);
    if (project) this.patchProjectState({ ...project, lastOpenedAt: new Date().toISOString() });
    this.http
      .post<void>(`${API_BASE_URL}/workspaces/projects/${projectId}/mark-opened/`, {})
      .subscribe({ error: () => this.reload() });
  }

  /** Speichert bearbeitbare Projektdaten mit Versionsprüfung. */
  updateProject(
    projectId: string,
    payload: WorkspaceProjectUpdatePayload,
  ): WorkspaceProject | null {
    const current = this.getProject(projectId);
    if (!current) return null;
    const optimistic: WorkspaceProject = {
      ...current,
      ...payload,
      owner: this.memberById(payload.ownerId) ?? current.owner,
      managers: payload.managerIds
        .map((id) => this.memberById(id))
        .filter(Boolean) as WorkspaceMember[],
      collaborators: payload.collaboratorIds
        .map((id) => this.memberById(id))
        .filter(Boolean) as WorkspaceMember[],
      updatedAt: new Date().toISOString(),
    };
    this.patchProjectState(optimistic);
    this.http
      .patch<WorkspaceProject>(`${API_BASE_URL}/workspaces/projects/${projectId}/`, {
        ...payload,
        version: current.version,
      })
      .subscribe({
        next: (updated) => this.patchProjectState(updated),
        error: () => this.reload(),
      });
    return clone(optimistic);
  }

  /** Markiert ein Projekt als abgeschlossen. */
  completeProject(projectId: string): WorkspaceProject | null {
    return this.changeProjectStatus(projectId, 'complete', 'completed');
  }

  /** Archiviert ein Projekt. */
  archiveProject(projectId: string): WorkspaceProject | null {
    return this.changeProjectStatus(projectId, 'archive', 'archived');
  }

  /** Löscht ein Projekt nach aktueller Versionsprüfung. */
  deleteProject(projectId: string): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;
    this.projectsState.update((projects) => projects.filter((item) => item.id !== projectId));
    this.boardsState.update((boards) => {
      const next = { ...boards };
      delete next[projectId];
      return next;
    });
    this.http
      .delete<void>(
        `${API_BASE_URL}/workspaces/projects/${projectId}/?version=${project.version ?? 1}`,
      )
      .subscribe({ error: () => this.reload() });
    return true;
  }

  /** Erstellt ein Projekt samt serverseitigem Startboard. */
  createProject(payload: Partial<WorkspaceProjectCreatePayload> = {}): WorkspaceProject {
    const owner = this.currentMember();
    const id = createUuid();
    const today = new Date().toISOString().slice(0, 10);
    const dueAt = payload.dueAt ?? this.dateAfterDays(30);
    const project: WorkspaceProject = {
      id,
      routeKey: id,
      slugLabel: (payload.name ?? 'Neues Projekt').slice(0, 12).toLocaleUpperCase('de'),
      name: payload.name?.trim() || 'Neues Projekt',
      description: payload.description?.trim() || '',
      color: DEFAULT_PROJECT_COLOR,
      icon: DEFAULT_PROJECT_ICON,
      status: 'active',
      owner,
      managers: [owner],
      collaborators: [],
      startedAt: today,
      dueAt,
      updatedAt: new Date().toISOString(),
      completedAt: null,
      archivedAt: null,
      lastOpenedAt: new Date().toISOString(),
      isPinned: false,
      allowsOnDemandTasks: false,
      dueState: 'im-plan',
      dueSummary: '',
      version: 1,
    };
    this.projectsState.update((projects) => [...projects, project]);
    this.boardsState.update((boards) => ({ ...boards, [id]: [] }));
    const workspaceId = this.workspaceIdState();
    if (workspaceId) {
      this.http
        .post<WorkspaceProject>(`${API_BASE_URL}/workspaces/projects/`, {
          id,
          workspaceId,
          name: project.name,
          description: project.description,
          dueAt,
          startedAt: today,
          ownerId: owner.id,
          managerIds: [owner.id],
          collaboratorIds: [],
          color: project.color,
          icon: project.icon,
          slugLabel: project.slugLabel,
        })
        .subscribe({ next: () => this.reload(), error: () => this.reload() });
    }
    return clone(project);
  }

  /** Versendet eine Einladung für die im Mitgliederformular erfassten Daten. */
  createMember(payload: WorkspaceMemberSavePayload): Observable<void> {
    return this.inviteMember({
      fullName: payload.fullName,
      email: payload.email,
      projectId: null,
    });
  }

  /** Aktualisiert Rolle und Avatarfarbe eines Mitglieds. */
  updateMember(memberId: string, payload: WorkspaceMemberSavePayload): WorkspaceMember | null {
    const workspaceId = this.workspaceIdState();
    const current = this.memberById(memberId);
    if (!workspaceId || !current) return null;
    const optimistic = { ...current, role: payload.role, avatarColor: payload.avatarColor };
    this.membersState.update((members) =>
      members.map((member) => (member.id === memberId ? optimistic : member)),
    );
    this.http
      .patch<WorkspaceMember>(`${API_BASE_URL}/workspaces/${workspaceId}/members/`, {
        memberId,
        role: payload.role,
        avatarColor: payload.avatarColor,
      })
      .subscribe({ next: (updated) => this.replaceMember(updated), error: () => this.reload() });
    return clone(optimistic);
  }

  /** Entfernt ein Mitglied aus dem aktiven Workspace. */
  deleteMember(memberId: string): boolean {
    const workspaceId = this.workspaceIdState();
    if (!workspaceId || !this.memberById(memberId)) return false;
    this.membersState.update((members) => members.filter((member) => member.id !== memberId));
    this.http
      .request<void>('DELETE', `${API_BASE_URL}/workspaces/${workspaceId}/members/`, {
        body: { memberId },
      })
      .subscribe({ error: () => this.reload() });
    return true;
  }

  /** Genehmigt eine offene Beitrittsanfrage. */
  approveJoinRequest(requestId: string): WorkspaceMember | null {
    const request = this.joinRequestsState().find((item) => item.id === requestId);
    if (!request) return null;
    this.joinRequestsState.update((items) => items.filter((item) => item.id !== requestId));
    this.http
      .post<WorkspaceMember>(`${API_BASE_URL}/workspaces/join-requests/${requestId}/approve/`, {})
      .subscribe({ next: () => this.reload(), error: () => this.reload() });
    return {
      id: createUuid(),
      fullName: request.fullName,
      email: request.email,
      initials: this.initials(request.fullName),
      avatarColor: request.avatarColor,
      avatarTextColor: '#ffffff',
      role: 'member',
      isOnline: false,
    };
  }

  /** Lehnt eine offene Beitrittsanfrage ab. */
  rejectJoinRequest(requestId: string): boolean {
    if (!this.joinRequestsState().some((item) => item.id === requestId)) return false;
    this.joinRequestsState.update((items) => items.filter((item) => item.id !== requestId));
    this.http
      .post<void>(`${API_BASE_URL}/workspaces/join-requests/${requestId}/reject/`, {})
      .subscribe({ error: () => this.reload() });
    return true;
  }

  /** Erstellt eine echte Workspace- oder Projekteinladung. */
  inviteMember(payload: WorkspaceMemberInvitePayload): Observable<void> {
    const workspaceId = this.workspaceIdState();
    if (!workspaceId) {
      return throwError(() => new Error('Kein aktiver Workspace verfügbar.'));
    }
    return this.http
      .post(`${API_BASE_URL}/workspaces/invitations/`, { workspaceId, ...payload })
      .pipe(map(() => undefined));
  }

  /** Erstellt eine direkte Unterhaltung über die Inbox-API. */
  sendMessage(payload: WorkspaceMessageCreatePayload): WorkspaceMessage | null {
    const recipient = this.memberById(payload.recipientId);
    const workspaceId = this.workspaceIdState();
    if (!recipient || !workspaceId) return null;
    this.inboxService.createConversation(
      workspaceId,
      payload.subject,
      [recipient.id],
      payload.body,
    );
    const message: WorkspaceMessage = {
      id: createUuid(),
      recipient,
      subject: payload.subject,
      body: payload.body,
      createdAt: new Date().toISOString(),
    };
    this.messagesState.update((messages) => [message, ...messages]);
    return message;
  }

  /** Sucht einen Task in allen geladenen Boards. */
  getTaskById(taskId: string): WorkspaceTask | null {
    return clone(this.findTask(taskId)?.task ?? null);
  }

  /** Schaltet den Erledigt-Status einer Aufgabe um. */
  toggleTaskCompleted(projectId: string, taskId: string): WorkspaceColumn[] {
    const found = this.findTask(taskId);
    if (!found) return this.getBoard(projectId);
    const isDone = !found.task.isDone;
    this.updateLocalTask({
      ...found.task,
      isDone,
      completedAt: isDone ? new Date().toISOString() : null,
    });
    this.http
      .post<WorkspaceTask>(
        `${API_BASE_URL}/workspaces/tasks/${taskId}/${isDone ? 'complete' : 'reopen'}/`,
        { version: found.task.version ?? 1 },
      )
      .subscribe({ next: (task) => this.updateLocalTask(task), error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Gibt eine Aufgabe für den gemeinsamen Pool frei. */
  moveTaskToPool(projectId: string, taskId: string): WorkspaceColumn[] {
    return this.updateTask(projectId, taskId, {
      isSharedPool: true,
      requiresReview: false,
      reviewHint: null,
    } as Partial<WorkspaceTask>);
  }

  /** Verschiebt eine Aufgabe positionsgenau in eine andere Spalte. */
  moveTask(
    projectId: string,
    taskId: string,
    sourceColumnId: string,
    targetColumnId: string,
    targetIndex: number,
  ): WorkspaceColumn[] {
    const columns = this.getBoard(projectId);
    const source = columns.find((column) => column.id === sourceColumnId);
    const target = columns.find((column) => column.id === targetColumnId);
    const index = source?.tasks.findIndex((task) => task.id === taskId) ?? -1;
    if (!source || !target || index < 0) return columns;
    const [task] = source.tasks.splice(index, 1);
    if (!task) return columns;
    target.tasks.splice(Math.max(0, Math.min(targetIndex, target.tasks.length)), 0, task);
    this.saveBoard(projectId, columns);
    this.http
      .post<WorkspaceTask>(`${API_BASE_URL}/workspaces/tasks/${taskId}/move/`, {
        targetColumnId,
        targetPosition: targetIndex,
        version: task.version ?? 1,
      })
      .subscribe({
        next: (updated) => this.updateLocalTask(updated, targetColumnId),
        error: () => this.reload(),
      });
    return this.getBoard(projectId);
  }

  /** Speichert die Farbe einer Spalte. */
  updateColumnColor(projectId: string, columnId: string, color: string): WorkspaceColumn[] {
    return this.updateColumn(projectId, columnId, { color });
  }

  /** Speichert den Sortiermodus einer Spalte. */
  sortColumn(
    projectId: string,
    columnId: string,
    mode: WorkspaceColumnSortMode,
  ): WorkspaceColumn[] {
    const columns = this.updateColumn(projectId, columnId, { sortMode: mode });
    if (mode) {
      const sorted = columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              tasks: [...column.tasks].sort((left, right) =>
                mode === 'title'
                  ? left.title.localeCompare(right.title, 'de')
                  : (left.dueDate ?? '9999').localeCompare(right.dueDate ?? '9999'),
              ),
            }
          : column,
      );
      this.saveBoard(projectId, sorted);
      return sorted;
    }
    return columns;
  }

  /** Erstellt eine Aufgabe am Anfang einer Spalte. */
  addTask(projectId: string, columnId: string): WorkspaceColumn[] {
    this.createTask(projectId, columnId, this.currentMember().id, 'Neue Aufgabe', false);
    return this.getBoard(projectId);
  }

  /** Erstellt eine Aufgabe außerhalb eines konkreten Workflows. */
  createUnplacedTask(
    projectId: string | null,
    assigneeId: string | null,
    title = 'Neue Aufgabe',
  ): WorkspaceTask {
    const boardKey = projectId ?? PERSONAL_BOARD_KEY;
    const columns = this.getBoard(boardKey);
    const target =
      columns.find((column) => column.systemRole === 'new-assigned') ?? columns[0] ?? null;
    return this.createTask(boardKey, target?.id ?? null, assigneeId, title, !assigneeId);
  }

  /** Benennt eine Spalte um. */
  renameColumn(projectId: string, columnId: string, title: string): WorkspaceColumn[] {
    return this.updateColumn(projectId, columnId, { title: title.trim() });
  }

  /** Löscht eine benutzerverwaltete Spalte. */
  deleteColumn(projectId: string, columnId: string): WorkspaceColumn[] {
    const column = this.getBoard(projectId).find((item) => item.id === columnId);
    if (!column || column.systemRole) return this.getBoard(projectId);
    this.boardsState.update((boards) => ({
      ...boards,
      [projectId]: (boards[projectId] ?? []).filter((item) => item.id !== columnId),
    }));
    this.http
      .delete<void>(
        `${API_BASE_URL}/workspaces/columns/${columnId}/?version=${column.version ?? 1}`,
      )
      .subscribe({ error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Liefert alle Wiederholungsregeln eines Boards. */
  getRecurrenceRules(projectId: string): WorkspaceTaskRecurrenceRule[] {
    return this.getBoard(projectId)
      .flatMap((column) => column.tasks)
      .map((task) => task.recurrenceRule)
      .filter((rule): rule is WorkspaceTaskRecurrenceRule => !!rule);
  }

  /** Reserviert oder entfernt eine Wiederholung mit einem Standardplan. */
  reserveTaskRecurrence(projectId: string, taskId: string, enabled: boolean): WorkspaceColumn[] {
    if (!enabled) return this.deleteTaskRecurrence(projectId, taskId);
    const task = this.getTaskById(taskId);
    if (!task || task.recurrenceRule) return this.getBoard(projectId);
    return this.saveTaskRecurrence(projectId, {
      taskId,
      scheduleType: 'interval_days',
      startDate: task.dueDate ?? new Date().toISOString().slice(0, 10),
      intervalValue: 7,
      weekdays: [],
      dayOfMonth: null,
      isActive: true,
    });
  }

  /** Speichert eine Wiederholungsregel. */
  saveTaskRecurrence(
    projectId: string,
    payload: WorkspaceTaskRecurrenceSavePayload,
  ): WorkspaceColumn[] {
    const task = this.getTaskById(payload.taskId);
    if (!task) return this.getBoard(projectId);
    this.http
      .put<WorkspaceTaskRecurrenceRule>(
        `${API_BASE_URL}/workspaces/tasks/${payload.taskId}/recurrence/`,
        { ...payload, version: task.recurrenceRule?.version },
      )
      .subscribe({
        next: (rule) =>
          this.updateLocalTask({
            ...task,
            recurrenceRule: rule,
            recurrenceLabel: rule.summary,
            isRecurring: true,
          }),
        error: () => this.reload(),
      });
    return this.getBoard(projectId);
  }

  /** Aktiviert oder deaktiviert eine vorhandene Regel. */
  toggleTaskRecurrence(projectId: string, taskId: string, isActive: boolean): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    const rule = task?.recurrenceRule;
    if (!task || !rule) return this.getBoard(projectId);
    return this.saveTaskRecurrence(projectId, {
      taskId,
      scheduleType: rule.scheduleType,
      startDate: rule.startDate,
      intervalValue: rule.intervalValue,
      weekdays: rule.weekdays,
      dayOfMonth: rule.dayOfMonth,
      isActive,
    });
  }

  /** Löscht die Wiederholungsregel eines Tasks. */
  deleteTaskRecurrence(projectId: string, taskId: string): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    const rule = task?.recurrenceRule;
    if (!task || !rule) return this.getBoard(projectId);
    this.updateLocalTask({
      ...task,
      recurrenceRule: null,
      recurrenceLabel: null,
      isRecurring: false,
    });
    this.http
      .delete<void>(
        `${API_BASE_URL}/workspaces/tasks/${taskId}/recurrence/?version=${rule.version ?? 1}`,
      )
      .subscribe({ error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Aktualisiert die Kerndaten einer Aufgabe. */
  updateTask(
    projectId: string,
    taskId: string,
    changes: Partial<WorkspaceTask>,
    _historyAction = 'Aufgabe aktualisiert',
    _historyIcon = 'edit_note',
  ): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    if (!task) return this.getBoard(projectId);
    const optimistic = { ...task, ...changes, updatedAt: new Date().toISOString() };
    this.updateLocalTask(optimistic);
    this.http
      .patch<WorkspaceTask>(`${API_BASE_URL}/workspaces/tasks/${taskId}/`, {
        title: changes.title,
        description: changes.description,
        priority: changes.priority,
        assigneeId: changes.assignee === undefined ? undefined : (changes.assignee?.id ?? null),
        collaboratorIds: changes.collaborators?.map((member) => member.id),
        startDate: changes.startDate,
        dueDate: changes.dueDate,
        dueTime: changes.dueTime,
        tags: changes.tags,
        isSharedPool: changes.isSharedPool,
        requiresReview: changes.requiresReview,
        reviewHint: changes.reviewHint,
        version: task.version ?? 1,
      })
      .subscribe({ next: (updated) => this.updateLocalTask(updated), error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Löscht einen Task dauerhaft. */
  deleteTask(projectId: string, taskId: string): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    if (!task) return this.getBoard(projectId);
    this.removeLocalTask(taskId);
    this.http
      .delete<void>(`${API_BASE_URL}/workspaces/tasks/${taskId}/?version=${task.version ?? 1}`)
      .subscribe({ error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Fügt eine Unteraufgabe hinzu. */
  addSubtask(
    projectId: string,
    taskId: string,
    title: string,
    assigneeId: string | null = null,
  ): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    if (!task || !title.trim()) return this.getBoard(projectId);
    const subtask: WorkspaceSubtask = {
      id: createUuid(),
      title: title.trim(),
      assignee: this.memberById(assigneeId),
      isDone: false,
      createdAt: new Date().toISOString(),
      version: 1,
    };
    this.updateLocalTask({
      ...task,
      subtasks: [...task.subtasks, subtask],
      subtaskCount: task.subtaskCount + 1,
    });
    this.http
      .post<WorkspaceSubtask>(`${API_BASE_URL}/workspaces/tasks/${taskId}/subtasks/`, {
        id: subtask.id,
        title: subtask.title,
        assigneeId,
      })
      .subscribe({
        next: (saved) => this.replaceSubtask(taskId, saved),
        error: () => this.reload(),
      });
    return this.getBoard(projectId);
  }

  /** Schaltet eine Unteraufgabe um. */
  toggleSubtask(projectId: string, taskId: string, subtaskId: string): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    const subtask = task?.subtasks.find((item) => item.id === subtaskId);
    if (!task || !subtask) return this.getBoard(projectId);
    return this.patchSubtask(projectId, task, { ...subtask, isDone: !subtask.isDone });
  }

  /** Schaltet eine gespiegelte Unteraufgabe am Ursprungstask um. */
  toggleMirroredSubtask(projectId: string, mirrorTask: WorkspaceTask): WorkspaceColumn[] {
    if (!mirrorTask.sourceTaskId || !mirrorTask.sourceSubtaskId) return this.getBoard(projectId);
    return this.toggleSubtask(projectId, mirrorTask.sourceTaskId, mirrorTask.sourceSubtaskId);
  }

  /** Aktualisiert den Titel einer Unteraufgabe. */
  updateSubtask(
    projectId: string,
    taskId: string,
    subtaskId: string,
    title: string,
  ): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    const subtask = task?.subtasks.find((item) => item.id === subtaskId);
    if (!task || !subtask || !title.trim()) return this.getBoard(projectId);
    return this.patchSubtask(projectId, task, { ...subtask, title: title.trim() });
  }

  /** Aktualisiert die Zuweisung einer Unteraufgabe. */
  updateSubtaskAssignee(
    projectId: string,
    taskId: string,
    subtaskId: string,
    memberId: string | null,
  ): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    const subtask = task?.subtasks.find((item) => item.id === subtaskId);
    if (!task || !subtask) return this.getBoard(projectId);
    return this.patchSubtask(projectId, task, { ...subtask, assignee: this.memberById(memberId) });
  }

  /** Löscht eine Unteraufgabe. */
  deleteSubtask(projectId: string, taskId: string, subtaskId: string): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    const subtask = task?.subtasks.find((item) => item.id === subtaskId);
    if (!task || !subtask) return this.getBoard(projectId);
    this.updateLocalTask({
      ...task,
      subtasks: task.subtasks.filter((item) => item.id !== subtaskId),
    });
    this.http
      .delete<void>(
        `${API_BASE_URL}/workspaces/tasks/${taskId}/subtasks/${subtaskId}/?version=${subtask.version ?? 1}`,
      )
      .subscribe({ error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Fügt einen Kommentar hinzu. */
  addComment(projectId: string, taskId: string, body: string): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    if (!task || !body.trim()) return this.getBoard(projectId);
    const comment: WorkspaceComment = {
      id: createUuid(),
      author: this.currentMember(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
      version: 1,
    };
    this.updateLocalTask({
      ...task,
      comments: [...task.comments, comment],
      commentCount: task.commentCount + 1,
    });
    this.http
      .post<WorkspaceComment>(`${API_BASE_URL}/workspaces/tasks/${taskId}/comments/`, {
        id: comment.id,
        body: comment.body,
        mentionIds: [],
      })
      .subscribe({
        next: (saved) => this.replaceComment(taskId, saved),
        error: () => this.reload(),
      });
    return this.getBoard(projectId);
  }

  /** Löscht einen Kommentar. */
  deleteComment(projectId: string, taskId: string, commentId: string): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    if (!task) return this.getBoard(projectId);
    this.updateLocalTask({
      ...task,
      comments: task.comments.filter((item) => item.id !== commentId),
    });
    this.http
      .delete<void>(`${API_BASE_URL}/workspaces/tasks/${taskId}/comments/${commentId}/`)
      .subscribe({ error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Lädt geprüfte Anhänge als Multipart-Daten hoch. */
  addAttachments(projectId: string, taskId: string, files: File[]): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    if (!task || files.length === 0) return this.getBoard(projectId);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    this.http
      .post<WorkspaceAttachment[]>(
        `${API_BASE_URL}/workspaces/tasks/${taskId}/attachments/`,
        formData,
      )
      .subscribe({
        next: (attachments) =>
          this.updateLocalTask({
            ...task,
            attachments: [...task.attachments, ...attachments],
            attachmentCount: task.attachmentCount + attachments.length,
          }),
        error: () => this.reload(),
      });
    return this.getBoard(projectId);
  }

  /** Löscht einen Anhang. */
  deleteAttachment(projectId: string, taskId: string, attachmentId: string): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    if (!task) return this.getBoard(projectId);
    this.updateLocalTask({
      ...task,
      attachments: task.attachments.filter((item) => item.id !== attachmentId),
    });
    this.http
      .delete<void>(`${API_BASE_URL}/workspaces/tasks/${taskId}/attachments/${attachmentId}/`)
      .subscribe({ error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Fügt einen Task-Mitwirkenden hinzu oder entfernt ihn. */
  toggleTaskCollaborator(projectId: string, taskId: string, memberId: string): WorkspaceColumn[] {
    const task = this.getTaskById(taskId);
    const member = this.memberById(memberId);
    if (!task || !member) return this.getBoard(projectId);
    const exists = task.collaborators.some((item) => item.id === memberId);
    return this.updateTask(projectId, taskId, {
      collaborators: exists
        ? task.collaborators.filter((item) => item.id !== memberId)
        : [...task.collaborators, member],
    });
  }

  /** Aktualisiert die Priorität eines Tasks. */
  updateTaskPriority(projectId: string, taskId: string, priority: TaskPriority): WorkspaceColumn[] {
    return this.updateTask(projectId, taskId, { priority });
  }

  /** Übernimmt einen Board-Snapshot in routekompatible Signalzustände. */
  private applyBoards(boards: BoardApiModel[]): void {
    const columnsByKey: Record<string, WorkspaceColumn[]> = {};
    const metaByKey: Record<string, BoardMeta> = {};
    for (const board of boards) {
      const key = board.kind === 'personal' ? PERSONAL_BOARD_KEY : (board.projectId ?? board.id);
      columnsByKey[key] = board.columns;
      metaByKey[key] = { id: board.id, version: board.version };
    }
    this.boardsState.set(columnsByKey);
    this.boardMetaState.set(metaByKey);
  }

  /** Setzt alle Workspace-Signale auf einen leeren Zustand. */
  private clearState(): void {
    this.workspaceIdState.set(null);
    this.projectsState.set([]);
    this.boardsState.set({});
    this.boardMetaState.set({});
    this.membersState.set([]);
    this.joinRequestsState.set([]);
    this.archivedTaskState.set([]);
  }

  /** Ändert den Projektstatus optimistisch und über die API. */
  private changeProjectStatus(
    projectId: string,
    action: 'complete' | 'archive',
    status: WorkspaceProject['status'],
  ): WorkspaceProject | null {
    const project = this.getProject(projectId);
    if (!project) return null;
    const optimistic = { ...project, status, isPinned: false, updatedAt: new Date().toISOString() };
    this.patchProjectState(optimistic);
    this.http
      .post<WorkspaceProject>(`${API_BASE_URL}/workspaces/projects/${projectId}/${action}/`, {
        version: project.version ?? 1,
      })
      .subscribe({
        next: (updated) => this.patchProjectState(updated),
        error: () => this.reload(),
      });
    return clone(optimistic);
  }

  /** Ersetzt ein Projekt im lokalen Snapshot. */
  private patchProjectState(project: WorkspaceProject): void {
    this.projectsState.update((projects) =>
      projects.some((item) => item.id === project.id)
        ? projects.map((item) => (item.id === project.id ? project : item))
        : [...projects, project],
    );
  }

  /** Liefert das aktuell angemeldete Workspace-Mitglied. */
  private currentMember(): WorkspaceMember {
    const currentUser = this.sessionService.currentUser();
    return (
      this.membersState().find((member) => member.id === currentUser?.id) ??
      this.membersState()[0] ?? {
        id: currentUser?.id ?? createUuid(),
        fullName: currentUser?.displayName ?? 'Nutzer',
        email: currentUser?.email ?? '',
        initials: this.initials(currentUser?.displayName ?? 'Nutzer'),
        avatarColor: DEFAULT_PROJECT_COLOR,
        avatarTextColor: '#ffffff',
        role: 'member',
        isOnline: false,
      }
    );
  }

  /** Sucht ein Mitglied anhand seiner UUID. */
  private memberById(memberId: string | null): WorkspaceMember | null {
    if (!memberId) return null;
    return this.membersState().find((member) => member.id === memberId) ?? null;
  }

  /** Aktualisiert Mitgliedsreferenzen im aktuellen Snapshot. */
  private replaceMember(updated: WorkspaceMember): void {
    this.membersState.update((members) =>
      members.map((member) => (member.id === updated.id ? updated : member)),
    );
  }

  /** Erzeugt und persistiert einen neuen Task. */
  private createTask(
    boardKey: string,
    columnId: string | null,
    assigneeId: string | null,
    title: string,
    sharedPool: boolean,
  ): WorkspaceTask {
    const board = this.boardMetaState()[boardKey];
    const project = boardKey === PERSONAL_BOARD_KEY ? null : this.getProject(boardKey);
    const owner = project?.owner ?? this.currentMember();
    const task: WorkspaceTask = {
      id: createUuid(),
      title: title.trim() || 'Neue Aufgabe',
      description: '',
      projectId: project?.id ?? null,
      projectTitle: project?.name ?? null,
      projectAllowsOnDemandTasks: project?.allowsOnDemandTasks ?? false,
      parentTaskId: null,
      parentTaskTitle: null,
      isSubtaskMirror: false,
      sourceTaskId: null,
      sourceSubtaskId: null,
      owner,
      assignee: this.memberById(assigneeId),
      collaborators: [],
      priority: 'mittel',
      startDate: null,
      dueDate: this.dateAfterDays(7),
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
      isSharedPool: sharedPool,
      requiresReview: sharedPool,
      reviewHint: sharedPool ? 'Bitte Zuweisung und Termin prüfen.' : null,
      createdOutsideColumn: columnId === null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    if (columnId) {
      this.boardsState.update((boards) => ({
        ...boards,
        [boardKey]: (boards[boardKey] ?? []).map((column) =>
          column.id === columnId ? { ...column, tasks: [task, ...column.tasks] } : column,
        ),
      }));
    }
    if (board) {
      this.http
        .post<WorkspaceTask>(`${API_BASE_URL}/workspaces/tasks/`, {
          id: task.id,
          boardId: board.id,
          columnId,
          title: task.title,
          description: '',
          assigneeId,
          collaboratorIds: [],
          priority: task.priority,
          dueDate: task.dueDate,
          tags: [],
          isSharedPool: sharedPool,
          requiresReview: sharedPool,
          reviewHint: task.reviewHint,
        })
        .subscribe({
          next: (saved) => this.updateLocalTask(saved, columnId),
          error: () => this.reload(),
        });
    }
    return clone(task);
  }

  /** Aktualisiert eine Spalte lokal und serverseitig. */
  private updateColumn(
    projectId: string,
    columnId: string,
    changes: Partial<WorkspaceColumn>,
  ): WorkspaceColumn[] {
    const current = this.getBoard(projectId).find((column) => column.id === columnId);
    if (!current) return this.getBoard(projectId);
    this.boardsState.update((boards) => ({
      ...boards,
      [projectId]: (boards[projectId] ?? []).map((column) =>
        column.id === columnId ? { ...column, ...changes } : column,
      ),
    }));
    this.http
      .patch<WorkspaceColumn>(`${API_BASE_URL}/workspaces/columns/${columnId}/`, {
        title: changes.title,
        color: changes.color,
        sortMode: changes.sortMode,
        version: current.version ?? 1,
      })
      .subscribe({ next: () => this.reload(), error: () => this.reload() });
    return this.getBoard(projectId);
  }

  /** Sucht Task und Spaltenkontext. */
  private findTask(
    taskId: string,
  ): { boardKey: string; columnId: string; task: WorkspaceTask } | null {
    for (const [boardKey, columns] of Object.entries(this.boardsState())) {
      for (const column of columns) {
        const task = column.tasks.find((item) => item.id === taskId);
        if (task) return { boardKey, columnId: column.id, task };
      }
    }
    return null;
  }

  /** Ersetzt einen Task in allen geladenen Boardreferenzen. */
  private updateLocalTask(task: WorkspaceTask, targetColumnId?: string | null): void {
    const current = this.findTask(task.id);
    this.boardsState.update((boards) => {
      const next: Record<string, WorkspaceColumn[]> = {};
      for (const [boardKey, columns] of Object.entries(boards)) {
        next[boardKey] = columns.map((column) => ({
          ...column,
          tasks: column.tasks.filter((item) => item.id !== task.id),
        }));
      }
      const boardKey = current?.boardKey ?? task.projectId ?? PERSONAL_BOARD_KEY;
      const columnId = targetColumnId ?? current?.columnId;
      if (columnId && next[boardKey]) {
        next[boardKey] = next[boardKey].map((column) =>
          column.id === columnId ? { ...column, tasks: [task, ...column.tasks] } : column,
        );
      }
      return next;
    });
  }

  /** Entfernt einen Task aus allen Boardreferenzen. */
  private removeLocalTask(taskId: string): void {
    this.boardsState.update((boards) =>
      Object.fromEntries(
        Object.entries(boards).map(([key, columns]) => [
          key,
          columns.map((column) => ({
            ...column,
            tasks: column.tasks.filter((task) => task.id !== taskId),
          })),
        ]),
      ),
    );
  }

  /** Speichert eine Unteraufgabenänderung. */
  private patchSubtask(
    projectId: string,
    task: WorkspaceTask,
    subtask: WorkspaceSubtask,
  ): WorkspaceColumn[] {
    this.replaceSubtask(task.id, subtask);
    this.http
      .patch<WorkspaceSubtask>(
        `${API_BASE_URL}/workspaces/tasks/${task.id}/subtasks/${subtask.id}/`,
        {
          title: subtask.title,
          assigneeId: subtask.assignee?.id ?? null,
          isDone: subtask.isDone,
          version: subtask.version ?? 1,
        },
      )
      .subscribe({
        next: (saved) => this.replaceSubtask(task.id, saved),
        error: () => this.reload(),
      });
    return this.getBoard(projectId);
  }

  /** Ersetzt eine Unteraufgabe in ihrem Task. */
  private replaceSubtask(taskId: string, subtask: WorkspaceSubtask): void {
    const task = this.getTaskById(taskId);
    if (!task) return;
    const exists = task.subtasks.some((item) => item.id === subtask.id);
    this.updateLocalTask({
      ...task,
      subtasks: exists
        ? task.subtasks.map((item) => (item.id === subtask.id ? subtask : item))
        : [...task.subtasks, subtask],
      subtaskCount: exists ? task.subtaskCount : task.subtaskCount + 1,
      completedSubtaskCount: (exists
        ? task.subtasks.map((item) => (item.id === subtask.id ? subtask : item))
        : [...task.subtasks, subtask]
      ).filter((item) => item.isDone).length,
    });
  }

  /** Ersetzt einen Kommentar in seinem Task. */
  private replaceComment(taskId: string, comment: WorkspaceComment): void {
    const task = this.getTaskById(taskId);
    if (!task) return;
    const exists = task.comments.some((item) => item.id === comment.id);
    this.updateLocalTask({
      ...task,
      comments: exists
        ? task.comments.map((item) => (item.id === comment.id ? comment : item))
        : [...task.comments, comment],
      commentCount: exists ? task.commentCount : task.commentCount + 1,
    });
  }

  /** Formatiert Initialen aus einem Anzeigenamen. */
  private initials(value: string): string {
    return value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase('de'))
      .join('');
  }

  /** Liefert ein ISO-Datum relativ zum aktuellen Tag. */
  private dateAfterDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
}
