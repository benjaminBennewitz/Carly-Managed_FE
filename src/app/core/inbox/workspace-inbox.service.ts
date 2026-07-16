// src/app/core/inbox/workspace-inbox.service.ts

import { computed, Injectable, signal } from '@angular/core';

import {
  normalizeMultilineInput,
  normalizeSingleLineInput,
} from '../security/frontend-input.utils';
import { WorkspaceMember } from '../workspace/workspace.models';
import {
  WorkspaceChatMessage,
  WorkspaceConversation,
  WorkspaceConversationCreatePayload,
  WorkspaceSystemNotification,
  WorkspaceSystemNotificationCreatePayload,
} from './workspace-inbox.models';

const SYSTEM_NOTIFICATIONS_STORAGE_KEY = 'carly-managed-preview-system-notifications-v1';
const CONVERSATIONS_STORAGE_KEY = 'carly-managed-preview-conversations-v1';
const CURRENT_MEMBER_ID = 'member-ben';
const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2_000;

/** Erstellt einen stabilen lokalen Schlüssel für Inbox-Datensätze. */
function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Erstellt einen ISO-Zeitpunkt relativ zum aktuellen Tag für die Demo-Daten. */
function demoDate(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString();
}

/** Erstellt eine sichere Kopie eines Workspace-Mitglieds. */
function cloneMember(member: WorkspaceMember): WorkspaceMember {
  return { ...member };
}

/** Erstellt eine sichere Kopie einer Konversation. */
function cloneConversation(conversation: WorkspaceConversation): WorkspaceConversation {
  return {
    ...conversation,
    participants: conversation.participants.map(cloneMember),
    messages: conversation.messages.map((message) => ({
      ...message,
      sender: message.sender ? cloneMember(message.sender) : null,
    })),
  };
}

/** Lädt Systemnachrichten aus dem Browser-Speicher. */
function loadSystemNotifications(): WorkspaceSystemNotification[] {
  try {
    const stored = window.localStorage.getItem(SYSTEM_NOTIFICATIONS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as WorkspaceSystemNotification[]) : [];
  } catch {
    return [];
  }
}

