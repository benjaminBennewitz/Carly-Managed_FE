// src/app/core/workspace/workspace.models.ts

export type ProjectStatus = 'active' | 'completed' | 'archived';
export type ProjectDueState =
  | 'geringe-restmenge'
  | 'im-plan'
  | 'bald-faellig'
  | 'kritisch'
  | 'ueberfaellig';
export type TaskPriority = 'hoch' | 'mittel' | 'niedrig';
export type BoardViewMode = 'board' | 'list';

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
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  tags: string[];
  subtaskCount: number;
  completedSubtaskCount: number;
  commentCount: number;
  attachmentCount: number;
  isRecurring: boolean;
  recurrenceLabel: string | null;
  isDone: boolean;
  completedAt: string | null;
  isSharedPool: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceColumn {
  id: string;
  title: string;
  color: string;
  tasks: WorkspaceTask[];
  isFixedPosition?: boolean;
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
