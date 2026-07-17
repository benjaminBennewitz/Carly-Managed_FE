// src/app/core/inbox/workspace-inbox.service.spec.ts

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkspaceMember } from '../workspace/workspace.models';
import { WorkspaceConversation, WorkspaceSystemNotification } from './workspace-inbox.models';
import { WorkspaceInboxService } from './workspace-inbox.service';

const MEMBER_BEN: WorkspaceMember = {
  id: 'member-ben',
  fullName: 'Ben Beispiel',
  email: 'ben@example.test',
  initials: 'BB',
  avatarColor: '#7752B3',
  avatarTextColor: '#FFFFFF',
  role: 'owner',
  isOnline: true,
};

const MEMBER_LEA: WorkspaceMember = {
  id: 'member-lea',
  fullName: 'Lea Beispiel',
  email: 'lea@example.test',
  initials: 'LB',
  avatarColor: '#4B7A78',
  avatarTextColor: '#FFFFFF',
  role: 'member',
  isOnline: false,
};

const NOTIFICATION: WorkspaceSystemNotification = {
  id: 'notification-1',
  kind: 'task',
  title: 'Aufgabe aktualisiert',
  body: 'Eine Aufgabe wurde geändert.',
  icon: 'edit_note',
  actor: MEMBER_LEA,
  createdAt: '2026-07-17T10:00:00.000Z',
  isRead: false,
  route: '/board/demo',
  queryParams: { task: 'task-1' },
};

const CONVERSATION: WorkspaceConversation = {
  id: 'conversation-1',
  participants: [MEMBER_BEN, MEMBER_LEA],
  messages: [
    {
      id: 'message-1',
      kind: 'message',
      sender: MEMBER_LEA,
      subject: 'Abstimmung',
      body: 'Bitte kurz prüfen.',
      createdAt: '2026-07-17T10:05:00.000Z',
    },
  ],
  createdAt: '2026-07-17T10:05:00.000Z',
  updatedAt: '2026-07-17T10:05:00.000Z',
  unreadCount: 2,
  version: 3,
};

