// src/app/core/inbox/workspace-inbox.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkspacePreviewService } from '../workspace/workspace-preview.service';
import { WorkspaceInboxService } from './workspace-inbox.service';

describe('WorkspaceInboxService', () => {
  let inboxService: WorkspaceInboxService;
  let workspaceService: WorkspacePreviewService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    workspaceService = TestBed.inject(WorkspacePreviewService);
    inboxService = TestBed.inject(WorkspaceInboxService);
  });

  it('initialisiert getrennte Systemnachrichten und Chat-Konversationen', () => {
    expect(inboxService.systemNotifications().length).toBeGreaterThan(0);
    expect(inboxService.conversations().length).toBeGreaterThan(0);
    expect(inboxService.totalUnreadCount()).toBeGreaterThan(0);
  });

  it('erstellt einen Direktchat und ergänzt später weitere Personen', () => {
    const directConversation = inboxService.createConversation(
      {
        participantIds: ['member-mira'],
        subject: 'Neue Abstimmung',
        body: 'Lass uns die Inbox gemeinsam prüfen.',
      },
      workspaceService.members(),
    );

    expect(directConversation?.participants.length).toBe(2);
    expect(directConversation?.messages.at(-1)?.body).toContain('Inbox');

    const groupConversation = inboxService.addParticipants(
      directConversation?.id ?? '',
      ['member-lea'],
      workspaceService.members(),
    );

    expect(groupConversation?.participants.map((member) => member.id)).toContain('member-lea');
    expect(groupConversation?.messages.at(-1)?.kind).toBe('system');
  });

  it('fügt vorgemerkte Personen erst gemeinsam mit der Nachricht hinzu', () => {
    const directConversation = inboxService.createConversation(
      {
        participantIds: ['member-mira'],
        subject: '',
        body: 'Direktchat starten.',
      },
      workspaceService.members(),
    );

    expect(directConversation?.participants.map((member) => member.id)).not.toContain('member-lea');

    const updatedConversation = inboxService.sendMessage(
      directConversation?.id ?? '',
      '@Lea Willkommen im Chat.',
      workspaceService.members(),
      ['member-lea'],
    );

    expect(updatedConversation?.participants.map((member) => member.id)).toContain('member-lea');
    expect(updatedConversation?.messages.at(-2)?.kind).toBe('system');
    expect(updatedConversation?.messages.at(-1)?.body).toContain('Willkommen');
  });

  it('entfernt Personen aus Gruppenchats und protokolliert die Änderung', () => {
    const conversation = inboxService.createConversation(
      {
        participantIds: ['member-mira', 'member-lea'],
        subject: 'Gruppe',
        body: 'Gruppenchat starten.',
      },
      workspaceService.members(),
    );

    const updatedConversation = inboxService.removeParticipants(conversation?.id ?? '', [
      'member-lea',
    ]);

    expect(updatedConversation?.participants.map((member) => member.id)).not.toContain(
      'member-lea',
    );
    expect(updatedConversation?.participants.length).toBe(2);
    expect(updatedConversation?.messages.at(-1)?.body).toContain('entfernt');
  });

  it('erstellt Systemnachrichten aus Workspace-Aktionen', () => {
    const countBefore = inboxService.systemNotifications().length;

    workspaceService.toggleTaskCompleted('carly-managed', 'task-101');

    expect(inboxService.systemNotifications().length).toBeGreaterThan(countBefore);
    expect(
      inboxService
        .systemNotifications()
        .some((notification) => notification.title === 'Aufgabe abgeschlossen'),
    ).toBe(true);
    expect(
      inboxService
        .systemNotifications()
        .some((notification) => notification.queryParams?.['task'] === 'task-101'),
    ).toBe(true);
  });

  it('markiert Systemmeldungen und Chats als gelesen', () => {
    const notification = inboxService.systemNotifications().find((item) => !item.isRead);
    const conversation = inboxService.conversations().find((item) => item.unreadCount > 0);

    inboxService.markSystemNotificationRead(notification?.id ?? '');
    inboxService.markConversationRead(conversation?.id ?? '');

    expect(
      inboxService.systemNotifications().find((item) => item.id === notification?.id)?.isRead,
    ).toBe(true);
    expect(
      inboxService.conversations().find((item) => item.id === conversation?.id)?.unreadCount,
    ).toBe(0);
  });
});
