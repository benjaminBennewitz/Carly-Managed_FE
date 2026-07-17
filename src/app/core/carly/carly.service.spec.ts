// src/app/core/carly/carly.service.spec.ts

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CarlyState } from './carly.models';
import { CarlyService } from './carly.service';

const createState = (version: number, positionX = 0.5): CarlyState => ({
  settings: {
    enabled: true,
    showGlobally: true,
    messagesEnabled: true,
    taskReactionsEnabled: true,
    autoSleep: true,
    reduceAnimations: false,
  },
  progress: {
    level: 1,
    experience: 0,
    affection: 50,
    energy: 80,
    satiety: 70,
    streak: 0,
    mood: 'neugierig',
    isSleeping: false,
    lastMessage: 'Carly ist bereit.',
    positionX,
  },
  version,
});

describe('CarlyService', () => {
  let service: CarlyService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CarlyService);
    httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne('/api/v1/preferences/carly/').flush(createState(1));
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('aktualisiert die Drag-Position lokal ohne Netzwerkzugriff', () => {
    service.previewPositionX(0.72);

    expect(service.progress().positionX).toBe(0.72);
    httpTesting.expectNone('/api/v1/preferences/carly/');
  });

  it('speichert die Position nach dem Drag genau einmal', () => {
    service.previewPositionX(0.81);
    service.persistPositionX();

    const request = httpTesting.expectOne('/api/v1/preferences/carly/');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ positionX: 0.81, version: 1 });
    request.flush(createState(2, 0.81));

    expect(service.state().version).toBe(2);
    expect(service.progress().positionX).toBe(0.81);
  });

  it('serialisiert mehrere Änderungen mit dem jeweils aktuellen Versionsstand', () => {
    service.updateSettings({ messagesEnabled: false });
    service.updateSettings({ autoSleep: false });

    const firstRequest = httpTesting.expectOne('/api/v1/preferences/carly/');
    expect(firstRequest.request.body).toEqual({ messagesEnabled: false, version: 1 });
    firstRequest.flush({
      ...createState(2),
      settings: { ...createState(2).settings, messagesEnabled: false },
    });

    const secondRequest = httpTesting.expectOne('/api/v1/preferences/carly/');
    expect(secondRequest.request.body).toEqual({ autoSleep: false, version: 2 });
    secondRequest.flush({
      ...createState(3),
      settings: {
        ...createState(3).settings,
        messagesEnabled: false,
        autoSleep: false,
      },
    });

    expect(service.settings().messagesEnabled).toBe(false);
    expect(service.settings().autoSleep).toBe(false);
    expect(service.state().version).toBe(3);
  });

  it('lädt bei einem Versionskonflikt neu und wiederholt den Patch einmal', () => {
    service.persistPositionX(0.35);

    const failedRequest = httpTesting.expectOne('/api/v1/preferences/carly/');
    expect(failedRequest.request.body).toEqual({ positionX: 0.35, version: 1 });
    failedRequest.flush(
      {
        code: 'version_conflict',
        message: 'Die Einstellungen wurden zwischenzeitlich geändert.',
        details: { currentVersion: 4 },
      },
      { status: 409, statusText: 'Conflict' },
    );

    httpTesting.expectOne('/api/v1/preferences/carly/').flush(createState(4, 0.5));

    const retryRequest = httpTesting.expectOne('/api/v1/preferences/carly/');
    expect(retryRequest.request.body).toEqual({ positionX: 0.35, version: 4 });
    retryRequest.flush(createState(5, 0.35));

    expect(service.state().version).toBe(5);
    expect(service.progress().positionX).toBe(0.35);
  });
});
