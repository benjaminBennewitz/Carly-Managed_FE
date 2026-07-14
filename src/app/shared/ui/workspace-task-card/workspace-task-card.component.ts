// src/app/shared/ui/workspace-task-card/workspace-task-card.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import {
  isOnDemandReadyTask,
} from '../../../core/workspace/task-rules';
import { WorkspaceTask } from '../../../core/workspace/workspace.models';

@Component({
  selector: 'cm-workspace-task-card',
  templateUrl: './workspace-task-card.component.html',
  styleUrl: './workspace-task-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceTaskCardComponent {
  readonly task = input.required<WorkspaceTask>();
  readonly showProjectContext = input(false);
  readonly canToggleComplete = input(true);
  readonly completeToggle = output<WorkspaceTask>();

  protected readonly isOverdue = computed(() => {
    const item = this.task();
    const today = new Date().toISOString().slice(0, 10);
    return !item.isDone && !!item.dueDate && item.dueDate < today;
  });
  protected readonly isDueToday = computed(() => {
    const item = this.task();
    return item.dueDate === new Date().toISOString().slice(0, 10);
  });
  protected readonly isOnDemandReady = computed(() =>
    isOnDemandReadyTask(this.task()),
  );
  protected readonly scheduleLabel = computed(() => {
    const item = this.task();

    if (!item.dueDate) {
      return 'Ohne Termin';
    }

    const formattedDate = new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${item.dueDate}T12:00:00`));

    return item.dueTime ? `${formattedDate} · ${item.dueTime}` : formattedDate;
  });

  /**
   * Schaltet den Abschlussstatus, ohne das Öffnen der Karte auszulösen.
   */
  toggleComplete(event: MouseEvent): void {
    event.stopPropagation();
    this.completeToggle.emit(this.task());
  }
}
