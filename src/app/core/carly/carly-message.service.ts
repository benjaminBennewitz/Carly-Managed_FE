/* src/app/core/carly/carly-message.service.ts */

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { WorkspaceProject, WorkspaceTask } from '../workspace/workspace.models';
import { WorkspaceService } from '../workspace/workspace.service';
import { CARLY_MESSAGE_TEMPLATES, CarlyMessageCategory, CarlyMessageTemplate } from './carly-message.catalog';

interface CarlyMessageContext {
  tasks: WorkspaceTask[];
  project: WorkspaceProject | null;
  scope: string;
  total: number;
  done: number;
  open: number;
}

interface CarlyMessageCandidate {
  template: CarlyMessageTemplate;
  score: number;
  values: Record<string, string | number>;
}

const RECENT_MESSAGE_LIMIT = 6;

@Injectable({ providedIn: 'root' })
export class CarlyMessageService {
  private readonly recentMessageIds: string[] = [];

  constructor(
    private readonly router: Router,
    private readonly workspaceService: WorkspaceService,
  ) {}

  /**
   * Wählt eine zur aktuellen Workspace-Situation passende Carly-Nachricht.
   * Reale Termine und Namen haben Vorrang vor allgemeinen Texten.
   */
  pickMessage(): string {
    const context = this.createContext();
    const candidates = this.createCandidates(context);
    const highestScore = Math.max(...candidates.map((candidate) => candidate.score));
    const relevant = candidates.filter((candidate) => candidate.score >= highestScore - 12);
    const fresh = relevant.filter(
      (candidate) => !this.recentMessageIds.includes(candidate.template.id),
    );
    const pool = fresh.length > 0 ? fresh : relevant;
    const selected = pool[Math.floor(Math.random() * pool.length)] ?? candidates[0];

    this.remember(selected.template.id);
    return this.interpolate(selected.template.text, selected.values);
  }

  /** Wählt eine zufällige, zur Inaktivitätsphase passende Carly-Nachricht. */
  pickInactivityMessage(stage: 'nudge' | 'sleepy' | 'sleep'): string {
    const category: CarlyMessageCategory =
      stage === 'nudge' ? 'idle-nudge' : stage === 'sleepy' ? 'idle-sleepy' : 'idle-sleep';
    const templates = CARLY_MESSAGE_TEMPLATES.filter((template) => template.category === category);
    const fresh = templates.filter((template) => !this.recentMessageIds.includes(template.id));
    const pool = fresh.length > 0 ? fresh : templates;
    const selected = pool[Math.floor(Math.random() * pool.length)] ?? templates[0];

    if (!selected) return '';
    this.remember(selected.id);
    return selected.text;
  }

  /** Ermittelt den aktuellen Board- oder Workspace-Kontext ohne erfundene Daten. */
  private createContext(): CarlyMessageContext {
    const boardKey = this.getCurrentBoardKey();

    if (boardKey) {
      const project = boardKey === 'personal' ? null : this.workspaceService.getProject(boardKey);
      const tasks = this.normalizeTasks(
        this.workspaceService.getBoard(boardKey).flatMap((column) => column.tasks),
      );

      return this.summarizeContext(
        tasks,
        project,
        project ? `„${project.name}“` : 'deinem persönlichen Board',
      );
    }

    const projects = this.workspaceService.projects();
    const tasks = this.normalizeTasks([
      ...this.workspaceService.getBoard('personal').flatMap((column) => column.tasks),
      ...projects.flatMap((project) =>
        this.workspaceService.getBoard(project.id).flatMap((column) => column.tasks),
      ),
    ]);

    return this.summarizeContext(tasks, null, 'deinem Workspace');
  }

