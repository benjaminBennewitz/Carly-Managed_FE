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
import { WorkspaceService } from '../../../../core/workspace/workspace.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

type SystemMessageFilter = 'all' | 'unread';
type InboxDialogState = 'new-chat' | 'manage-participants' | 'delete-conversation' | null;

@Component({
  selector: 'cm-inbox-page',
  imports: [PageHeaderComponent, ReactiveFormsModule],
  templateUrl: './inbox-page.component.html',
  styleUrl: './inbox-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPageComponent {
  @ViewChild('threadViewport') private readonly threadViewport?: ElementRef<HTMLElement>;
  @ViewChild('messageTextarea') private readonly messageTextarea?: ElementRef<HTMLTextAreaElement>;

  protected readonly inboxService: WorkspaceInboxService;
  protected readonly workspaceService: WorkspaceService;
  protected readonly selectedConversationId = signal<string | null>(null);
  protected readonly systemFilter = signal<SystemMessageFilter>('all');
  protected readonly dialogState = signal<InboxDialogState>(null);
  protected readonly selectedNewParticipantIds = signal<string[]>([]);
  protected readonly selectedAdditionalParticipantIds = signal<string[]>([]);
  protected readonly selectedRemovalParticipantIds = signal<string[]>([]);
  protected readonly pendingMentionParticipantIds = signal<string[]>([]);
  protected readonly submittedNewConversation = signal(false);
  protected readonly submittedMessage = signal(false);
  protected readonly feedback = signal('');
  protected readonly emojiPickerOpen = signal(false);
  protected readonly mentionQuery = signal<string | null>(null);
  protected readonly mentionStartIndex = signal<number | null>(null);
  protected readonly currentMemberId = 'member-ben';
  protected readonly emojis = [
    '😀',
    '😊',
    '😂',
    '😍',
    '🤔',
    '😎',
    '🥳',
    '🙌',
    '👏',
    '👍',
    '👀',
    '💪',
    '✨',
    '🔥',
    '💡',
    '✅',
    '🎯',
    '🚀',
    '📌',
    '❤️',
  ] as const;

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
    const pendingIds = new Set(this.pendingMentionParticipantIds());
    return this.workspaceService
      .members()
      .filter(
        (member) =>
          member.id !== this.currentMemberId &&
          !participantIds.has(member.id) &&
          !pendingIds.has(member.id),
      );
  });
  protected readonly pendingMentionMembers = computed(() => {
    const pendingIds = new Set(this.pendingMentionParticipantIds());
    return this.workspaceService.members().filter((member) => pendingIds.has(member.id));
  });
  protected readonly mentionSuggestionsVisible = computed(() => this.mentionQuery() !== null);
  protected readonly filteredMentionMembers = computed(() => {
    const query = this.mentionQuery()?.trim().toLocaleLowerCase('de-DE') ?? '';
    return this.availableParticipantAdditions()
      .filter((member) => {
        if (!query) {
          return true;
        }

        return [member.fullName, member.email].some((value) =>
          value.toLocaleLowerCase('de-DE').includes(query),
        );
      })
      .slice(0, 6);
  });

  constructor(
    inboxService: WorkspaceInboxService,
    workspaceService: WorkspaceService,
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

  /** Schließt aktive Dialoge und Eingabeauswahlen über die Escape-Taste. */
  @HostListener('document:keydown.escape')
  closeDialogFromKeyboard(): void {
    if (this.dialogState()) {
      this.closeDialog();
      return;
    }

    this.closeComposerMenus();
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
    this.messageForm.reset({ body: '' });
    this.submittedMessage.set(false);
    this.pendingMentionParticipantIds.set([]);
    this.closeComposerMenus();
    this.scrollThreadToEnd();
  }

  /** Öffnet den Dialog für eine neue Direkt- oder Gruppenunterhaltung. */
  openNewConversationDialog(): void {
    this.closeComposerMenus();
    this.newConversationForm.reset({ subject: '', body: '' });
    this.selectedNewParticipantIds.set([]);
    this.submittedNewConversation.set(false);
    this.dialogState.set('new-chat');
  }

  /** Öffnet die Verwaltung für bestehende und neue Chatteilnehmende. */
  openManageParticipantsDialog(): void {
    this.closeComposerMenus();
    if (!this.activeConversation()) {
      return;
    }

    this.selectedAdditionalParticipantIds.set([]);
    this.selectedRemovalParticipantIds.set([]);
    this.dialogState.set('manage-participants');
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
    this.selectedRemovalParticipantIds.set([]);
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

  /** Wählt eine bestehende Person zum Entfernen aus dem Gruppenchat aus oder ab. */
  toggleRemovalParticipant(memberId: string): void {
    const conversation = this.activeConversation();
    if (!conversation || this.getOtherParticipants(conversation).length <= 1) {
      return;
    }

    this.selectedRemovalParticipantIds.update((selectedIds) => {
      if (selectedIds.includes(memberId)) {
        return selectedIds.filter((id) => id !== memberId);
      }

      const maximumRemovals = this.getOtherParticipants(conversation).length - 1;
      return selectedIds.length < maximumRemovals ? [...selectedIds, memberId] : selectedIds;
    });
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
      this.pendingMentionParticipantIds(),
    );

    if (!updatedConversation) {
      return;
    }

    this.messageForm.reset({ body: '' });
    this.submittedMessage.set(false);
    this.pendingMentionParticipantIds.set([]);
    this.closeComposerMenus();
    this.scrollThreadToEnd();
  }

  /** Öffnet oder schließt die Emoji-Auswahl für die aktuelle Nachricht. */
  toggleEmojiPicker(): void {
    this.mentionQuery.set(null);
    this.mentionStartIndex.set(null);
    this.emojiPickerOpen.update((isOpen) => !isOpen);
  }

  /** Fügt ein Emoji an der aktuellen Cursorposition in die Nachricht ein. */
  insertEmoji(emoji: string): void {
    const textarea = this.messageTextarea?.nativeElement;
    const currentValue = this.messageForm.controls.body.value;
    const selectionStart = textarea?.selectionStart ?? currentValue.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const nextValue =
      `${currentValue.slice(0, selectionStart)}${emoji}${currentValue.slice(selectionEnd)}`.slice(
        0,
        2_000,
      );
    const nextCursorPosition = Math.min(selectionStart + emoji.length, nextValue.length);

    this.messageForm.controls.body.setValue(nextValue);
    this.emojiPickerOpen.set(false);
    this.focusMessageTextarea(nextCursorPosition);
  }

  /** Prüft die aktuelle Eingabe auf eine @-Suche nach weiteren Teammitgliedern. */
  handleMessageInput(event: Event): void {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    this.syncPendingMentionParticipants(textarea.value);
    const cursorPosition = textarea.selectionStart ?? textarea.value.length;
    const textBeforeCursor = textarea.value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/u);

    if (!match) {
      this.mentionQuery.set(null);
      this.mentionStartIndex.set(null);
      return;
    }

    const matchValue = match[0];
    const mentionStart = cursorPosition - matchValue.length + (matchValue.startsWith(' ') ? 1 : 0);
    this.emojiPickerOpen.set(false);
    this.mentionStartIndex.set(mentionStart);
    this.mentionQuery.set(match[1] ?? '');
  }

  /** Merkt eine gefundene Person vor und ergänzt ihre Erwähnung im Text. */
  addMentionedParticipant(member: WorkspaceMember): void {
    const conversation = this.activeConversation();
    const textarea = this.messageTextarea?.nativeElement;
    const mentionStart = this.mentionStartIndex();
    if (!conversation || mentionStart === null) {
      return;
    }

    const currentValue = this.messageForm.controls.body.value;
    const selectionEnd = textarea?.selectionStart ?? currentValue.length;
    const replacement = `${this.getMentionToken(member)} `;
    const nextValue =
      `${currentValue.slice(0, mentionStart)}${replacement}${currentValue.slice(selectionEnd)}`.slice(
        0,
        2_000,
      );
    const nextCursorPosition = Math.min(mentionStart + replacement.length, nextValue.length);

    this.pendingMentionParticipantIds.update((participantIds) =>
      participantIds.includes(member.id) ? participantIds : [...participantIds, member.id],
    );
    this.messageForm.controls.body.setValue(nextValue);
    this.mentionQuery.set(null);
    this.mentionStartIndex.set(null);
    this.showFeedback(`${member.fullName} wird beim Senden zum Chat eingeladen.`);
    this.focusMessageTextarea(nextCursorPosition);
  }

  /** Entfernt eine vorgemerkte Einladung und ihre Erwähnung aus dem Entwurf. */
  removePendingMentionParticipant(member: WorkspaceMember): void {
    const mentionToken = this.getMentionToken(member);
    const currentValue = this.messageForm.controls.body.value;
    const nextValue = currentValue
      .replace(`${mentionToken} `, '')
      .replace(mentionToken, '')
      .replace(/ {2,}/gu, ' ');

    this.pendingMentionParticipantIds.update((participantIds) =>
      participantIds.filter((participantId) => participantId !== member.id),
    );
    this.messageForm.controls.body.setValue(nextValue);
  }

  /** Speichert neue und entfernte Personen für den laufenden Chat. */
  saveParticipantChanges(): void {
    const conversation = this.activeConversation();
    if (!conversation) {
      return;
    }

    const removalIds = this.selectedRemovalParticipantIds();
    const additionIds = this.selectedAdditionalParticipantIds();
    if (removalIds.length === 0 && additionIds.length === 0) {
      return;
    }

    if (removalIds.length > 0) {
      this.inboxService.removeParticipants(conversation.id, removalIds);
    }

    if (additionIds.length > 0) {
      this.inboxService.addParticipants(
        conversation.id,
        additionIds,
        this.workspaceService.members(),
      );
    }

    this.closeDialog();
    this.showFeedback('Chatteilnehmende wurden aktualisiert.');
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

  /** Prüft, ob eine Person aus dem aktuellen Chat entfernt werden darf. */
  canRemoveParticipant(conversation: WorkspaceConversation): boolean {
    return this.getOtherParticipants(conversation).length > 1;
  }

  /** Entfernt nicht mehr vorhandene Erwähnungen aus den vorgemerkten Einladungen. */
  private syncPendingMentionParticipants(messageBody: string): void {
    this.pendingMentionParticipantIds.update((participantIds) =>
      participantIds.filter((participantId) => {
        const member = this.workspaceService.members().find((item) => item.id === participantId);
        return member ? messageBody.includes(this.getMentionToken(member)) : false;
      }),
    );
  }

  /** Erstellt das sichtbare Erwähnungs-Token für ein Teammitglied. */
  private getMentionToken(member: WorkspaceMember): string {
    const mentionName = member.fullName.split(/\s+/u)[0] ?? member.fullName;
    return `@${mentionName}`;
  }

  /** Schließt Emoji- und Erwähnungsauswahl im Nachrichteneditor. */
  private closeComposerMenus(): void {
    this.emojiPickerOpen.set(false);
    this.mentionQuery.set(null);
    this.mentionStartIndex.set(null);
  }

  /** Setzt Fokus und Cursorposition nach einer Einfügung wieder in das Textfeld. */
  private focusMessageTextarea(cursorPosition: number): void {
    window.setTimeout(() => {
      const textarea = this.messageTextarea?.nativeElement;
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
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
