// src/app/features/board/components/task-recurrence-modal/task-recurrence-modal.component.ts

import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import {
  WorkspaceRecurrenceScheduleType,
  WorkspaceRecurrenceWeekday,
  WorkspaceTask,
  WorkspaceTaskRecurrenceRule,
  WorkspaceTaskRecurrenceSavePayload,
} from '../../../../core/workspace/workspace.models';

export interface TaskRecurrenceStateTogglePayload {
  taskId: string;
  isActive: boolean;
}

interface TaskRecurrenceEditorDraft {
  taskId: string;
  scheduleType: WorkspaceRecurrenceScheduleType;
  startDate: string;
  intervalValue: number;
  weekdays: WorkspaceRecurrenceWeekday[];
  dayOfMonth: number | null;
  isActive: boolean;
}

const WEEKDAY_OPTIONS: readonly {
  value: WorkspaceRecurrenceWeekday;
  label: string;
}[] = [
  { value: 'MO', label: 'Mo' },
  { value: 'TU', label: 'Di' },
  { value: 'WE', label: 'Mi' },
  { value: 'TH', label: 'Do' },
  { value: 'FR', label: 'Fr' },
  { value: 'SA', label: 'Sa' },
  { value: 'SU', label: 'So' },
];

@Component({
  selector: 'cm-task-recurrence-modal',
  imports: [CdkTrapFocus],
  templateUrl: './task-recurrence-modal.component.html',
  styleUrl: './task-recurrence-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskRecurrenceModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() isSubmitting = false;
  @Input() title = 'Wiederholungen';
  @Input() rules: readonly WorkspaceTaskRecurrenceRule[] = [];
  @Input() editorTask: WorkspaceTask | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() saveRule = new EventEmitter<WorkspaceTaskRecurrenceSavePayload>();
  @Output() deleteRule = new EventEmitter<string>();
  @Output() toggleRuleState = new EventEmitter<TaskRecurrenceStateTogglePayload>();
  @Output() openRuleTask = new EventEmitter<WorkspaceTaskRecurrenceRule>();

  @ViewChild('modalBody') private modalBody?: ElementRef<HTMLElement>;

  protected readonly weekdayOptions = WEEKDAY_OPTIONS;
  protected editorDraft: TaskRecurrenceEditorDraft | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if ('editorTask' in changes || ('isOpen' in changes && this.isOpen)) {
      this.resetEditorDraft();
      this.resetBodyScroll();
    }
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    if (this.isOpen && !this.isSubmitting) {
      this.close();
    }
  }

  protected get isEditorMode(): boolean {
    return this.editorTask !== null;
  }

  protected get editorLocked(): boolean {
    return this.isSubmitting || this.editorTask?.isDone === true;
  }

  protected get canSave(): boolean {
    const draft = this.editorDraft;
    if (!draft || this.editorLocked || !draft.startDate) {
      return false;
    }

    if (draft.scheduleType === 'weekly_days') {
      return draft.weekdays.length > 0;
    }

    if (draft.scheduleType === 'monthly_day') {
      return !!draft.dayOfMonth && draft.dayOfMonth >= 1 && draft.dayOfMonth <= 31;
    }

    return draft.intervalValue >= 1;
  }

  protected close(): void {
    if (!this.isSubmitting) {
      this.closeModal.emit();
    }
  }

  protected setScheduleType(scheduleType: WorkspaceRecurrenceScheduleType): void {
    const draft = this.editorDraft;
    if (!draft || this.editorLocked) {
      return;
    }

    draft.scheduleType = scheduleType;
    draft.intervalValue = Math.max(1, draft.intervalValue || 1);

    if (scheduleType === 'weekly_days' && draft.weekdays.length === 0) {
      draft.weekdays = ['MO'];
    }

    if (scheduleType === 'monthly_day') {
      draft.dayOfMonth = draft.dayOfMonth ?? this.getDayOfMonth(draft.startDate);
    } else {
      draft.dayOfMonth = null;
    }
  }

  protected toggleWeekday(weekday: WorkspaceRecurrenceWeekday): void {
    const draft = this.editorDraft;
    if (!draft || this.editorLocked) {
      return;
    }

    const weekdays = new Set(draft.weekdays);
    if (weekdays.has(weekday)) {
      weekdays.delete(weekday);
    } else {
      weekdays.add(weekday);
    }

    draft.weekdays = WEEKDAY_OPTIONS.map((option) => option.value).filter((value) =>
      weekdays.has(value),
    );
  }

  protected isWeekdaySelected(weekday: WorkspaceRecurrenceWeekday): boolean {
    return this.editorDraft?.weekdays.includes(weekday) ?? false;
  }

  protected updateStartDate(value: string): void {
    if (this.editorDraft && !this.editorLocked) {
      this.editorDraft.startDate = value;
      if (this.editorDraft.scheduleType === 'monthly_day') {
        this.editorDraft.dayOfMonth = this.getDayOfMonth(value);
      }
    }
  }

  protected updateIntervalValue(value: string): void {
    if (this.editorDraft && !this.editorLocked) {
      this.editorDraft.intervalValue = Math.max(1, Number(value || 1));
    }
  }

  protected updateDayOfMonth(value: string): void {
    if (this.editorDraft && !this.editorLocked) {
      this.editorDraft.dayOfMonth = Math.max(1, Math.min(31, Number(value || 1)));
    }
  }

  protected toggleEditorState(): void {
    if (this.editorDraft && !this.editorLocked) {
      this.editorDraft.isActive = !this.editorDraft.isActive;
    }
  }

  protected save(): void {
    const draft = this.editorDraft;
    if (!draft || !this.canSave) {
      return;
    }

    this.saveRule.emit({
      taskId: draft.taskId,
      scheduleType: draft.scheduleType,
      startDate: draft.startDate,
      intervalValue: draft.intervalValue,
      weekdays: [...draft.weekdays],
      dayOfMonth: draft.scheduleType === 'monthly_day' ? draft.dayOfMonth : null,
      isActive: draft.isActive,
    });
  }

  protected requestDelete(taskId: string): void {
    if (!this.isSubmitting) {
      this.deleteRule.emit(taskId);
    }
  }

  protected toggleRule(rule: WorkspaceTaskRecurrenceRule, event: Event): void {
    event.stopPropagation();
    if (!this.isSubmitting && !rule.taskIsDone) {
      this.toggleRuleState.emit({ taskId: rule.taskId, isActive: !rule.isActive });
    }
  }

  protected deleteListRule(rule: WorkspaceTaskRecurrenceRule, event: Event): void {
    event.stopPropagation();
    if (!this.isSubmitting && !rule.taskIsDone) {
      this.deleteRule.emit(rule.taskId);
    }
  }

  protected openTask(rule: WorkspaceTaskRecurrenceRule): void {
    if (!this.isSubmitting) {
      this.openRuleTask.emit(rule);
    }
  }

  protected formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${value}T12:00:00`));
  }

  protected formatDateTime(value: string | null): string {
    if (!value) {
      return 'Noch nicht ausgeführt';
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  /** Setzt die Scrollposition beim Öffnen und beim Wechsel in den Editor zurück. */
  private resetBodyScroll(): void {
    window.requestAnimationFrame(() => {
      this.modalBody?.nativeElement.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  private resetEditorDraft(): void {
    const task = this.editorTask;
    if (!task) {
      this.editorDraft = null;
      return;
    }

    const rule = task.recurrenceRule;
    const startDate = rule?.startDate ?? task.startDate ?? task.dueDate ?? this.getToday();
    this.editorDraft = {
      taskId: task.id,
      scheduleType: rule?.scheduleType ?? 'weekly_days',
      startDate,
      intervalValue: Math.max(1, rule?.intervalValue ?? 1),
      weekdays: [...(rule?.weekdays ?? ['MO'])],
      dayOfMonth: rule?.dayOfMonth ?? this.getDayOfMonth(startDate),
      isActive: rule?.isActive ?? false,
    };
  }

  private getToday(): string {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
  }

  private getDayOfMonth(value: string): number {
    const day = Number(value.slice(8, 10));
    return Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
  }
}
