// src/app/core/inbox/workspace-inbox.models.ts

import { WorkspaceAlarmCategory } from '../settings/app-settings.models';
import { WorkspaceMember } from '../workspace/workspace.models';

export type WorkspaceSystemNotificationKind =
  'task' | 'project' | 'member' | 'automation' | 'system';

export type WorkspaceChatMessageKind = 'message' | 'system';

export interface WorkspaceSystemNotification {
  id: string;
  kind: WorkspaceSystemNotificationKind;
  title: string;
  body: string;
  icon: string;
  actor: WorkspaceMember | null;
  createdAt: string;
  isRead: boolean;
  route: string | null;
  queryParams: Record<string, string> | null;
}

export interface WorkspaceSystemNotificationCreatePayload {
  kind: WorkspaceSystemNotificationKind;
  title: string;
  body: string;
  icon: string;
  actor?: WorkspaceMember | null;
  route?: string | null;
  queryParams?: Record<string, string> | null;
  alarmCategory?: WorkspaceAlarmCategory;
}

export interface WorkspaceChatMessage {
  id: string;
  kind: WorkspaceChatMessageKind;
  sender: WorkspaceMember | null;
  subject: string | null;
  body: string;
  createdAt: string;
}

export interface WorkspaceConversation {
  id: string;
  participants: WorkspaceMember[];
  messages: WorkspaceChatMessage[];
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  version?: number;
}

export interface WorkspaceConversationCreatePayload {
  participantIds: string[];
  subject: string;
  body: string;
}
