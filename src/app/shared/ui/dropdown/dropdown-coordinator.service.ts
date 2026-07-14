// src/app/shared/ui/dropdown/dropdown-coordinator.service.ts

import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DropdownCoordinatorService {
  private readonly activeIdState = signal<string | null>(null);

  readonly activeId = this.activeIdState.asReadonly();

  /** Öffnet ausschließlich das angegebene Dropdown. */
  open(id: string): void {
    this.activeIdState.set(id);
  }

  /** Öffnet oder schließt das angegebene Dropdown. */
  toggle(id: string): void {
    this.activeIdState.update((currentId) => (currentId === id ? null : id));
  }

  /** Schließt das angegebene Dropdown, sofern es aktiv ist. */
  close(id: string): void {
    if (this.activeIdState() === id) {
      this.activeIdState.set(null);
    }
  }

  /** Schließt jedes aktuell geöffnete Dropdown. */
  closeAll(): void {
    this.activeIdState.set(null);
  }
}
