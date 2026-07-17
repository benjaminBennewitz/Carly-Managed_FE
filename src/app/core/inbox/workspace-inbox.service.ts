// src/app/core/inbox/workspace-inbox.service.ts

import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';

import { API_BASE_URL } from '../api/api.config';
import { PaginatedResponse, unwrapCollection } from '../api/api.models';
import { WorkspaceMember } from '../workspace/workspace.models';
import {
  WorkspaceConversation,
  WorkspaceConversationCreatePayload,
  WorkspaceSystemNotification,
  WorkspaceSystemNotificationCreatePayload,
} from './workspace-inbox.models';

@Injectable({ providedIn: 'root' })
export class WorkspaceInboxService {
  private readonly systemNotificationsState = signal<WorkspaceSystemNotification[]>([]);
  private readonly conversationsState = signal<WorkspaceConversation[]>([]);
  private readonly workspaceIdState = signal<string | null>(null);

  readonly systemNotifications = computed(() =>
    [...this.systemNotificationsState()].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  );
  readonly conversations = computed(() =>
    [...this.conversationsState()].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    ),
  );
  readonly unreadSystemCount = computed(
    () => this.systemNotificationsState().filter((notification) => !notification.isRead).length,
  );
  readonly unreadConversationCount = computed(() =>
    this.conversationsState().reduce(
      (count, conversation) => count + Math.max(0, conversation.unreadCount),
      0,
    ),
  );
  readonly totalUnreadCount = computed(
    () => this.unreadSystemCount() + this.unreadConversationCount(),
  );

  constructor(private readonly http: HttpClient) {}

  /** Lädt Benachrichtigungen und Unterhaltungen für den aktiven Workspace. */
  reload(workspaceId: string): void {
    this.workspaceIdState.set(workspaceId);
    this.http
      .get<WorkspaceSystemNotification[] | PaginatedResponse<WorkspaceSystemNotification>>(
        `${API_BASE_URL}/inbox/notifications/`,
      )
      .subscribe({
        next: (response) => this.systemNotificationsState.set(unwrapCollection(response)),
      });
    this.http
      .get<WorkspaceConversation[] | PaginatedResponse<WorkspaceConversation>>(
        `${API_BASE_URL}/inbox/conversations/`,
      )
      .subscribe({ next: (response) => this.conversationsState.set(unwrapCollection(response)) });
  }

  /** Bleibt als kompatibler Einstieg erhalten; Daten kommen ausschließlich aus der API. */
  initialize(_members: readonly WorkspaceMember[]): void {
    const workspaceId = this.workspaceIdState();
    if (workspaceId) this.reload(workspaceId);
  }

  /** Systemmeldungen werden ausschließlich serverseitig durch echte Domänenereignisse erzeugt. */
  createSystemNotification(
    _payload: WorkspaceSystemNotificationCreatePayload,
  ): WorkspaceSystemNotification | null {
    return null;
  }

  /** Markiert eine einzelne Systemnachricht als gelesen. */
  markSystemNotificationRead(notificationId: string): void {
    this.systemNotificationsState.update((notifications) =>
      notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification,
      ),
    );
    this.http
      .post<WorkspaceSystemNotification>(
        `${API_BASE_URL}/inbox/notifications/${notificationId}/mark-read/`,
        {},
      )
      .subscribe({ error: () => this.reloadCurrent() });
  }

  /** Markiert alle Systemnachrichten als gelesen. */
  markAllSystemNotificationsRead(): void {
    this.systemNotificationsState.update((notifications) =>
      notifications.map((notification) => ({ ...notification, isRead: true })),
    );
    this.http
      .post<void>(`${API_BASE_URL}/inbox/notifications/mark-all-read/`, {})
      .subscribe({ error: () => this.reloadCurrent() });
  }

  /** Entfernt eine einzelne Systemnachricht. */
  deleteSystemNotification(notificationId: string): void {
    this.systemNotificationsState.update((notifications) =>
      notifications.filter((notification) => notification.id !== notificationId),
    );
    this.http
      .delete<void>(`${API_BASE_URL}/inbox/notifications/${notificationId}/`)
      .subscribe({ error: () => this.reloadCurrent() });
  }

  /** Entfernt alle persönlichen Systemnachrichten. */
  clearSystemNotifications(): void {
    this.systemNotificationsState.set([]);
    this.http
      .delete<void>(`${API_BASE_URL}/inbox/notifications/clear/`)
      .subscribe({ error: () => this.reloadCurrent() });
  }

  /** Erstellt eine Unterhaltung aus dem UI- oder Workspace-Aufruf. */
  createConversation(
    payloadOrWorkspaceId: WorkspaceConversationCreatePayload | string,
    membersOrSubject: readonly WorkspaceMember[] | string,
    participantIds: string[] = [],
    body = '',
  ): WorkspaceConversation | null {
    const payload: WorkspaceConversationCreatePayload =
      typeof payloadOrWorkspaceId === 'string'
        ? {
            participantIds,
            subject: String(membersOrSubject),
            body,
          }
        : payloadOrWorkspaceId;
    const workspaceId =
      typeof payloadOrWorkspaceId === 'string' ? payloadOrWorkspaceId : this.workspaceIdState();
    const members = Array.isArray(membersOrSubject) ? membersOrSubject : [];
    const participants = members.filter((member) => payload.participantIds.includes(member.id));

    if (!workspaceId || payload.participantIds.length === 0 || !payload.body.trim()) return null;

    const now = new Date().toISOString();
    const conversation: WorkspaceConversation = {
      id: crypto.randomUUID(),
      participants,
      messages: [],
      createdAt: now,
      updatedAt: now,
      unreadCount: 0,
      version: 1,
    };
    this.conversationsState.update((items) => [conversation, ...items]);
    this.http
      .post<WorkspaceConversation>(`${API_BASE_URL}/inbox/conversations/`, {
        workspaceId,
        participantIds: payload.participantIds,
        subject: payload.subject,
        body: payload.body,
      })
      .subscribe({
        next: (saved) => this.replaceConversation(conversation.id, saved),
        error: () => this.reloadCurrent(),
      });
    return structuredClone(conversation);
  }

  /** Sendet eine Nachricht und fügt optional vorgemerkte Personen hinzu. */
  sendMessage(
    conversationId: string,
    body: string,
    _members: readonly WorkspaceMember[],
    invitedMemberIds: readonly string[] = [],
  ): WorkspaceConversation | null {
    const conversation = this.getConversation(conversationId);
    if (!conversation || !body.trim()) return null;

    if (invitedMemberIds.length > 0) {
      this.addParticipants(conversationId, invitedMemberIds, _members);
    }
    this.http
      .post<WorkspaceConversation>(
        `${API_BASE_URL}/inbox/conversations/${conversationId}/messages/`,
        { body: body.trim() },
      )
      .subscribe({
        next: (saved) => this.replaceConversation(conversationId, saved),
        error: () => this.reloadCurrent(),
      });
    return conversation;
  }

  /** Fügt aktive Workspace-Mitglieder zu einer Unterhaltung hinzu. */
  addParticipants(
    conversationId: string,
    memberIds: readonly string[],
    _members: readonly WorkspaceMember[],
  ): WorkspaceConversation | null {
    const conversation = this.getConversation(conversationId);
    if (!conversation || memberIds.length === 0) return conversation;
    this.http
      .post<WorkspaceConversation>(
        `${API_BASE_URL}/inbox/conversations/${conversationId}/participants/`,
        { participantIds: memberIds, version: conversation.version ?? 1 },
      )
      .subscribe({
        next: (saved) => this.replaceConversation(conversationId, saved),
        error: () => this.reloadCurrent(),
      });
    return conversation;
  }

  /** Entfernt Personen aus einer Unterhaltung. */
  removeParticipants(
    conversationId: string,
    memberIds: readonly string[],
  ): WorkspaceConversation | null {
    const conversation = this.getConversation(conversationId);
    if (!conversation || memberIds.length === 0) return conversation;
    this.http
      .request<WorkspaceConversation>(
        'DELETE',
        `${API_BASE_URL}/inbox/conversations/${conversationId}/participants/`,
        { body: { participantIds: memberIds, version: conversation.version ?? 1 } },
      )
      .subscribe({
        next: (saved) => this.replaceConversation(conversationId, saved),
        error: () => this.reloadCurrent(),
      });
    return conversation;
  }

  /** Öffnet eine Unterhaltung und aktualisiert ihren Lesestand. */
  markConversationRead(conversationId: string): void {
    this.conversationsState.update((conversations) =>
      conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
      ),
    );
    this.http
      .get<WorkspaceConversation>(`${API_BASE_URL}/inbox/conversations/${conversationId}/`)
      .subscribe({ next: (saved) => this.replaceConversation(conversationId, saved) });
  }

  /** Verlässt eine Unterhaltung. */
  deleteConversation(conversationId: string): void {
    this.conversationsState.update((items) => items.filter((item) => item.id !== conversationId));
    this.http
      .delete<void>(`${API_BASE_URL}/inbox/conversations/${conversationId}/`)
      .subscribe({ error: () => this.reloadCurrent() });
  }

  /** Aktualisiert verschachtelte Mitgliedsdaten im geladenen Inbox-Snapshot. */
  syncMember(updatedMember: WorkspaceMember): void {
    this.systemNotificationsState.update((notifications) =>
      notifications.map((notification) => ({
        ...notification,
        actor: notification.actor?.id === updatedMember.id ? updatedMember : notification.actor,
      })),
    );
    this.conversationsState.update((conversations) =>
      conversations.map((conversation) => ({
        ...conversation,
        participants: conversation.participants.map((member) =>
          member.id === updatedMember.id ? updatedMember : member,
        ),
        messages: conversation.messages.map((message) => ({
          ...message,
          sender: message.sender?.id === updatedMember.id ? updatedMember : message.sender,
        })),
      })),
    );
  }

  /** Entfernt ein Mitglied aus lokalen Gesprächsdarstellungen. */
  removeMember(memberId: string): void {
    this.conversationsState.update((conversations) =>
      conversations.map((conversation) => ({
        ...conversation,
        participants: conversation.participants.filter((member) => member.id !== memberId),
      })),
    );
  }

  /** Liefert eine sichere Kopie einer Unterhaltung. */
  getConversation(conversationId: string): WorkspaceConversation | null {
    const conversation = this.conversationsState().find((item) => item.id === conversationId);
    return conversation ? structuredClone(conversation) : null;
  }

  /** Ersetzt eine optimistische Unterhaltung durch die Serverantwort. */
  private replaceConversation(currentId: string, conversation: WorkspaceConversation): void {
    this.conversationsState.update((items) =>
      items.some((item) => item.id === currentId)
        ? items.map((item) => (item.id === currentId ? conversation : item))
        : [conversation, ...items],
    );
  }

  /** Lädt die aktive Inbox nach einem Konflikt neu. */
  private reloadCurrent(): void {
    const workspaceId = this.workspaceIdState();
    if (workspaceId) this.reload(workspaceId);
  }
}