describe('WorkspaceInboxService', () => {
  let service: WorkspaceInboxService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WorkspaceInboxService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /** Lädt den gemeinsamen API-Ausgangszustand für einen Test. */
  function flushInbox(): void {
    service.reload('workspace-1');
    httpTesting.expectOne('/api/v1/inbox/notifications/').flush({
      count: 1,
      next: null,
      previous: null,
      results: [NOTIFICATION],
    });
    httpTesting.expectOne('/api/v1/inbox/conversations/').flush([CONVERSATION]);
  }

  it('lädt Benachrichtigungen und Unterhaltungen aus der API', () => {
    flushInbox();

    expect(service.systemNotifications()).toEqual([NOTIFICATION]);
    expect(service.conversations()).toEqual([CONVERSATION]);
    expect(service.unreadSystemCount()).toBe(1);
    expect(service.unreadConversationCount()).toBe(2);
    expect(service.totalUnreadCount()).toBe(3);
  });

  it('markiert eine Systemnachricht optimistisch und serverseitig als gelesen', () => {
    flushInbox();

    service.markSystemNotificationRead(NOTIFICATION.id);

    expect(service.systemNotifications()[0]?.isRead).toBe(true);
    const request = httpTesting.expectOne(
      `/api/v1/inbox/notifications/${NOTIFICATION.id}/mark-read/`,
    );
    expect(request.request.method).toBe('POST');
    request.flush({ ...NOTIFICATION, isRead: true });
  });

  it('markiert alle Systemnachrichten als gelesen und kann sie vollständig entfernen', () => {
    flushInbox();

    service.markAllSystemNotificationsRead();
    expect(service.unreadSystemCount()).toBe(0);
    const markRequest = httpTesting.expectOne('/api/v1/inbox/notifications/mark-all-read/');
    expect(markRequest.request.method).toBe('POST');
    markRequest.flush(null);

    service.clearSystemNotifications();
    expect(service.systemNotifications()).toEqual([]);
    const clearRequest = httpTesting.expectOne('/api/v1/inbox/notifications/clear/');
    expect(clearRequest.request.method).toBe('DELETE');
    clearRequest.flush(null);
  });

  it('erstellt eine Unterhaltung optimistisch und ersetzt sie durch die Serverantwort', () => {
    flushInbox();

    const optimistic = service.createConversation(
      {
        participantIds: [MEMBER_LEA.id],
        subject: 'Neue Abstimmung',
        body: 'Bitte gemeinsam prüfen.',
      },
      [MEMBER_BEN, MEMBER_LEA],
    );

    expect(optimistic?.participants.map((member) => member.id)).toEqual([MEMBER_LEA.id]);
    const request = httpTesting.expectOne('/api/v1/inbox/conversations/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      workspaceId: 'workspace-1',
      participantIds: [MEMBER_LEA.id],
      subject: 'Neue Abstimmung',
      body: 'Bitte gemeinsam prüfen.',
    });

    const saved: WorkspaceConversation = {
      ...CONVERSATION,
      id: 'conversation-new',
      unreadCount: 0,
      version: 1,
    };
    request.flush(saved);

    expect(service.getConversation('conversation-new')).toEqual(saved);
    expect(service.conversations().some((item) => item.id === optimistic?.id)).toBe(false);
  });

  it('sendet Nachrichten und überträgt vorgemerkte Teilnehmer getrennt an die API', () => {
    flushInbox();

    service.sendMessage(
      CONVERSATION.id,
      '  Willkommen im Projekt.  ',
      [MEMBER_BEN, MEMBER_LEA],
      ['member-mira'],
    );

    const participantRequest = httpTesting.expectOne(
      `/api/v1/inbox/conversations/${CONVERSATION.id}/participants/`,
    );
    expect(participantRequest.request.method).toBe('POST');
    expect(participantRequest.request.body).toEqual({
      participantIds: ['member-mira'],
      version: 3,
    });
    participantRequest.flush({ ...CONVERSATION, version: 4 });

    const messageRequest = httpTesting.expectOne(
      `/api/v1/inbox/conversations/${CONVERSATION.id}/messages/`,
    );
    expect(messageRequest.request.method).toBe('POST');
    expect(messageRequest.request.body).toEqual({ body: 'Willkommen im Projekt.' });
    messageRequest.flush({
      ...CONVERSATION,
      messages: [
        ...CONVERSATION.messages,
        {
          id: 'message-2',
          kind: 'message',
          sender: MEMBER_BEN,
          subject: null,
          body: 'Willkommen im Projekt.',
          createdAt: '2026-07-17T10:10:00.000Z',
        },
      ],
      version: 5,
    });

    expect(service.getConversation(CONVERSATION.id)?.messages.at(-1)?.body).toBe(
      'Willkommen im Projekt.',
    );
  });

  it('entfernt Teilnehmer versionsgesichert und aktualisiert den Serverstand', () => {
    flushInbox();

    service.removeParticipants(CONVERSATION.id, [MEMBER_LEA.id]);

    const request = httpTesting.expectOne(
      `/api/v1/inbox/conversations/${CONVERSATION.id}/participants/`,
    );
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ participantIds: [MEMBER_LEA.id], version: 3 });
    request.flush({
      ...CONVERSATION,
      participants: [MEMBER_BEN],
      version: 4,
    });

    expect(service.getConversation(CONVERSATION.id)?.participants).toEqual([MEMBER_BEN]);
  });

  it('setzt den lokalen Lesestand sofort und synchronisiert die Unterhaltung', () => {
    flushInbox();

    service.markConversationRead(CONVERSATION.id);
    expect(service.getConversation(CONVERSATION.id)?.unreadCount).toBe(0);

    const request = httpTesting.expectOne(`/api/v1/inbox/conversations/${CONVERSATION.id}/`);
    expect(request.request.method).toBe('GET');
    request.flush({ ...CONVERSATION, unreadCount: 0 });

    expect(service.totalUnreadCount()).toBe(1);
  });
});
