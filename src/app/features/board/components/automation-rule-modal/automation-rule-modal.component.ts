// src/app/features/board/components/automation-rule-modal/automation-rule-modal.component.ts

import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

import {
  WorkspaceAutomationDueDateMode,
  WorkspaceAutomationRule,
  WorkspaceAutomationRuleSavePayload,
  WorkspaceAutomationTaskScope,
  WorkspaceAutomationTrigger,
  WorkspaceColumn,
} from '../../../../core/workspace/workspace.models';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '../../../../shared/ui/select-menu/select-menu.component';

export interface AutomationRuleStateTogglePayload {
  ruleId: string;
  isActive: boolean;
}

const ALL_COLUMNS_VALUE = '__all_columns__';

const TRIGGER_OPTIONS: readonly SelectMenuOption[] = [
  {
    value: 'task.completed',
    label: 'Task erledigt',
    icon: 'task_alt',
    description: 'Sobald eine Aufgabe abgeschlossen wird.',
  },
  {
    value: 'task.reopened',
    label: 'Task wieder geöffnet',
    icon: 'restart_alt',
    description: 'Sobald eine erledigte Aufgabe zurückkehrt.',
  },
  {
    value: 'task.created',
    label: 'Task erstellt',
    icon: 'add_task',
    description: 'Direkt nach dem Erstellen in einer Spalte.',
  },
  {
    value: 'task.assigned',
    label: 'Task zugewiesen',
    icon: 'assignment_ind',
    description: 'Sobald eine verantwortliche Person gesetzt wird.',
  },
  {
    value: 'column.entered',
    label: 'Task betritt Spalte',
    icon: 'move_down',
    description: 'Nach einer manuellen Spaltenverschiebung.',
  },
];

const TASK_SCOPE_OPTIONS: readonly SelectMenuOption[] = [
  {
    value: 'main_task',
    label: 'Hauptaufgabe',
    icon: 'task',
    description: 'Nur eigenständige Aufgaben berücksichtigen.',
  },
  {
    value: 'any_task',
    label: 'Haupt- oder Unteraufgabe',
    icon: 'account_tree',
    description: 'Regel auf alle Aufgabenebenen anwenden.',
  },
];

const DUE_DATE_OPTIONS: readonly SelectMenuOption[] = [
  { value: 'any', label: 'Jedes Datum', icon: 'event_available' },
  { value: 'today', label: 'Heute fällig', icon: 'today' },
  { value: 'due_soon', label: 'Bald fällig', icon: 'upcoming' },
  { value: 'overdue', label: 'Überfällig', icon: 'event_busy' },
  { value: 'without_date', label: 'Ohne Datum', icon: 'block' },
];

const ACTION_OPTIONS: readonly SelectMenuOption[] = [
  {
    value: 'move_task_tree',
    label: 'Task verschieben',
    icon: 'drive_file_move',
    description: 'Aufgabe inklusive Unteraufgaben in eine Zielspalte bewegen.',
  },
];

