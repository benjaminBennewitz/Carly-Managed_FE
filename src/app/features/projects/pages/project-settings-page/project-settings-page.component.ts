// src/app/features/projects/pages/project-settings-page/project-settings-page.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { WorkspaceMember, WorkspaceProject } from '../../../../core/workspace/workspace.models';
import {
  WORKSPACE_PROJECT_COLOR_OPTIONS,
  WORKSPACE_PROJECT_ICON_OPTIONS,
} from '../../../../core/workspace/workspace-project-options';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { MemberSelectComponent } from '../../../../shared/ui/member-select/member-select.component';

type ProjectSettingsTab = 'general' | 'members' | 'interface' | 'management';
type ProjectLifecycleAction = 'complete' | 'archive' | 'delete';

@Component({
  selector: 'cm-project-settings-page',
  imports: [MemberSelectComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './project-settings-page.component.html',
  styleUrl: './project-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSettingsPageComponent {
  protected readonly workspaceService: WorkspacePreviewService;
  protected readonly activeTab = signal<ProjectSettingsTab>('general');
  protected readonly project = signal<WorkspaceProject | null>(null);
  protected readonly managerIds = signal<string[]>([]);
  protected readonly collaboratorIds = signal<string[]>([]);
  protected readonly selectedIcon = signal('folder_open');
  protected readonly selectedColor = signal('#7752B3');
  protected readonly submitted = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal('');
  protected readonly lifecycleError = signal('');
  protected readonly pendingLifecycleAction = signal<ProjectLifecycleAction | null>(null);
  protected readonly deleteConfirmation = signal('');
  protected readonly iconOptions = WORKSPACE_PROJECT_ICON_OPTIONS;
  protected readonly colorOptions = WORKSPACE_PROJECT_COLOR_OPTIONS;

  private readonly formBuilder = inject(FormBuilder);
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    slugLabel: ['', [Validators.required, Validators.maxLength(32)]],
    description: ['', [Validators.maxLength(500)]],
    ownerId: ['', [Validators.required]],
    startedAt: ['', [Validators.required]],
    dueAt: ['', [Validators.required]],
    allowsOnDemandTasks: false,
  });
  protected readonly selectedManagers = computed(() =>
    this.workspaceService.members().filter((member) => this.managerIds().includes(member.id)),
  );
  protected readonly selectedCollaborators = computed(() =>
    this.workspaceService.members().filter((member) => this.collaboratorIds().includes(member.id)),
  );
  protected readonly availableManagerCandidates = computed(() => {
    const blockedIds = new Set([...this.managerIds(), this.form.controls.ownerId.value]);
    return this.workspaceService.members().filter((member) => !blockedIds.has(member.id));
  });
  protected readonly availableCollaboratorCandidates = computed(() => {
    const blockedIds = new Set([
      ...this.managerIds(),
      ...this.collaboratorIds(),
      this.form.controls.ownerId.value,
    ]);
    return this.workspaceService.members().filter((member) => !blockedIds.has(member.id));
  });
  protected readonly selectedIconLabel = computed(
    () =>
      this.iconOptions.find((option) => option.value === this.selectedIcon())?.label ?? 'Ordner',
  );
  protected readonly selectedColorLabel = computed(
    () =>
      this.colorOptions.find((option) => option.value === this.selectedColor())?.label ?? 'Violett',
  );
  protected readonly lifecycleStatusLabel = computed(() => {
    const status = this.project()?.status;

    if (status === 'completed') {
      return 'Abgeschlossen';
    }

    if (status === 'archived') {
      return 'Archiviert';
    }

    return 'Aktiv';
  });
  protected readonly lifecycleActionTitle = computed(() => {
    const action = this.pendingLifecycleAction();

    if (action === 'complete') {
      return 'Projekt abschließen';
    }

    if (action === 'archive') {
      return 'Projekt archivieren';
    }

    return 'Projekt dauerhaft löschen';
  });
  protected readonly lifecycleActionIcon = computed(() => {
    const action = this.pendingLifecycleAction();

    if (action === 'complete') {
      return 'task_alt';
    }

    if (action === 'archive') {
      return 'inventory_2';
    }

    return 'delete_forever';
  });
  protected readonly lifecycleConfirmLabel = computed(() => {
    const action = this.pendingLifecycleAction();

    if (action === 'complete') {
      return 'Projekt abschließen';
    }

    if (action === 'archive') {
      return 'Projekt archivieren';
    }

    return 'Projekt löschen';
  });
  protected readonly canConfirmLifecycleAction = computed(() => {
    const action = this.pendingLifecycleAction();
    const currentProject = this.project();

    if (!action || !currentProject) {
      return false;
    }

    return action !== 'delete' || this.deleteConfirmation() === currentProject.name;
  });

  private savedTimerId: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    workspaceService: WorkspacePreviewService,
    destroyRef: DestroyRef,
  ) {
    this.workspaceService = workspaceService;

    this.route.paramMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      const projectId = params.get('projectId') ?? '';
      this.applyProject(this.workspaceService.getProject(projectId));
    });

    destroyRef.onDestroy(() => {
      if (this.savedTimerId !== null) {
        window.clearTimeout(this.savedTimerId);
      }
    });
  }

  /** Wechselt den sichtbaren Bereich der Projekteinstellungen. */
  setActiveTab(tab: ProjectSettingsTab): void {
    this.activeTab.set(tab);
  }

  /** Übernimmt eine neue verantwortliche Person und hält sie in der Adminliste. */
  changeOwner(memberId: string): void {
    if (!memberId) {
      return;
    }

    this.form.controls.ownerId.setValue(memberId);
    this.managerIds.update((ids) => [...new Set([memberId, ...ids])]);
    this.collaboratorIds.update((ids) => ids.filter((id) => id !== memberId));
  }

  /** Ergänzt eine Person als Projektadmin. */
  addManager(memberId: string): void {
    if (!memberId) {
      return;
    }

    this.managerIds.update((ids) => [...new Set([...ids, memberId])]);
    this.collaboratorIds.update((ids) => ids.filter((id) => id !== memberId));
  }

  /** Entfernt eine Person aus der Adminliste, sofern sie nicht verantwortlich ist. */
  removeManager(memberId: string): void {
    if (memberId === this.form.controls.ownerId.value) {
      return;
    }

    this.managerIds.update((ids) => ids.filter((id) => id !== memberId));
  }

  /** Ergänzt eine Person als mitwirkendes Projektmitglied. */
  addCollaborator(memberId: string): void {
    if (!memberId) {
      return;
    }

    this.collaboratorIds.update((ids) => [...new Set([...ids, memberId])]);
  }

  /** Entfernt eine Person aus der Mitwirkendenliste. */
  removeCollaborator(memberId: string): void {
    this.collaboratorIds.update((ids) => ids.filter((id) => id !== memberId));
  }

  /** Wählt ein Icon aus dem freigegebenen Projekt-Iconset. */
  selectIcon(icon: string): void {
    this.selectedIcon.set(icon);
  }

  /** Wählt eine Projektfarbe aus dem freigegebenen Farbsystem. */
  selectColor(color: string): void {
    this.selectedColor.set(color);
  }

  /** Schaltet eine boolesche Projekteinstellung um. */
  toggleOption(option: 'allowsOnDemandTasks'): void {
    const control = this.form.controls[option];
    control.setValue(!control.value);
    control.markAsDirty();
  }

  /** Speichert die validierten Projekteinstellungen im lokalen Workspace. */
  saveProject(): void {
    const currentProject = this.project();
    this.submitted.set(true);
    this.saveError.set('');
    this.form.markAllAsTouched();

    if (!currentProject || this.form.invalid || this.hasInvalidDateRange()) {
      return;
    }

    const value = this.form.getRawValue();
    const updatedProject = this.workspaceService.updateProject(currentProject.id, {
      name: value.name,
      slugLabel: value.slugLabel,
      description: value.description,
      ownerId: value.ownerId,
      managerIds: this.managerIds(),
      collaboratorIds: this.collaboratorIds(),
      startedAt: value.startedAt,
      dueAt: value.dueAt,
      color: this.selectedColor(),
      icon: this.selectedIcon(),
      isPinned: currentProject.isPinned,
      allowsOnDemandTasks: value.allowsOnDemandTasks,
    });

    if (!updatedProject) {
      this.saveError.set('Die Projekteinstellungen konnten nicht gespeichert werden.');
      return;
    }

    this.project.set(updatedProject);
    this.submitted.set(false);
    this.form.markAsPristine();
    this.saved.set(true);

    if (this.savedTimerId !== null) {
      window.clearTimeout(this.savedTimerId);
    }

    this.savedTimerId = window.setTimeout(() => {
      this.saved.set(false);
      this.savedTimerId = null;
    }, 2_500);
  }

  /** Öffnet die Bestätigung für eine Projektstatus-Aktion. */
  openLifecycleDialog(action: ProjectLifecycleAction): void {
    this.lifecycleError.set('');
    this.deleteConfirmation.set('');
    this.pendingLifecycleAction.set(action);
  }

  /** Schließt die Projektstatus-Bestätigung ohne Änderung. */
  closeLifecycleDialog(): void {
    this.pendingLifecycleAction.set(null);
    this.deleteConfirmation.set('');
    this.lifecycleError.set('');
  }

  /** Übernimmt den eingegebenen Projektnamen für die Löschbestätigung. */
  updateDeleteConfirmation(event: Event): void {
    this.deleteConfirmation.set((event.target as HTMLInputElement).value);
  }

  /** Führt die bestätigte Projektstatus-Aktion aus. */
  confirmLifecycleAction(): void {
    const currentProject = this.project();
    const action = this.pendingLifecycleAction();

    if (!currentProject || !action || !this.canConfirmLifecycleAction()) {
      return;
    }

    if (action === 'complete') {
      const completedProject = this.workspaceService.completeProject(currentProject.id);

      if (!completedProject) {
        this.lifecycleError.set('Das Projekt konnte nicht abgeschlossen werden.');
        return;
      }

      this.closeLifecycleDialog();
      void this.router.navigate(['/archive']);
      return;
    }

    if (action === 'archive') {
      const archivedProject = this.workspaceService.archiveProject(currentProject.id);

      if (!archivedProject) {
        this.lifecycleError.set('Das Projekt konnte nicht archiviert werden.');
        return;
      }

      this.closeLifecycleDialog();
      void this.router.navigate(['/archive']);
      return;
    }

    if (!this.workspaceService.deleteProject(currentProject.id)) {
      this.lifecycleError.set('Das Projekt konnte nicht gelöscht werden.');
      return;
    }

    this.closeLifecycleDialog();
    void this.router.navigate(['/projects']);
  }

  /** Schließt einen geöffneten Bestätigungsdialog per Escape. */
  @HostListener('document:keydown.escape')
  closeLifecycleDialogByKeyboard(): void {
    if (this.pendingLifecycleAction()) {
      this.closeLifecycleDialog();
    }
  }

  /** Wechselt zurück zum Projektboard. */
  openProjectBoard(): void {
    const currentProject = this.project();
    if (currentProject) {
      void this.router.navigate(['/projects', currentProject.id, 'board']);
    }
  }

  /** Prüft, ob der konfigurierte Zeitraum fachlich gültig ist. */
  hasInvalidDateRange(): boolean {
    const startedAt = this.form.controls.startedAt.value;
    const dueAt = this.form.controls.dueAt.value;
    return !!startedAt && !!dueAt && startedAt > dueAt;
  }

  /** Prüft, ob ein Textfeld sichtbar als fehlerhaft markiert werden muss. */
  isFieldInvalid(field: 'name' | 'slugLabel' | 'startedAt' | 'dueAt'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  /** Liefert den persönlichen Vornamen einer Person. */
  getFirstName(member: WorkspaceMember): string {
    return member.fullName.trim().split(/\s+/)[0] ?? member.fullName;
  }

  /** Prüft, ob eine Person aktuell Projektverantwortlicher ist. */
  isOwner(memberId: string): boolean {
    return this.form.controls.ownerId.value === memberId;
  }

  /** Übernimmt ein Projekt in den lokalen Formularzustand. */
  private applyProject(project: WorkspaceProject | null): void {
    this.project.set(project);
    this.submitted.set(false);
    this.saved.set(false);
    this.saveError.set('');
    this.lifecycleError.set('');
    this.pendingLifecycleAction.set(null);
    this.deleteConfirmation.set('');

    if (!project) {
      return;
    }

    this.form.reset({
      name: project.name,
      slugLabel: project.slugLabel,
      description: project.description,
      ownerId: project.owner.id,
      startedAt: project.startedAt,
      dueAt: project.dueAt,
      allowsOnDemandTasks: project.allowsOnDemandTasks,
    });
    this.managerIds.set([
      ...new Set([project.owner.id, ...project.managers.map((item) => item.id)]),
    ]);
    this.collaboratorIds.set(project.collaborators.map((item) => item.id));
    this.selectedIcon.set(project.icon);
    this.selectedColor.set(project.color);
  }
}
