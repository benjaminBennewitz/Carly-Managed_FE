// src/app/core/workspace/workspace.models.ts

export type ProjectStatus = 'active' | 'completed' | 'archived';
export type ProjectDueState =
  'geringe-restmenge' | 'im-plan' | 'bald-faellig' | 'kritisch' | 'ueberfaellig';
export type TaskPriority = 'hoch' | 'mittel' | 'niedrig';
export type BoardViewMode = 'board' | 'list';
export type WorkspaceColumnSortMode = 'title' | 'date' | null;

export interface WorkspaceMember {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  avatarColor: string;
  avatarTextColor: string;
  role: 'owner' | 'manager' | 'member';
  isOnline: boolean;
}

export interface WorkspaceSubtask {
  id: string;
  title: string;
  isDone: boolean;
  createdAt: string;
}

export interface WorkspaceComment {
  id: string;
  author: WorkspaceMember;
  body: string;
  createdAt: string;
}

export interface WorkspaceAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: WorkspaceMember;
  createdAt: string;
}

export interface WorkspaceHistoryEntry {
  id: string;
  actor: WorkspaceMember;
  action: string;
  icon: string;
  createdAt: string;
}

export interface WorkspaceTask {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  projectTitle: string | null;
  projectAllowsOnDemandTasks: boolean;
  parentTaskId: string | null;
  owner: WorkspaceMember;
  assignee: WorkspaceMember | null;
  collaborators: WorkspaceMember[];
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  tags: string[];
  subtasks: WorkspaceSubtask[];
  comments: WorkspaceComment[];
  attachments: WorkspaceAttachment[];
  history: WorkspaceHistoryEntry[];
  subtaskCount: number;
  completedSubtaskCount: number;
  commentCount: number;
  attachmentCount: number;
  isRecurring: boolean;
  recurrenceLabel: string | null;
  isDone: boolean;
  completedAt: string | null;
  isSharedPool: boolean;
  requiresReview: boolean;
  reviewHint: string | null;
  createdOutsideColumn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceColumn {
  id: string;
  title: string;
  color: string;
  tasks: WorkspaceTask[];
  isFixedPosition?: boolean;
  sortMode?: WorkspaceColumnSortMode;
  isDynamic?: boolean;
  systemRole?: 'new-assigned' | 'pool-review';
}

export interface WorkspaceProject {
  id: string;
  routeKey: string;
  slugLabel: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  status: ProjectStatus;
  owner: WorkspaceMember;
  managers: WorkspaceMember[];
  collaborators: WorkspaceMember[];
  startedAt: string;
  dueAt: string;
  updatedAt: string;
  completedAt: string | null;
  lastOpenedAt: string | null;
  isPinned: boolean;
  allowsOnDemandTasks: boolean;
  dueState: ProjectDueState;
  dueSummary: string;
}

export interface ArchivedTaskEntry {
  task: WorkspaceTask;
  sourceLabel: string;
  archivedAt: string;
}

export interface TaskValidationError {
  field: 'title' | 'assignee' | 'priority' | 'dueDate';
  message: string;
}
