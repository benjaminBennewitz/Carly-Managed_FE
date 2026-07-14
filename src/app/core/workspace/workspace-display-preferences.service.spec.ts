// src/app/core/workspace/workspace-display-preferences.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkspaceDisplayPreferencesService } from './workspace-display-preferences.service';

describe('WorkspaceDisplayPreferencesService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('blendet abgeschlossene Aufgaben standardmäßig leicht ab', () => {
    const service = TestBed.inject(WorkspaceDisplayPreferencesService);

    expect(service.fadeCompletedTasks()).toBe(true);
    expect(service.completedTaskFadeLevel()).toBe(15);
    expect(service.completedTaskOpacity()).toBe('0.85');
  });

  it('persistiert Aktivierung und vorbereitete Abblendstärke', () => {
    const service = TestBed.inject(WorkspaceDisplayPreferencesService);
    service.setFadeCompletedTasks(false);
    service.setCompletedTaskFadeLevel(55);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restoredService = TestBed.inject(WorkspaceDisplayPreferencesService);

    expect(restoredService.fadeCompletedTasks()).toBe(false);
    expect(restoredService.completedTaskFadeLevel()).toBe(55);
    expect(restoredService.completedTaskOpacity()).toBe('1.00');
  });
});
