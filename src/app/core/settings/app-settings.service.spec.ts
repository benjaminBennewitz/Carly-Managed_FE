// src/app/core/settings/app-settings.service.spec.ts

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppSettings } from './app-settings.models';
import { AppSettingsService } from './app-settings.service';

const SETTINGS_RESPONSE: AppSettings = {
  version: 1,
  accessibility: {
    colorVisionMode: 'standard',
    neuroMode: false,
    reduceMotion: false,
    reduceHover: false,
    magnifier: false,
    fontSize: 'normal',
    highContrast: false,
  },
  general: {
    dynamicNewColumns: true,
    tooltipsEnabled: true,
    allowInvites: true,
    hideRealName: false,
    realName: 'Testnutzer',
    nickname: 'Test',
    alarms: {
      assignment: true,
      taskMove: true,
      taskCompleted: true,
      taskReopened: true,
      taskChanged: true,
      taskDeleted: true,
      projectCreated: true,
      projectChanged: true,
      projectCompleted: true,
      projectArchived: true,
      projectDeleted: true,
      members: true,
      directMessages: true,
    },
  },
  tools: {
    pomodoro: false,
    taskTimer: false,
    weather: false,
    weatherLocation: '',
  },
};

describe('AppSettingsService', () => {
  let service: AppSettingsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AppSettingsService);
    httpTesting.expectOne('/api/v1/preferences/settings/').flush(SETTINGS_RESPONSE);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('initialisiert barrierearme Standardwerte am Dokument', () => {
    expect(service.accessibility().colorVisionMode).toBe('standard');
    expect(document.documentElement.dataset['motion']).toBe('full');
    expect(document.documentElement.dataset['contrast']).toBe('normal');
  });

  it('persistiert Darstellungsoptionen über die API und überträgt sie auf das Dokument', () => {
    service.updateAccessibility({
      colorVisionMode: 'monochrome',
      reduceMotion: true,
      fontSize: 'xlarge',
      highContrast: true,
    });

    const request = httpTesting.expectOne('/api/v1/preferences/settings/');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.accessibility.colorVisionMode).toBe('monochrome');
    request.flush(request.request.body);

    expect(document.documentElement.dataset['colorVision']).toBe('monochrome');
    expect(document.documentElement.dataset['motion']).toBe('reduced');
    expect(document.documentElement.dataset['fontSize']).toBe('xlarge');
    expect(document.documentElement.dataset['contrast']).toBe('more');
  });

  it('unterdrückt deaktivierte Alarmkategorien', () => {
    service.setAlarm('taskMove', false);
    const request = httpTesting.expectOne('/api/v1/preferences/settings/');
    request.flush(request.request.body);

    expect(service.isAlarmEnabled('taskMove')).toBe(false);
    expect(service.isAlarmEnabled('taskCompleted')).toBe(true);
  });

  it('zeigt Tooltips für reine Icon-Aktionen nur bei aktivierter Einstellung', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Details öffnen');
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'open_in_new';
    button.append(icon);
    document.body.append(button);

    button.dispatchEvent(new Event('pointerover', { bubbles: true }));
    const tooltip = document.querySelector<HTMLElement>('.cm-global-tooltip');

    expect(tooltip?.textContent).toBe('Details öffnen');
    expect(tooltip?.dataset['visible']).toBe('true');

    service.updateGeneral({ tooltipsEnabled: false });
    const request = httpTesting.expectOne('/api/v1/preferences/settings/');
    request.flush(request.request.body);
    button.dispatchEvent(new Event('pointerover', { bubbles: true }));

    expect(tooltip?.dataset['visible']).toBe('false');
  });

  it('erkennt aktivierte Produktivitätstools', () => {
    expect(service.hasActiveTools()).toBe(false);

    service.updateTools({ pomodoro: true });
    const request = httpTesting.expectOne('/api/v1/preferences/settings/');
    request.flush(request.request.body);

    expect(service.hasActiveTools()).toBe(true);
  });
});