  /** Erstellt die Kandidatenliste mit Priorität für zeitkritische Informationen. */
  private createCandidates(context: CarlyMessageContext): CarlyMessageCandidate[] {
    const candidates: CarlyMessageCandidate[] = [];
    const openTasks = context.tasks.filter((task) => !task.isDone);
    const datedTasks = openTasks
      .filter((task) => !!task.dueDate)
      .map((task) => ({ task, days: this.daysFromToday(task.dueDate ?? '') }))
      .filter((entry) => entry.days !== null) as Array<{ task: WorkspaceTask; days: number }>;

    const overdue = datedTasks
      .filter((entry) => entry.days < 0)
      .sort((left, right) => left.days - right.days)[0];
    if (overdue) {
      this.addCategory(candidates, 'task-overdue', 100, {
        task: overdue.task.title,
        overdueWhen: this.formatOverdueWhen(Math.abs(overdue.days)),
      });
    }

    const dueToday = datedTasks.find((entry) => entry.days === 0);
    if (dueToday) {
      this.addCategory(candidates, 'task-today', 96, { task: dueToday.task.title });
    }

    const dueSoon = datedTasks
      .filter((entry) => entry.days > 0 && entry.days <= 3)
      .sort((left, right) => left.days - right.days)[0];
    if (dueSoon) {
      const dueWhen = this.formatDueWhen(dueSoon.days);
      this.addCategory(candidates, 'task-soon', 86, {
        task: dueSoon.task.title,
        dueWhen,
        dueWhenCapitalized: this.capitalize(dueWhen),
      });
    }

    const highPriority = openTasks.find((task) => task.priority === 'hoch');
    if (highPriority) {
      this.addCategory(candidates, 'task-priority', 72, { task: highPriority.title });
    }

    if (context.project?.dueAt) {
      const days = this.daysFromToday(context.project.dueAt);
      if (days !== null && days <= 7) {
        this.addCategory(candidates, 'project-deadline', days < 0 ? 92 : 82, {
          project: context.project.name,
          projectDueLabel:
            days < 0
              ? `${this.formatOverdueWhen(Math.abs(days))} überfällig`
              : `${this.formatDueWhen(days)} fällig`,
        });
      }
    }

    if (context.total >= 3) {
      this.addCategory(candidates, 'progress', 54, {
        done: context.done,
        total: context.total,
        open: context.open,
        percent: Math.round((context.done / Math.max(context.total, 1)) * 100),
        scope: context.scope,
      });
    }

    if (context.total > 0 && !datedTasks.some((entry) => entry.days < 0)) {
      this.addCategory(candidates, 'clear', 42, {});
    }

    this.addCategory(candidates, 'generic', 20, {});
    return candidates;
  }

  /** Fügt alle Textvarianten einer Kategorie mit gemeinsamen Kontextwerten hinzu. */
  private addCategory(
    candidates: CarlyMessageCandidate[],
    category: CarlyMessageCategory,
    score: number,
    values: Record<string, string | number>,
  ): void {
    CARLY_MESSAGE_TEMPLATES
      .filter((template) => template.category === category)
      .forEach((template) => candidates.push({ template, score, values }));
  }

  /** Liefert den aktuellen Board-Schlüssel anhand der realen Angular-Route. */
  private getCurrentBoardKey(): string | null {
    const path = this.router.url.split(/[?#]/, 1)[0] ?? '';
    if (path === '/board' || path.startsWith('/board/')) return 'personal';

    const match = path.match(/^\/projects\/([^/]+)\/board(?:\/|$)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }

  /** Entfernt gespiegelte Duplikate, damit Kennzahlen und Hinweise korrekt bleiben. */
  private normalizeTasks(tasks: WorkspaceTask[]): WorkspaceTask[] {
    const unique = new Map<string, WorkspaceTask>();

    tasks
      .filter((task) => !task.isSubtaskMirror)
      .forEach((task) => unique.set(task.id, task));

    return [...unique.values()];
  }

  /** Berechnet die wichtigsten Kennzahlen eines Nachrichtenkontexts. */
  private summarizeContext(
    tasks: WorkspaceTask[],
    project: WorkspaceProject | null,
    scope: string,
  ): CarlyMessageContext {
    const done = tasks.filter((task) => task.isDone).length;
    return {
      tasks,
      project,
      scope,
      total: tasks.length,
      done,
      open: tasks.length - done,
    };
  }

  /** Berechnet Kalendertage relativ zum lokalen heutigen Datum. */
  private daysFromToday(value: string): number | null {
    const date = this.parseDate(value);
    if (!date) return null;

    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((dateUtc - todayUtc) / 86_400_000);
  }

  /** Liest ISO-Datumswerte ohne unbeabsichtigte Zeitzonenverschiebung. */
  private parseDate(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /** Formatiert einen zukünftigen Termin als natürliche deutsche Zeitangabe. */
  private formatDueWhen(days: number): string {
    if (days <= 0) return 'heute';
    if (days === 1) return 'morgen';
    return `in ${days} Tagen`;
  }

  /** Formatiert die Dauer einer bereits überschrittenen Fälligkeit. */
  private formatOverdueWhen(days: number): string {
    if (days <= 1) return 'seit gestern';
    return `seit ${days} Tagen`;
  }

  /** Ersetzt ausschließlich bekannte Platzhalter durch reale Kontextwerte. */
  private interpolate(text: string, values: Record<string, string | number>): string {
    return text.replace(/\{\{([a-zA-Z]+)\}\}/g, (match, key: string) =>
      key in values ? String(values[key]) : match,
    );
  }

  /** Verhindert, dass dieselbe Formulierung unmittelbar erneut gewählt wird. */
  private remember(id: string): void {
    this.recentMessageIds.push(id);
    if (this.recentMessageIds.length > RECENT_MESSAGE_LIMIT) {
      this.recentMessageIds.splice(0, this.recentMessageIds.length - RECENT_MESSAGE_LIMIT);
    }
  }

  /** Schreibt den ersten Buchstaben einer natürlichen Zeitangabe groß. */
  private capitalize(value: string): string {
    return value.length > 0 ? value.charAt(0).toLocaleUpperCase('de') + value.slice(1) : value;
  }
}