/** Lädt Chat-Konversationen aus dem Browser-Speicher. */
function loadConversations(): WorkspaceConversation[] {
  try {
    const stored = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as WorkspaceConversation[]).map(cloneConversation) : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceInboxService {
  private readonly systemNotificationsState =
    signal<WorkspaceSystemNotification[]>(loadSystemNotifications());
  private readonly conversationsState = signal<WorkspaceConversation[]>(loadConversations());
  private initialized = false;

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

  /** Initialisiert die lokale Inbox einmalig mit aussagekräftigen Demo-Daten. */
  initialize(members: readonly WorkspaceMember[]): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    const hasNotificationStorage =
      window.localStorage.getItem(SYSTEM_NOTIFICATIONS_STORAGE_KEY) !== null;
    const hasConversationStorage = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY) !== null;

    if (!hasNotificationStorage) {
      this.systemNotificationsState.set(this.createDemoNotifications(members));
      this.persistSystemNotifications();
    }

    if (!hasConversationStorage) {
      this.conversationsState.set(this.createDemoConversations(members));
      this.persistConversations();
    }
  }

  /** Legt eine neue Systemnachricht an und markiert sie als ungelesen. */
  createSystemNotification(
    payload: WorkspaceSystemNotificationCreatePayload,
  ): WorkspaceSystemNotification {
    const notification: WorkspaceSystemNotification = {
      id: createId('notification'),
      kind: payload.kind,
      title: normalizeSingleLineInput(payload.title, 120) || 'Workspace-Aktivität',
      body: normalizeMultilineInput(payload.body, 500) || 'Im Workspace wurde etwas geändert.',
      icon: normalizeSingleLineInput(payload.icon, 60) || 'notifications',
      actor: payload.actor ? cloneMember(payload.actor) : null,
      createdAt: new Date().toISOString(),
      isRead: false,
      route: payload.route ?? null,
      queryParams: payload.queryParams ? { ...payload.queryParams } : null,
    };

    this.systemNotificationsState.update((notifications) => [notification, ...notifications]);
    this.persistSystemNotifications();
    return structuredClone(notification);
  }

  /** Markiert eine einzelne Systemnachricht als gelesen. */
  markSystemNotificationRead(notificationId: string): void {
    this.systemNotificationsState.update((notifications) =>
      notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification,
      ),
    );
    this.persistSystemNotifications();
  }

  /** Markiert alle Systemnachrichten als gelesen. */
  markAllSystemNotificationsRead(): void {
    this.systemNotificationsState.update((notifications) =>
      notifications.map((notification) => ({ ...notification, isRead: true })),
    );
    this.persistSystemNotifications();
  }

  /** Entfernt eine einzelne Systemnachricht. */
  deleteSystemNotification(notificationId: string): void {
    this.systemNotificationsState.update((notifications) =>
      notifications.filter((notification) => notification.id !== notificationId),
    );
    this.persistSystemNotifications();
  }

  /** Entfernt alle Systemnachrichten aus der lokalen Inbox. */
  clearSystemNotifications(): void {
    this.systemNotificationsState.set([]);
    this.persistSystemNotifications();
  }

  /** Startet eine Direkt- oder Gruppenunterhaltung und sendet die erste Nachricht. */
  createConversation(
    payload: WorkspaceConversationCreatePayload,
    members: readonly WorkspaceMember[],
  ): WorkspaceConversation | null {
    const sender = this.getCurrentMember(members);
    const subject = normalizeSingleLineInput(payload.subject, MAX_SUBJECT_LENGTH);
    const body = normalizeMultilineInput(payload.body, MAX_MESSAGE_LENGTH);
    const participantIds = [...new Set(payload.participantIds)].filter(
      (memberId) => memberId !== sender?.id,
    );
    const selectedMembers = members.filter((member) => participantIds.includes(member.id));

    if (!sender || selectedMembers.length === 0 || !body) {
      return null;
    }

    const directConversation =
      selectedMembers.length === 1
        ? this.conversationsState().find((conversation) => {
            const ids = conversation.participants.map((participant) => participant.id);
            return (
              ids.length === 2 && ids.includes(sender.id) && ids.includes(selectedMembers[0]!.id)
            );
          })
        : null;

    if (directConversation) {
      return this.appendOwnMessage(directConversation.id, subject, body, sender);
    }

    const now = new Date().toISOString();
    const message: WorkspaceChatMessage = {
      id: createId('chat-message'),
      kind: 'message',
      sender: cloneMember(sender),
      subject: subject || null,
      body,
      createdAt: now,
    };
    const conversation: WorkspaceConversation = {
      id: createId('conversation'),
      participants: [sender, ...selectedMembers].map(cloneMember),
      messages: [message],
      createdAt: now,
      updatedAt: now,
      unreadCount: 0,
    };

    this.conversationsState.update((conversations) => [conversation, ...conversations]);
    this.persistConversations();
    return cloneConversation(conversation);
  }

  /** Sendet eine Nachricht und fügt vorgemerkte Personen erst dabei zum Chat hinzu. */
  sendMessage(
    conversationId: string,
    body: string,
    members: readonly WorkspaceMember[],
    invitedMemberIds: readonly string[] = [],
  ): WorkspaceConversation | null {
    const sender = this.getCurrentMember(members);
    const cleanBody = normalizeMultilineInput(body, MAX_MESSAGE_LENGTH);
    const conversation = this.conversationsState().find((item) => item.id === conversationId);

    if (!sender || !cleanBody || !conversation) {
      return null;
    }

    const existingIds = new Set(conversation.participants.map((participant) => participant.id));
    const invitationIds = new Set(invitedMemberIds);
    const additions = members.filter(
      (member) => invitationIds.has(member.id) && !existingIds.has(member.id),
    );
    const now = new Date().toISOString();
    const message: WorkspaceChatMessage = {
      id: createId('chat-message'),
      kind: 'message',
      sender: cloneMember(sender),
      subject: null,
      body: cleanBody,
      createdAt: now,
    };
    const participantEvent = this.createParticipantEvent(additions, 'added', now);
    let updatedConversation: WorkspaceConversation | null = null;

    this.conversationsState.update((conversations) =>
      conversations.map((item) => {
        if (item.id !== conversationId) {
          return item;
        }

        updatedConversation = {
          ...item,
          participants: [...item.participants, ...additions.map(cloneMember)],
          messages: [...item.messages, ...(participantEvent ? [participantEvent] : []), message],
          updatedAt: now,
          unreadCount: 0,
        };
        return updatedConversation;
      }),
    );
    this.persistConversations();
    return updatedConversation ? cloneConversation(updatedConversation) : null;
  }

  /** Fügt einer laufenden Unterhaltung weitere Personen hinzu. */
  addParticipants(
    conversationId: string,
    memberIds: readonly string[],
    members: readonly WorkspaceMember[],
  ): WorkspaceConversation | null {
    const conversation = this.conversationsState().find((item) => item.id === conversationId);
    const existingIds = new Set(
      conversation?.participants.map((participant) => participant.id) ?? [],
    );
    const additions = members.filter(
      (member) => memberIds.includes(member.id) && !existingIds.has(member.id),
    );

    if (!conversation || additions.length === 0) {
      return conversation ? cloneConversation(conversation) : null;
    }

    const now = new Date().toISOString();
    const systemMessage = this.createParticipantEvent(additions, 'added', now);
    let updatedConversation: WorkspaceConversation | null = null;

    this.conversationsState.update((conversations) =>
      conversations.map((item) => {
        if (item.id !== conversationId) {
          return item;
        }

        updatedConversation = {
          ...item,
          participants: [...item.participants, ...additions.map(cloneMember)],
          messages: systemMessage ? [...item.messages, systemMessage] : item.messages,
          updatedAt: now,
        };
        return updatedConversation;
      }),
    );
    this.persistConversations();
    return updatedConversation ? cloneConversation(updatedConversation) : null;
  }

  /** Entfernt ausgewählte Personen aus einem Gruppenchat. */
  removeParticipants(
    conversationId: string,
    memberIds: readonly string[],
  ): WorkspaceConversation | null {
    const conversation = this.conversationsState().find((item) => item.id === conversationId);
    if (!conversation) {
      return null;
    }

    const removalIds = new Set(memberIds.filter((memberId) => memberId !== CURRENT_MEMBER_ID));
    const removals = conversation.participants.filter((member) => removalIds.has(member.id));
    const remainingParticipants = conversation.participants.filter(
      (member) => !removalIds.has(member.id),
    );

    if (removals.length === 0 || remainingParticipants.length < 2) {
      return cloneConversation(conversation);
    }

    const now = new Date().toISOString();
    const systemMessage = this.createParticipantEvent(removals, 'removed', now);
    let updatedConversation: WorkspaceConversation | null = null;

    this.conversationsState.update((conversations) =>
      conversations.map((item) => {
        if (item.id !== conversationId) {
          return item;
        }

        updatedConversation = {
          ...item,
          participants: remainingParticipants.map(cloneMember),
          messages: systemMessage ? [...item.messages, systemMessage] : item.messages,
          updatedAt: now,
        };
        return updatedConversation;
      }),
    );
    this.persistConversations();
    return updatedConversation ? cloneConversation(updatedConversation) : null;
  }

  /** Markiert alle Nachrichten einer Unterhaltung als gelesen. */
  markConversationRead(conversationId: string): void {
    this.conversationsState.update((conversations) =>
      conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
      ),
    );
    this.persistConversations();
  }

  /** Entfernt eine Unterhaltung aus der lokalen Inbox. */
  deleteConversation(conversationId: string): void {
    this.conversationsState.update((conversations) =>
      conversations.filter((conversation) => conversation.id !== conversationId),
    );
    this.persistConversations();
  }

  /** Synchronisiert geänderte Mitgliedsdaten in Systemnachrichten und Chats. */
  syncMember(updatedMember: WorkspaceMember): void {
    const replaceMember = (member: WorkspaceMember): WorkspaceMember =>
      member.id === updatedMember.id ? cloneMember(updatedMember) : cloneMember(member);

    this.systemNotificationsState.update((notifications) =>
      notifications.map((notification) => ({
        ...notification,
        actor: notification.actor ? replaceMember(notification.actor) : null,
      })),
    );
    this.conversationsState.update((conversations) =>
      conversations.map((conversation) => ({
        ...conversation,
        participants: conversation.participants.map(replaceMember),
        messages: conversation.messages.map((message) => ({
          ...message,
          sender: message.sender ? replaceMember(message.sender) : null,
        })),
      })),
    );
    this.persistSystemNotifications();
    this.persistConversations();
  }

  /** Entfernt ein Mitglied aus aktiven Teilnehmerlisten und löscht leere Direktchats. */
  removeMember(memberId: string): void {
    this.conversationsState.update((conversations) =>
      conversations
        .map((conversation) => ({
          ...conversation,
          participants: conversation.participants.filter(
            (participant) => participant.id !== memberId,
          ),
        }))
        .filter((conversation) => conversation.participants.length > 1),
    );
    this.persistConversations();
  }

  /** Liefert eine sichere Kopie einer Konversation. */
  getConversation(conversationId: string): WorkspaceConversation | null {
    const conversation = this.conversationsState().find((item) => item.id === conversationId);
    return conversation ? cloneConversation(conversation) : null;
  }

  /** Erstellt ein Systemereignis für hinzugefügte oder entfernte Chatteilnehmende. */
  private createParticipantEvent(
    members: readonly WorkspaceMember[],
    action: 'added' | 'removed',
    createdAt: string,
  ): WorkspaceChatMessage | null {
    if (members.length === 0) {
      return null;
    }

    const names = members.map((member) => member.fullName).join(', ');
    const body =
      action === 'added'
        ? `${names} ${members.length === 1 ? 'wurde' : 'wurden'} zum Chat hinzugefügt.`
        : `${names} ${members.length === 1 ? 'wurde' : 'wurden'} aus dem Chat entfernt.`;

    return {
      id: createId('chat-event'),
      kind: 'system',
      sender: null,
      subject: null,
      body,
      createdAt,
    };
  }

  /** Ergänzt eine eigene Nachricht in einer bestehenden Unterhaltung. */
  private appendOwnMessage(
    conversationId: string,
    subject: string,
    body: string,
    sender: WorkspaceMember,
  ): WorkspaceConversation | null {
    const now = new Date().toISOString();
    const message: WorkspaceChatMessage = {
      id: createId('chat-message'),
      kind: 'message',
      sender: cloneMember(sender),
      subject: subject || null,
      body,
      createdAt: now,
    };
    let updatedConversation: WorkspaceConversation | null = null;

    this.conversationsState.update((conversations) =>
      conversations.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation;
        }

        updatedConversation = {
          ...conversation,
          messages: [...conversation.messages, message],
          updatedAt: now,
          unreadCount: 0,
        };
        return updatedConversation;
      }),
    );
    this.persistConversations();
    return updatedConversation ? cloneConversation(updatedConversation) : null;
  }

  /** Ermittelt das aktuell angemeldete Demo-Mitglied. */
  private getCurrentMember(members: readonly WorkspaceMember[]): WorkspaceMember | null {
    return members.find((member) => member.id === CURRENT_MEMBER_ID) ?? members[0] ?? null;
  }

  /** Erstellt initiale Systemnachrichten für die lokale Vorschau. */
  private createDemoNotifications(
    members: readonly WorkspaceMember[],
  ): WorkspaceSystemNotification[] {
    const ben = this.getCurrentMember(members);
    const mira = members.find((member) => member.id === 'member-mira') ?? ben;
    const noah = members.find((member) => member.id === 'member-noah') ?? ben;

    return [
      {
        id: 'notification-demo-task-completed',
        kind: 'task',
        title: 'Aufgabe abgeschlossen',
        body: '„Board-Zustände dokumentieren“ wurde im Projekt Carly Managed abgeschlossen.',
        icon: 'task_alt',
        actor: mira ? cloneMember(mira) : null,
        createdAt: demoDate(-1),
        isRead: false,
        route: '/projects/carly-managed/board',
        queryParams: { task: 'task-101' },
      },
      {
        id: 'notification-demo-assignment',
        kind: 'task',
        title: 'Neue Zuweisung',
        body: 'Dir wurde die Aufgabe „Inbox-Konzept abstimmen“ zugewiesen.',
        icon: 'assignment_ind',
        actor: noah ? cloneMember(noah) : null,
        createdAt: demoDate(-4),
        isRead: false,
        route: '/board',
        queryParams: null,
      },
      {
        id: 'notification-demo-project-update',
        kind: 'project',
        title: 'Projekt geändert',
        body: 'Laufzeit, Rollen und Beschreibung von „Portfolio Relaunch“ wurden aktualisiert.',
        icon: 'edit_note',
        actor: ben ? cloneMember(ben) : null,
        createdAt: demoDate(-21),
        isRead: true,
        route: '/projects/portfolio-relaunch/board',
        queryParams: null,
      },
      {
        id: 'notification-demo-reopened',
        kind: 'task',
        title: 'Aufgabe wieder geöffnet',
        body: '„Mobile Navigation testen“ benötigt eine weitere Überarbeitung.',
        icon: 'restart_alt',
        actor: mira ? cloneMember(mira) : null,
        createdAt: demoDate(-28),
        isRead: true,
        route: '/projects/carly-managed/board',
        queryParams: null,
      },
    ];
  }

  /** Erstellt initiale Direkt- und Gruppenchats für die lokale Vorschau. */
  private createDemoConversations(members: readonly WorkspaceMember[]): WorkspaceConversation[] {
    const ben = this.getCurrentMember(members);
    const mira = members.find((member) => member.id === 'member-mira');
    const noah = members.find((member) => member.id === 'member-noah');
    const lea = members.find((member) => member.id === 'member-lea');

    if (!ben || !mira) {
      return [];
    }

    const directConversation: WorkspaceConversation = {
      id: 'conversation-demo-mira',
      participants: [ben, mira].map(cloneMember),
      messages: [
        {
          id: 'chat-demo-mira-1',
          kind: 'message',
          sender: cloneMember(mira),
          subject: 'Board Review',
          body: 'Ich habe die neuen Task-Karten geprüft. Die Zustände wirken jetzt deutlich ruhiger.',
          createdAt: demoDate(-30),
        },
        {
          id: 'chat-demo-mira-2',
          kind: 'message',
          sender: cloneMember(ben),
          subject: null,
          body: 'Perfekt, dann gehe ich als Nächstes an die Inbox.',
          createdAt: demoDate(-29),
        },
        {
          id: 'chat-demo-mira-3',
          kind: 'message',
          sender: cloneMember(mira),
          subject: null,
          body: 'Sehr gut. Ich schicke dir später noch die offenen Punkte für den mobilen Zustand.',
          createdAt: demoDate(-2),
        },
      ],
      createdAt: demoDate(-30),
      updatedAt: demoDate(-2),
      unreadCount: 1,
    };

    const groupMembers = [ben, noah, lea].filter((member): member is WorkspaceMember => !!member);
    const groupConversation: WorkspaceConversation | null =
      groupMembers.length >= 3
        ? {
            id: 'conversation-demo-release',
            participants: groupMembers.map(cloneMember),
            messages: [
              {
                id: 'chat-demo-group-1',
                kind: 'system',
                sender: null,
                subject: null,
                body: 'Noah und Lea wurden zum Chat hinzugefügt.',
                createdAt: demoDate(-50),
              },
              {
                id: 'chat-demo-group-2',
                kind: 'message',
                sender: cloneMember(noah!),
                subject: 'Release-Abstimmung',
                body: 'Können wir die letzte Accessibility-Runde morgen gemeinsam prüfen?',
                createdAt: demoDate(-8),
              },
              {
                id: 'chat-demo-group-3',
                kind: 'message',
                sender: cloneMember(lea!),
                subject: null,
                body: 'Ja, ich übernehme Tastaturbedienung und Fokuszustände.',
                createdAt: demoDate(-7),
              },
            ],
            createdAt: demoDate(-50),
            updatedAt: demoDate(-7),
            unreadCount: 2,
          }
        : null;

    return groupConversation ? [directConversation, groupConversation] : [directConversation];
  }

  /** Persistiert alle Systemnachrichten im lokalen Browser-Speicher. */
  private persistSystemNotifications(): void {
    try {
      window.localStorage.setItem(
        SYSTEM_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(this.systemNotificationsState()),
      );
    } catch {
      // Die Vorschau bleibt ohne Browser-Speicher funktionsfähig.
    }
  }

  /** Persistiert alle Chat-Konversationen im lokalen Browser-Speicher. */
  private persistConversations(): void {
    try {
      window.localStorage.setItem(
        CONVERSATIONS_STORAGE_KEY,
        JSON.stringify(this.conversationsState()),
      );
    } catch {
      // Die Vorschau bleibt ohne Browser-Speicher funktionsfähig.
    }
  }
}