@Component({
  selector: 'cm-automation-rule-modal',
  imports: [CdkTrapFocus, SelectMenuComponent],
  templateUrl: './automation-rule-modal.component.html',
  styleUrl: './automation-rule-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutomationRuleModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() isSubmitting = false;
  @Input() title = 'Regeln';
  @Input() rules: readonly WorkspaceAutomationRule[] = [];
  @Input() columns: readonly WorkspaceColumn[] = [];

  @Output() closeModal = new EventEmitter<void>();
  @Output() saveRule = new EventEmitter<WorkspaceAutomationRuleSavePayload>();
  @Output() toggleRuleState = new EventEmitter<AutomationRuleStateTogglePayload>();
  @Output() deleteRule = new EventEmitter<string>();

  protected readonly triggerOptions = TRIGGER_OPTIONS;
  protected readonly taskScopeOptions = TASK_SCOPE_OPTIONS;
  protected readonly dueDateOptions = DUE_DATE_OPTIONS;
  protected readonly actionOptions = ACTION_OPTIONS;

  protected selectedRuleId: string | null = null;
  protected selectedTrigger: WorkspaceAutomationTrigger = 'task.completed';
  protected selectedTaskScope: WorkspaceAutomationTaskScope = 'main_task';
  protected selectedSourceColumnId: string | null = null;
  protected selectedSearchTerm = '';
  protected selectedDueDateMode: WorkspaceAutomationDueDateMode = 'any';
  protected selectedTargetColumnId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue && !changes['isOpen']?.previousValue) {
      this.startNewRule();
      return;
    }

    if (changes['columns'] && this.selectedTargetColumnId) {
      const targetExists = this.targetColumnOptions.some(
        (option) => option.value === this.selectedTargetColumnId,
      );
      if (!targetExists) {
        this.selectedTargetColumnId = this.targetColumnOptions[0]?.value ?? null;
      }
    }
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    if (this.isOpen && !this.isSubmitting) {
      this.close();
    }
  }

  protected get selectedRule(): WorkspaceAutomationRule | null {
    return this.rules.find((rule) => rule.id === this.selectedRuleId) ?? null;
  }

  protected get sourceColumnOptions(): readonly SelectMenuOption[] {
    return [
      {
        value: ALL_COLUMNS_VALUE,
        label: 'Alle Spalten',
        icon: 'view_column',
        description: 'Keine Einschränkung auf eine einzelne Spalte.',
      },
      ...this.columns
        .filter((column) => !column.isDynamic)
        .map((column) => ({
          value: column.id,
          label: column.title,
          color: column.color,
        })),
    ];
  }

  protected get targetColumnOptions(): readonly SelectMenuOption[] {
    return this.columns
      .filter((column) => !column.isDynamic)
      .map((column) => ({
        value: column.id,
        label: column.title,
        color: column.color,
      }));
  }

  protected get sourceColumnValue(): string {
    return this.selectedSourceColumnId ?? ALL_COLUMNS_VALUE;
  }

  protected get saveButtonLabel(): string {
    return this.selectedRuleId ? 'Regel aktualisieren' : 'Regel speichern';
  }

  protected get canSave(): boolean {
    return !this.isSubmitting && !!this.selectedTargetColumnId;
  }

  protected close(): void {
    if (!this.isSubmitting) {
      this.closeModal.emit();
    }
  }

  protected startNewRule(): void {
    this.selectedRuleId = null;
    this.selectedTrigger = 'task.completed';
    this.selectedTaskScope = 'main_task';
    this.selectedSourceColumnId = null;
    this.selectedSearchTerm = '';
    this.selectedDueDateMode = 'any';
    this.selectedTargetColumnId =
      this.targetColumnOptions[this.targetColumnOptions.length - 1]?.value ?? null;
  }

  protected loadRule(rule: WorkspaceAutomationRule): void {
    this.selectedRuleId = rule.id;
    this.selectedTrigger = rule.trigger;
    this.selectedTaskScope = rule.conditions.taskScope;
    this.selectedSourceColumnId = rule.conditions.sourceColumnId;
    this.selectedSearchTerm = rule.conditions.searchTerm;
    this.selectedDueDateMode = rule.conditions.dueDateMode;
    this.selectedTargetColumnId = rule.actions[0]?.targetColumnId ?? null;
  }

  protected selectTrigger(value: string): void {
    this.selectedTrigger = value as WorkspaceAutomationTrigger;
  }

  protected selectTaskScope(value: string): void {
    this.selectedTaskScope = value as WorkspaceAutomationTaskScope;
  }

  protected selectSourceColumn(value: string): void {
    this.selectedSourceColumnId = value === ALL_COLUMNS_VALUE ? null : value;
  }

  protected selectDueDateMode(value: string): void {
    this.selectedDueDateMode = value as WorkspaceAutomationDueDateMode;
  }

  protected selectTargetColumn(value: string): void {
    this.selectedTargetColumnId = value;
  }

  protected save(): void {
    if (!this.canSave || !this.selectedTargetColumnId) {
      return;
    }

    const selectedRule = this.selectedRule;
    this.saveRule.emit({
      ruleId: this.selectedRuleId,
      name: this.buildRuleName(),
      trigger: this.selectedTrigger,
      conditions: {
        taskScope: this.selectedTaskScope,
        sourceColumnId: this.selectedSourceColumnId,
        searchTerm: this.selectedSearchTerm.trim(),
        dueDateMode: this.selectedDueDateMode,
      },
      actions: [{ type: 'move_task_tree', targetColumnId: this.selectedTargetColumnId }],
      isActive: selectedRule?.isActive ?? true,
      sortOrder: selectedRule?.sortOrder ?? this.rules.length,
    });
  }

  protected toggle(rule: WorkspaceAutomationRule): void {
    if (!this.isSubmitting) {
      this.toggleRuleState.emit({ ruleId: rule.id, isActive: !rule.isActive });
    }
  }

  protected remove(rule: WorkspaceAutomationRule): void {
    if (!this.isSubmitting) {
      this.deleteRule.emit(rule.id);
      if (this.selectedRuleId === rule.id) {
        this.startNewRule();
      }
    }
  }

  protected getRuleSummary(rule: WorkspaceAutomationRule): string {
    return `${this.getOptionLabel(TRIGGER_OPTIONS, rule.trigger)} · Task verschieben`;
  }

  protected getRuleParameters(rule: WorkspaceAutomationRule): string {
    const source = rule.conditions.sourceColumnId
      ? this.getColumnTitle(rule.conditions.sourceColumnId)
      : 'alle Spalten';
    const search = rule.conditions.searchTerm ? ` · Suche: ${rule.conditions.searchTerm}` : '';
    const dueDate = this.getOptionLabel(DUE_DATE_OPTIONS, rule.conditions.dueDateMode);
    const dueDateSuffix = rule.conditions.dueDateMode === 'any' ? '' : ` · Datum: ${dueDate}`;
    const target = this.getColumnTitle(rule.actions[0]?.targetColumnId ?? '');
    return `Quelle: ${source}${search}${dueDateSuffix} · Ziel: ${target}`;
  }

  private buildRuleName(): string {
    const trigger = this.getOptionLabel(TRIGGER_OPTIONS, this.selectedTrigger);
    const target = this.getColumnTitle(this.selectedTargetColumnId ?? '');
    const search = this.selectedSearchTerm.trim();
    return `${trigger}${search ? ` bei „${search}“` : ''}: nach ${target}`;
  }

  private getColumnTitle(columnId: string): string {
    return this.columns.find((column) => column.id === columnId)?.title ?? 'Spalte nicht verfügbar';
  }

  private getOptionLabel(options: readonly SelectMenuOption[], value: string): string {
    return options.find((option) => option.value === value)?.label ?? value;
  }
}
