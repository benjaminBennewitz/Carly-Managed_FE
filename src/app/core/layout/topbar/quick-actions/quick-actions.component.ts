// src/app/core/layout/topbar/quick-actions/quick-actions.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
  normalizeMultilineInput,
  normalizeSingleLineInput,
} from '../../../security/frontend-input.utils';
import { WorkspacePreviewService } from '../../../workspace/workspace-preview.service';
import { DropdownCoordinatorService } from '../../../../shared/ui/dropdown/dropdown-coordinator.service';
import { MemberSelectComponent } from '../../../../shared/ui/member-select/member-select.component';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '../../../../shared/ui/select-menu/select-menu.component';

type QuickActionType = 'task' | 'project' | 'invite' | 'message';

interface QuickActionDefinition {
  id: QuickActionType;
  label: string;
  description: string;
  icon: string;
}

const QUICK_ACTION_MENU_ID = 'topbar-quick-actions';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'cm-quick-actions',
  imports: [MemberSelectComponent, ReactiveFormsModule, SelectMenuComponent],
  templateUrl: './quick-actions.component.html',
  styleUrl: './quick-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickActionsComponent {
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly open = computed(
    () => this.dropdownCoordinator.activeId() === QUICK_ACTION_MENU_ID,
  );
  protected readonly activeAction = signal<QuickActionType | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly quickActions: readonly QuickActionDefinition[] = [
    {
      id: 'task',
      label: 'Neue Aufgabe',
      description: 'Persönlich, im Projekt oder im Pool',
      icon: 'add_task',
    },
    {
      id: 'project',
      label: 'Neues Projekt',
      description: 'Arbeitsbereich mit Startboard anlegen',
      icon: 'create_new_folder',
    },
    {
      id: 'invite',
      label: 'Person einladen',
      description: 'Mitglied optional einem Projekt zuordnen',
      icon: 'person_add',
    },
    {
      id: 'message',
      label: 'Nachricht senden',
      description: 'Direkte Nachricht vorbereiten',
      icon: 'send',
    },
  ];

  protected readonly boardOptions = computed<readonly SelectMenuOption[]>(() => [
    {
      value: 'personal',
      label: 'Mein Board',
      icon: 'view_kanban',
      description: 'Persönlicher Arbeitsbereich',
    },
    ...this.workspaceService.projects().map((project) => ({
      value: project.id,
      label: project.name,
      icon: project.icon,
      description: project.slugLabel,
    })),
  ]);
  protected readonly projectOptions = computed<readonly SelectMenuOption[]>(() => [
    {
      value: '',
      label: 'Keine Projektzuordnung',
      icon: 'person',
      description: 'Nur als Workspace-Mitglied einladen',
    },
    ...this.workspaceService.projects().map((project) => ({
      value: project.id,
      label: project.name,
      icon: project.icon,
      description: project.slugLabel,
    })),
  ]);

  protected readonly taskForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    boardId: new FormControl('personal', { nonNullable: true }),
    assigneeId: new FormControl('', { nonNullable: true }),
  });

  protected readonly projectForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(320)],
    }),
    dueAt: new FormControl(this.defaultProjectDueDate(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly inviteForm = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(254),
        Validators.pattern(EMAIL_PATTERN),
      ],
    }),
    projectId: new FormControl('', { nonNullable: true }),
  });

  protected readonly messageForm = new FormGroup({
    recipientId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    subject: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2_000)],
    }),
  });

  private feedbackTimerId: number | null = null;

  constructor(
    workspaceService: WorkspacePreviewService,
    private readonly dropdownCoordinator: DropdownCoordinatorService,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly router: Router,
    destroyRef: DestroyRef,
  ) {
    this.workspaceService = workspaceService;
    this.taskForm.controls.assigneeId.setValue(this.workspaceService.members()[0]?.id ?? '');

    const handlePointerDown = (event: PointerEvent): void => {
      if (!this.elementRef.nativeElement.contains(event.target as Node)) {
        this.dropdownCoordinator.close(QUICK_ACTION_MENU_ID);
      }
    };
    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      if (this.activeAction()) {
        this.closeModal();
      } else {
        this.dropdownCoordinator.close(QUICK_ACTION_MENU_ID);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeydown);

    destroyRef.onDestroy(() => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeydown);
      if (this.feedbackTimerId !== null) {
        window.clearTimeout(this.feedbackTimerId);
      }
    });
  }

  /** Öffnet oder schließt das Schnellaktionsmenü. */
  toggleMenu(): void {
    this.dropdownCoordinator.toggle(QUICK_ACTION_MENU_ID);
  }

  /** Öffnet den passenden Schnellaktionsdialog. */
  openAction(action: QuickActionType): void {
    this.dropdownCoordinator.closeAll();
    this.activeAction.set(action);
    this.resetForm(action);
  }

  /** Schließt den Schnellaktionsdialog. */
  closeModal(): void {
    this.activeAction.set(null);
  }

  /** Schließt den Dialog ausschließlich bei einem Klick auf den Hintergrund. */
  closeFromBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  /** Erstellt eine Aufgabe über die zentrale Intake-Logik. */
  createTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const title = normalizeSingleLineInput(this.taskForm.controls.title.value, 120);
    const boardId = this.taskForm.controls.boardId.value;
    const assigneeId = this.taskForm.controls.assigneeId.value || null;
    const task = this.workspaceService.createUnplacedTask(
      boardId === 'personal' ? null : boardId,
      assigneeId,
      title,
    );

    this.closeModal();
    this.showFeedback(
      assigneeId ? 'Aufgabe wurde in „Neu“ angelegt.' : 'Aufgabe wurde im Pool angelegt.',
    );

    if (!assigneeId) {
      void this.router.navigate(['/pool']);
      return;
    }

    const currentMemberId = this.workspaceService.members()[0]?.id;
    if (assigneeId === currentMemberId) {
      void this.router.navigate(['/board'], { queryParams: { task: task.id } });
    }
  }

  /** Erstellt ein Projekt und öffnet dessen Startboard. */
  createProject(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const project = this.workspaceService.createProject({
      name: normalizeSingleLineInput(this.projectForm.controls.name.value, 80),
      description: normalizeMultilineInput(this.projectForm.controls.description.value, 320),
      dueAt: this.projectForm.controls.dueAt.value,
    });
    this.closeModal();
    this.showFeedback('Projekt wurde angelegt.');
    void this.router.navigate(['/projects', project.id, 'board']);
  }

  /** Speichert eine lokale Einladung. */
  inviteMember(): void {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    const member = this.workspaceService.inviteMember({
      fullName: normalizeSingleLineInput(this.inviteForm.controls.fullName.value, 80),
      email: normalizeSingleLineInput(this.inviteForm.controls.email.value, 254),
      projectId: this.inviteForm.controls.projectId.value || null,
    });
    this.closeModal();
    this.showFeedback(`${member.fullName} wurde eingeladen.`);
  }

  /** Speichert eine lokale Nachricht. */
  sendMessage(): void {
    if (this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    const message = this.workspaceService.sendMessage({
      recipientId: this.messageForm.controls.recipientId.value,
      subject: normalizeSingleLineInput(this.messageForm.controls.subject.value, 120),
      body: normalizeMultilineInput(this.messageForm.controls.body.value, 2_000),
    });

    if (!message) {
      return;
    }

    this.closeModal();
    this.showFeedback(`Nachricht an ${message.recipient.fullName} gespeichert.`);
  }

  /** Liefert den Titel des aktiven Schnellaktionsdialogs. */
  getModalTitle(): string {
    return this.quickActions.find((action) => action.id === this.activeAction())?.label ?? '';
  }

  /** Setzt ein Custom-Select-Feld sicher auf den ausgewählten Wert. */
  setControlValue(control: FormControl<string>, value: string): void {
    control.setValue(value);
    control.markAsDirty();
  }

  /** Prüft, ob ein Feld nach Interaktion einen Fehler besitzt. */
  hasError(control: FormControl<string>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  /** Setzt ausschließlich das Formular der geöffneten Aktion zurück. */
  private resetForm(action: QuickActionType): void {
    if (action === 'task') {
      this.taskForm.reset({
        title: '',
        boardId: 'personal',
        assigneeId: this.workspaceService.members()[0]?.id ?? '',
      });
      return;
    }

    if (action === 'project') {
      this.projectForm.reset({
        name: '',
        description: '',
        dueAt: this.defaultProjectDueDate(),
      });
      return;
    }

    if (action === 'invite') {
      this.inviteForm.reset({ fullName: '', email: '', projectId: '' });
      return;
    }

    this.messageForm.reset({ recipientId: '', subject: '', body: '' });
  }

  /** Zeigt eine kurze Statusmeldung in der Topbar. */
  private showFeedback(message: string): void {
    if (this.feedbackTimerId !== null) {
      window.clearTimeout(this.feedbackTimerId);
    }
    this.feedback.set(message);
    this.feedbackTimerId = window.setTimeout(() => {
      this.feedback.set(null);
      this.feedbackTimerId = null;
    }, 3_200);
  }

  /** Ermittelt ein Standardprojektende in 30 Tagen. */
  private defaultProjectDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  }
}
