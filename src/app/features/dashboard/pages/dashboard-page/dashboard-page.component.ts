// src/app/features/dashboard/pages/dashboard-page/dashboard-page.component.ts

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CarlyService } from '../../../../core/carly/carly.service';
import { WorkspaceInboxService } from '../../../../core/inbox/workspace-inbox.service';
import { WorkspacePreviewService } from '../../../../core/workspace/workspace-preview.service';
import { WorkspaceProject, WorkspaceTask } from '../../../../core/workspace/workspace.models';
import { CarlyFaceComponent } from '../../../../shared/ui/carly-face/carly-face.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

type DashboardKpiKey = 'open' | 'today' | 'overdue' | 'projects' | 'unread';

interface DashboardKpi {
  key: DashboardKpiKey;
  label: string;
  value: number;
  hint: string;
  icon: string;
  tone: 'neutral' | 'accent' | 'warning' | 'danger' | 'success';
}

@Component({
  selector: 'cm-dashboard-page',
  imports: [CarlyFaceComponent, PageHeaderComponent, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrls: [
    './dashboard-page.component.scss',
    './dashboard-page.kpis.scss',
    './dashboard-page.dialog.scss',
    './dashboard-page.panels.scss',
    './dashboard-page.carly.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent {
  protected readonly workspaceService = inject(WorkspacePreviewService);
  protected readonly inboxService = inject(WorkspaceInboxService);
  private readonly router = inject(Router);

  protected readonly carlyService = inject(CarlyService);
  protected readonly activeKpi = signal<DashboardKpiKey | null>(null);
  protected readonly isKpiClosing = signal(false);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly allTasks = computed(() => {
    const taskMap = new Map<string, WorkspaceTask>();
    const boardIds = ['personal', ...this.workspaceService.projects().map((project) => project.id)];

    boardIds
      .flatMap((boardId) => this.workspaceService.getBoard(boardId))
      .flatMap((column) => column.tasks)
      .filter((task) => !task.isSubtaskMirror)
      .forEach((task) => taskMap.set(task.sourceTaskId ?? task.id, task));

    return [...taskMap.values()];
  });

  protected readonly openTasks = computed(() => this.allTasks().filter((task) => !task.isDone));
  protected readonly todayTasks = computed(() =>
    this.openTasks().filter((task) => task.dueDate === this.today),
  );
  protected readonly overdueTasks = computed(() =>
    this.openTasks().filter((task) => !!task.dueDate && task.dueDate < this.today),
  );
  protected readonly focusTasks = computed(() =>
    [...this.openTasks()]
      .sort((left, right) => {
        const priority = { hoch: 0, mittel: 1, niedrig: 2 };
        const dueLeft = left.dueDate ?? '9999-12-31';
        const dueRight = right.dueDate ?? '9999-12-31';
        return dueLeft.localeCompare(dueRight) || priority[left.priority] - priority[right.priority];
      })
      .slice(0, 6),
  );
  protected readonly recentActivity = computed(() => this.inboxService.systemNotifications().slice(0, 5));
  protected readonly activeProjects = computed(() => this.workspaceService.projects());
  protected readonly projectOverview = computed(() =>
    this.activeProjects()
      .map((project) => ({
        project,
        open: this.workspaceService.getOpenTaskCount(project.id),
        overdue: this.workspaceService.getOverdueTaskCount(project.id),
        total: this.workspaceService.getTaskCount(project.id),
      }))
      .sort((left, right) => right.overdue - left.overdue || right.open - left.open)
      .slice(0, 5),
  );

  protected readonly kpis = computed<DashboardKpi[]>(() => [
    { key: 'open', label: 'Offene Aufgaben', value: this.openTasks().length, hint: 'Appweit noch zu erledigen', icon: 'checklist', tone: 'neutral' },
    { key: 'today', label: 'Heute fällig', value: this.todayTasks().length, hint: 'Benötigen heute Aufmerksamkeit', icon: 'today', tone: 'accent' },
    { key: 'overdue', label: 'Überfällig', value: this.overdueTasks().length, hint: 'Termin bereits überschritten', icon: 'warning', tone: 'danger' },
    { key: 'projects', label: 'Aktive Projekte', value: this.activeProjects().length, hint: 'Laufende Arbeitsbereiche', icon: 'folder_open', tone: 'success' },
    { key: 'unread', label: 'Ungelesen', value: this.inboxService.totalUnreadCount(), hint: 'Inbox und Systemmeldungen', icon: 'mark_email_unread', tone: 'warning' },
  ]);

  protected readonly activeKpiData = computed(() =>
    this.kpis().find((item) => item.key === this.activeKpi()) ?? null,
  );

  /** Öffnet oder schließt die Detailliste einer KPI. */
  protected toggleKpi(key: DashboardKpiKey): void {
    if (this.activeKpi() === key) {
      this.closeKpi();
      return;
    }

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    this.isKpiClosing.set(false);
    this.activeKpi.set(key);
  }

  /** Schließt die aktuell geöffnete KPI-Detailliste mit einer kurzen Animation. */
  protected closeKpi(): void {
    if (!this.activeKpi() || this.isKpiClosing()) return;

    this.isKpiClosing.set(true);
    this.closeTimer = setTimeout(() => {
      this.activeKpi.set(null);
      this.isKpiClosing.set(false);
      this.closeTimer = null;
    }, 220);
  }

  /** Öffnet eine Aufgabe im zugehörigen Board-Drawer. */
  protected openTask(task: WorkspaceTask): void {
    const commands = task.projectId ? ['/projects', task.projectId, 'board'] : ['/board'];
    void this.router.navigate(commands, { queryParams: { task: task.id } });
  }

  /** Öffnet das Board eines Projekts. */
  protected openProject(project: WorkspaceProject): void {
    void this.router.navigate(['/projects', project.id, 'board']);
  }

  /** Liefert ein lokalisiertes Datum für kompakte Listen. */
  protected formatDate(value: string | null): string {
    if (!value) return 'Ohne Termin';
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`));
  }

  /** Liefert eine kurze Bezeichnung für Carlys Stimmung. */
  protected moodLabel(): string {
    const mood = this.carlyService.progress().mood;
    return mood.charAt(0).toUpperCase() + mood.slice(1);
  }
}
