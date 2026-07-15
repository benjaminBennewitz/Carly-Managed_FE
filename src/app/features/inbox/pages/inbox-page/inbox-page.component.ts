// src/app/features/inbox/pages/inbox-page/inbox-page.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
  WorkspaceConversation,
  WorkspaceSystemNotification,
} from '../../../../core/inbox/workspace-inbox.models';
import { WorkspaceInboxService } from '../../../../core/inbox/workspace-inbox.service';
import { WorkspaceMember } from '../../../../core/workspace/workspace.models';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

type SystemMessageFilter = 'all' | 'unread';
type InboxDialogState = 'new-chat' | 'add-participants' | 'delete-conversation' | null;

@Component({
  selector: 'cm-inbox-page',
  imports: [PageHeaderComponent, ReactiveFormsModule],
  templateUrl: './inbox-page.component.html',
  styleUrl: './inbox-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPageComponent {
  @ViewChild('threadViewport') private readonly threadViewport?: ElementRef<HTMLElement>;

  protected readonly inboxService: WorkspaceInboxService;
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly selectedConversationId = signal<string | null>(null);
  protected readonly systemFilter = signal<SystemMessageFilter>('all');
  protected readonly dialogState = signal<InboxDialogState>(null);
  protected readonly selectedNewParticipantIds = signal<string[]>([]);
  protected readonly selectedAdditionalParticipantIds = signal<string[]>([]);
  protected readonly submittedNewConversation = signal(false);
  protected readonly submittedMessage = signal(false);
  protected readonly feedback = signal('');
  protected readonly currentMemberId = 'member-ben';

  private readonly formBuilder = inject(FormBuilder);
  private feedbackTimerId: number | null = null;

  protected readonly newConversationForm = this.formBuilder.nonNullable.group({
    subject: ['', [Validators.maxLength(120)]],
    body: ['', [Validators.required, Validators.maxLength(2_000)]],
  });
  protected readonly messageForm = this.formBuilder.nonNullable.group({
    body: ['', [Validators.required, Validators.maxLength(2_000)]],
  });
  protected readonly visibleSystemNotifications = computed(() =>
    this.systemFilter() === 'unread'
      ? this.inboxService.systemNotifications().filter((notification) => !notification.isRead)
      : this.inboxService.systemNotifications(),
  );
  protected readonly activeConversation = computed(() => {
    const selectedId = this.selectedConversationId();
    return (
      this.inboxService.conversations().find((conversation) => conversation.id === selectedId) ??
      null
    );
  });
  protected readonly availableConversationMembers = computed(() =>
    this.workspaceService.members().filter((member) => member.id !== this.currentMemberId),
  );
  protected readonly availableParticipantAdditions = computed(() => {
    const participantIds = new Set(
      this.activeConversation()?.participants.map((participant) => participant.id) ?? [],
    );
    return this.workspaceService
      .members()
      .filter((member) => member.id !== this.currentMemberId && !participantIds.has(member.id));
  });

  constructor(
    inboxService: WorkspaceInboxService,
    workspaceService: WorkspacePreviewService,
    private readonly router: Router,
    destroyRef: DestroyRef,
  ) {
    this.inboxService = inboxService;
    this.workspaceService = workspaceService;

    this.inboxService.initialize(this.workspaceService.members());
    this.selectedConversationId.set(this.inboxService.conversations()[0]?.id ?? null);

    destroyRef.onDestroy(() => {
      if (this.feedbackTimerId !== null) {
        window.clearTimeout(this.feedbackTimerId);
      }
    });
  }

  /** Schließt aktive Inbox-Dialoge über die Escape-Taste. */
  @HostListener('document:keydown.escape')
  closeDialogFromKeyboard(): void {
    if (this.dialogState()) {
      this.closeDialog();
    }
  }

  /** Öffnet eine Systemnachricht, markiert sie gelesen und navigiert zum Kontext. */
  openSystemNotification(notification: WorkspaceSystemNotification): void {
    this.inboxService.markSystemNotificationRead(notification.id);
    if (!notification.route) {
      return;
    }

    void this.router.navigate([notification.route], {
      queryParams: notification.queryParams ?? undefined,
    });
  }

  /** Löscht eine einzelne Systemnachricht ohne den Kontext zu öffnen. */
  deleteSystemNotification(notificationId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.inboxService.deleteSystemNotification(notificationId);
  }

  /** Aktiviert den gewünschten Systemnachrichtenfilter. */
  setSystemFilter(filter: SystemMessageFilter): void {
    this.systemFilter.set(filter);
  }

  /** Öffnet eine Chat-Konversation und setzt ihren Ungelesen-Zähler zurück. */
  selectConversation(conversationId: string): void {
    this.selectedConversationId.set(conversationId);
    this.inboxService.markConversationRead(conversationId);
    this.scrollThreadToEnd();
  }

  /** Öffnet den Dialog für eine neue Direkt- oder Gruppenunterhaltung. */
  openNewConversationDialog(): void {
    this.newConversationForm.reset({ subject: '', body: '' });
    this.selectedNewParticipantIds.set([]);
    this.submittedNewConversation.set(false);
    this.dialogState.set('new-chat');
  }

  /** Öffnet die Teilnehmerauswahl für den aktiven Chat. */
  openAddParticipantsDialog(): void {
    if (!this.activeConversation() || this.availableParticipantAdditions().length === 0) {
      return;
    }

    this.selectedAdditionalParticipantIds.set([]);
    this.dialogState.set('add-participants');
  }

  /** Öffnet die Bestätigung zum Entfernen der aktiven Konversation. */
  openDeleteConversationDialog(): void {
    if (this.activeConversation()) {
      this.dialogState.set('delete-conversation');
    }
  }

  /** Schließt den aktuell sichtbaren Inbox-Dialog. */
  closeDialog(): void {
    this.dialogState.set(null);
    this.selectedNewParticipantIds.set([]);
    this.selectedAdditionalParticipantIds.set([]);
  }

  /** Wählt eine Person für eine neue Unterhaltung aus oder ab. */
  toggleNewParticipant(memberId: string): void {
    this.selectedNewParticipantIds.update((selectedIds) =>
      selectedIds.includes(memberId)
        ? selectedIds.filter((id) => id !== memberId)
        : [...selectedIds, memberId],
    );
  }

  /** Wählt eine Person zum Ergänzen im laufenden Chat aus oder ab. */
  toggleAdditionalParticipant(memberId: string): void {
    this.selectedAdditionalParticipantIds.update((selectedIds) =>
      selectedIds.includes(memberId)
        ? selectedIds.filter((id) => id !== memberId)
        : [...selectedIds, memberId],
    );
  }

  /** Erstellt eine neue Direkt- oder Gruppenunterhaltung. */
  createConversation(): void {
    this.submittedNewConversation.set(true);
    if (this.newConversationForm.invalid || this.selectedNewParticipantIds().length === 0) {
      this.newConversationForm.markAllAsTouched();
      return;
    }

    const conversation = this.inboxService.createConversation(
      {
        participantIds: this.selectedNewParticipantIds(),
        subject: this.newConversationForm.controls.subject.value,
        body: this.newConversationForm.controls.body.value,
      },
      this.workspaceService.members(),
    );

    if (!conversation) {
      return;
    }

    this.selectedConversationId.set(conversation.id);
    this.closeDialog();
    this.showFeedback('Unterhaltung wurde gestartet.');
    this.scrollThreadToEnd();
  }

  /** Sendet eine neue Nachricht in den aktiven Chat. */
  sendMessage(): void {
    const conversation = this.activeConversation();
    this.submittedMessage.set(true);

    if (!conversation || this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    const updatedConversation = this.inboxService.sendMessage(
      conversation.id,
      this.messageForm.controls.body.value,
      this.workspaceService.members(),
    );

    if (!updatedConversation) {
      return;
    }

    this.messageForm.reset({ body: '' });
    this.submittedMessage.set(false);
    this.scrollThreadToEnd();
  }

  /** Ergänzt die ausgewählten Personen im laufenden Chat. */
  addParticipants(): void {
    const conversation = this.activeConversation();
    const participantIds = this.selectedAdditionalParticipantIds();
    if (!conversation || participantIds.length === 0) {
      return;
    }

    const updatedConversation = this.inboxService.addParticipants(
      conversation.id,
      participantIds,
      this.workspaceService.members(),
    );

    if (!updatedConversation) {
      return;
    }

    this.closeDialog();
    this.showFeedback('Teilnehmende wurden zum Chat hinzugefügt.');
    this.scrollThreadToEnd();
  }

  /** Entfernt die aktive Unterhaltung aus der lokalen Inbox. */
  deleteActiveConversation(): void {
    const conversation = this.activeConversation();
    if (!conversation) {
      return;
    }

    this.inboxService.deleteConversation(conversation.id);
    this.selectedConversationId.set(this.inboxService.conversations()[0]?.id ?? null);
    this.closeDialog();
    this.showFeedback('Unterhaltung wurde aus der Inbox entfernt.');
  }

  /** Liefert den lesbaren Titel einer Direkt- oder Gruppenunterhaltung. */
  getConversationTitle(conversation: WorkspaceConversation): string {
    const otherParticipants = this.getOtherParticipants(conversation);
    if (otherParticipants.length === 1) {
      return otherParticipants[0]?.fullName ?? 'Direktnachricht';
    }

    return (
      otherParticipants.map((member) => member.fullName.split(' ')[0]).join(', ') || 'Gruppenchat'
    );
  }

  /** Liefert alle sichtbaren Gesprächspartner ohne das aktuelle Mitglied. */
  getOtherParticipants(conversation: WorkspaceConversation): WorkspaceMember[] {
    return conversation.participants.filter(
      (participant) => participant.id !== this.currentMemberId,
    );
  }

  /** Liefert die letzte Nachricht als Vorschautext. */
  getConversationPreview(conversation: WorkspaceConversation): string {
    return conversation.messages.at(-1)?.body ?? 'Noch keine Nachricht';
  }

  /** Prüft, ob eine Nachricht vom aktuell angemeldeten Mitglied stammt. */
  isOwnMessage(senderId: string | null | undefined): boolean {
    return senderId === this.currentMemberId;
  }

  /** Formatiert einen Zeitstempel kompakt für die Inbox. */
  formatDateTime(value: string): string {
    const date = new Date(value);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    return new Intl.DateTimeFormat(
      'de-DE',
      isToday
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' },
    ).format(date);
  }

  /** Liefert eine verständliche Bezeichnung für eine Systemnachrichtenkategorie. */
  getNotificationKindLabel(notification: WorkspaceSystemNotification): string {
    if (notification.kind === 'task') return 'Aufgabe';
    if (notification.kind === 'project') return 'Projekt';
    if (notification.kind === 'member') return 'Team';
    if (notification.kind === 'automation') return 'Automation';
    return 'System';
  }

  /** Prüft, ob eine Person in der übergebenen Auswahlliste enthalten ist. */
  isSelected(memberId: string, selectedIds: readonly string[]): boolean {
    return selectedIds.includes(memberId);
  }

  /** Zeigt eine kurze Statusmeldung oberhalb der Inbox an. */
  private showFeedback(message: string): void {
    if (this.feedbackTimerId !== null) {
      window.clearTimeout(this.feedbackTimerId);
    }

    this.feedback.set(message);
    this.feedbackTimerId = window.setTimeout(() => {
      this.feedback.set('');
      this.feedbackTimerId = null;
    }, 3_200);
  }

  /** Scrollt den sichtbaren Chatverlauf nach der nächsten Renderphase ans Ende. */
  private scrollThreadToEnd(): void {
    window.setTimeout(() => {
      const viewport = this.threadViewport?.nativeElement;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }
}
