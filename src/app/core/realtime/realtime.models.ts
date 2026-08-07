// src/app/core/realtime/realtime.models.ts

export interface RealtimeEnvelope<T = unknown> {
  type: string;
  payload?: T;
  code?: string;
  message?: string;
  action?: string;
}

export interface RealtimePresenceSnapshotPayload {
  users: RealtimePresenceMember[];
  editing?: RealtimeEditingPayload[];
}

export interface RealtimePresenceMember {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  avatarColor: string;
  avatarTextColor: string;
  role: 'owner' | 'manager' | 'member';
  isOnline: boolean;
}

export interface RealtimePresenceJoinedPayload {
  user: RealtimePresenceMember | null;
}

export interface RealtimePresenceLeftPayload {
  userId: string;
}

export interface RealtimeCursorPayload {
  userId: string;
  x: number;
  y: number;
}

export interface RealtimeEditingPayload {
  userId: string;
  taskId: string | null;
  active: boolean;
}

export interface RealtimeCoopCompletedPayload {
  action: string;
  participantIds: string[];
}
