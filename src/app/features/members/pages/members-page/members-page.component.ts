// src/app/features/members/pages/members-page/members-page.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import {
  WorkspaceJoinRequest,
  WorkspaceMember,
  WorkspaceMemberRole,
} from '../../../../core/workspace/workspace.models';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

type MemberDialogState = 'password-confirm' | 'password-sent' | 'delete-confirm' | null;
type MemberSecurityTone = 'success' | 'brand' | 'warning';

interface MemberSecurityPresentation {
  label: string;
  description: string;
  score: number;
  tone: MemberSecurityTone;
}

@Component({
  selector: 'cm-members-page',
  imports: [PageHeaderComponent, ReactiveFormsModule],
  templateUrl: './members-page.component.html',
  styleUrl: './members-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPageComponent {
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly selectedMemberId = signal<string | null>(null);
  protected readonly expandedMemberId = signal<string | null>(null);
  protected readonly showCreateForm = signal(false);
  protected readonly createSubmitted = signal(false);
  protected readonly editSubmitted = signal(false);
  protected readonly createError = signal('');
  protected readonly editError = signal('');
  protected readonly feedback = signal('');
  protected readonly dialogState = signal<MemberDialogState>(null);
  protected readonly dialogMember = signal<WorkspaceMember | null>(null);
  protected readonly securityBars = [1, 2, 3, 4] as const;

  private readonly formBuilder = inject(FormBuilder);
  private readonly currentMemberId = 'member-ben';

  protected readonly createForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: this.formBuilder.nonNullable.control<WorkspaceMemberRole>('member', Validators.required),
    avatarColor: ['#7752B3', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
  });

  protected readonly editForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: this.formBuilder.nonNullable.control<WorkspaceMemberRole>('member', Validators.required),
    avatarColor: ['#7752B3', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
  });

  constructor(
    workspaceService: WorkspacePreviewService,
    route: ActivatedRoute,
    destroyRef: DestroyRef,
  ) {
    this.workspaceService = workspaceService;
    route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      const memberId = params.get('member');
      this.selectedMemberId.set(memberId);

      if (memberId && this.workspaceService.members().some((member) => member.id === memberId)) {
        this.openMember(memberId);
      }
    });
  }

  /** Schließt offene Dialoge über die Escape-Taste. */
  @HostListener('document:keydown.escape')
  closeOverlays(): void {
    if (this.dialogState()) {
      this.closeDialog();
      return;
    }

    if (this.showCreateForm()) {
      this.closeCreateForm();
    }
  }

  /** Liefert die Rollenbezeichnung eines Mitglieds. */
  getRoleLabel(member: WorkspaceMember): string {
    return this.getRoleLabelByValue(member.role);
  }

  /** Liefert eine lesbare Rollenbezeichnung. */
  getRoleLabelByValue(role: WorkspaceMemberRole): string {
    if (role === 'owner') return 'Owner';
    if (role === 'manager') return 'Manager';
    return 'Mitglied';
  }

  /** Öffnet oder schließt den Bereich zum direkten Hinzufügen eines Mitglieds. */
  toggleCreateForm(): void {
    if (this.showCreateForm()) {
      this.closeCreateForm();
      return;
    }

    this.expandedMemberId.set(null);
    this.createSubmitted.set(false);
    this.createError.set('');
    this.createForm.reset({
      fullName: '',
      email: '',
      role: 'member',
      avatarColor: '#7752B3',
    });
    this.showCreateForm.set(true);
  }

  /** Schließt das Formular zum Hinzufügen eines Mitglieds. */
  closeCreateForm(): void {
    this.showCreateForm.set(false);
    this.createSubmitted.set(false);
    this.createError.set('');
  }

  /** Öffnet oder schließt die Bearbeitung eines Mitglieds. */
  toggleMember(member: WorkspaceMember): void {
    if (this.expandedMemberId() === member.id) {
      this.expandedMemberId.set(null);
      this.editError.set('');
      return;
    }

    this.showCreateForm.set(false);
    this.openMember(member.id);
  }

  /** Legt ein neues Mitglied mit validierten lokalen Daten an. */
  createMember(): void {
    this.createSubmitted.set(true);
    this.createError.set('');

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const member = this.workspaceService.createMember(this.createForm.getRawValue());
    if (!member) {
      this.createError.set('Die E-Mail-Adresse ist bereits vergeben oder ungültig.');
      return;
    }

    this.closeCreateForm();
    this.openMember(member.id);
    this.showFeedback(`${member.fullName} wurde als Mitglied hinzugefügt.`);
  }

  /** Speichert Änderungen des aktuell geöffneten Mitglieds. */
  saveMember(): void {
    const memberId = this.expandedMemberId();
    this.editSubmitted.set(true);
    this.editError.set('');

    if (!memberId || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const member = this.workspaceService.updateMember(memberId, this.editForm.getRawValue());
    if (!member) {
      this.editError.set('Die E-Mail-Adresse ist bereits vergeben oder ungültig.');
      return;
    }

    this.applyMemberToEditForm(member);
    this.showFeedback(`Die Daten von ${member.fullName} wurden gespeichert.`);
  }

  /** Öffnet die Bestätigung zum Löschen eines Mitglieds. */
  openDeleteDialog(member: WorkspaceMember): void {
    if (!this.canDeleteMember(member)) {
      return;
    }

    this.dialogMember.set(member);
    this.dialogState.set('delete-confirm');
  }

  /** Löscht das ausgewählte Mitglied nach Bestätigung. */
  confirmDeleteMember(): void {
    const member = this.dialogMember();
    if (!member || !this.workspaceService.deleteMember(member.id)) {
      return;
    }

    this.expandedMemberId.set(null);
    this.closeDialog();
    this.showFeedback(`${member.fullName} wurde aus dem Team entfernt.`);
  }

  /** Prüft, ob ein Mitglied aus der lokalen Vorschau entfernt werden darf. */
  canDeleteMember(member: WorkspaceMember): boolean {
    return member.id !== this.currentMemberId;
  }

  /** Öffnet die Passwort-Reset-Bestätigung. */
  openPasswordResetDialog(member: WorkspaceMember): void {
    this.dialogMember.set(member);
    this.dialogState.set('password-confirm');
  }

  /** Simuliert den Versand der Passwort-Reset-E-Mail. */
  confirmPasswordReset(): void {
    if (!this.dialogMember()) {
      return;
    }

    this.dialogState.set('password-sent');
  }

  /** Schließt den aktuell sichtbaren Bestätigungsdialog. */
  closeDialog(): void {
    this.dialogState.set(null);
    this.dialogMember.set(null);
  }

  /** Gibt eine offene Beitrittsanfrage frei. */
  approveJoinRequest(request: WorkspaceJoinRequest): void {
    const member = this.workspaceService.approveJoinRequest(request.id);
    if (!member) {
      return;
    }

    this.openMember(member.id);
    this.showFeedback(`${member.fullName} wurde für das Team freigegeben.`);
  }

  /** Lehnt eine offene Beitrittsanfrage ab. */
  rejectJoinRequest(request: WorkspaceJoinRequest): void {
    if (this.workspaceService.rejectJoinRequest(request.id)) {
      this.showFeedback(`Die Anfrage von ${request.fullName} wurde abgelehnt.`);
    }
  }

  /** Liefert Initialen aus einem frei bearbeiteten Namen. */
  getInitials(fullName: string): string {
    const initials = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase('de'))
      .join('');
    return initials || 'NP';
  }

  /** Berechnet eine kontrastreiche Textfarbe für die Avatarfarbe. */
  getAvatarTextColor(backgroundColor: string): string {
    const fallback = '#7752B3';
    const normalized = /^#[0-9A-Fa-f]{6}$/.test(backgroundColor) ? backgroundColor : fallback;
    const hex = normalized.slice(1);
    const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
    const luminance = channels
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
    return luminance > 0.42 ? '#241B2E' : '#FFFFFF';
  }

  /** Liefert den Sicherheitsstatus für die visuelle Passwortanzeige. */
  getSecurityPresentation(member: WorkspaceMember): MemberSecurityPresentation {
    if (member.role === 'owner') {
      return {
        label: 'Sehr hoch',
        description: 'Owner-Konto mit erweiterten Schutzanforderungen.',
        score: 4,
        tone: 'success',
      };
    }

    if (member.role === 'manager') {
      return {
        label: 'Hoch',
        description: 'Erweiterte Rechte mit zusätzlicher Absicherung.',
        score: 3,
        tone: 'brand',
      };
    }

    return {
      label: 'Basis',
      description: 'Standardkonto mit regulären Teamrechten.',
      score: 2,
      tone: 'warning',
    };
  }

  /** Formatiert den Zeitpunkt einer Beitrittsanfrage. */
  formatRequestDate(value: string): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  /** Öffnet ein Mitglied und überträgt dessen Werte in das Bearbeitungsformular. */
  private openMember(memberId: string): void {
    const member = this.workspaceService.members().find((item) => item.id === memberId);
    if (!member) {
      return;
    }

    this.expandedMemberId.set(memberId);
    this.editSubmitted.set(false);
    this.editError.set('');
    this.applyMemberToEditForm(member);
  }

  /** Überträgt Mitgliedsdaten in das Bearbeitungsformular. */
  private applyMemberToEditForm(member: WorkspaceMember): void {
    this.editForm.reset({
      fullName: member.fullName,
      email: member.email,
      role: member.role,
      avatarColor: member.avatarColor,
    });
  }

  /** Zeigt eine kompakte Statusmeldung auf der Seite an. */
  private showFeedback(message: string): void {
    this.feedback.set(message);
  }
}
