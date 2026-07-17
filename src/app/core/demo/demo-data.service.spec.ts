// src/app/core/demo/demo-data.service.spec.ts

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DemoDataService } from './demo-data.service';

describe('DemoDataService', () => {
  let service: DemoDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DemoDataService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lädt die serverseitige Reset-Berechtigung', () => {
    const request = httpTesting.expectOne('/api/v1/demo/status/');
    request.flush({ enabled: true, canReset: true, workspaceName: 'Carly Managed Demo' });

    expect(service.status().canReset).toBe(true);
    expect(service.status().workspaceName).toBe('Carly Managed Demo');
  });

  it('setzt den Demo-Workspace über die API zurück', () => {
    httpTesting.expectOne('/api/v1/demo/status/').flush({
      enabled: true,
      canReset: true,
      workspaceName: 'Carly Managed Demo',
    });

    service.reset().subscribe();
    expect(service.pending()).toBe(true);

    const resetRequest = httpTesting.expectOne('/api/v1/demo/reset/');
    expect(resetRequest.request.method).toBe('POST');
    resetRequest.flush({
      workspaceId: '00000000-0000-0000-0000-000000000001',
      workspaceName: 'Carly Managed Demo',
      projects: 4,
      tasks: 12,
      members: 4,
      notifications: 3,
    });
    httpTesting.expectOne('/api/v1/demo/status/').flush({
      enabled: true,
      canReset: true,
      workspaceName: 'Carly Managed Demo',
    });

    expect(service.pending()).toBe(false);
  });
});
