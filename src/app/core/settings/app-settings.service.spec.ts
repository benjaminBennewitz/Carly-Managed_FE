// src/app/core/settings/app-settings.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppSettingsService } from './app-settings.service';

describe('AppSettingsService', () => {
  let service: AppSettingsService;

  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppSettingsService);
  });

  it('initialisiert barrierearme Standardwerte am Dokument', () => {
    expect(service.accessibility().colorVisionMode).toBe('standard');
    expect(document.documentElement.dataset['motion']).toBe('full');
    expect(document.documentElement.dataset['contrast']).toBe('normal');
  });

  it('persistiert Darstellungsoptionen und überträgt sie auf das Dokument', () => {
    service.updateAccessibility({
      colorVisionMode: 'monochrome',
      reduceMotion: true,
      fontSize: 'xlarge',
      highContrast: true,
    });

    expect(document.documentElement.dataset['colorVision']).toBe('monochrome');
    expect(document.documentElement.dataset['motion']).toBe('reduced');
    expect(document.documentElement.dataset['fontSize']).toBe('xlarge');
    expect(document.documentElement.dataset['contrast']).toBe('more');
    expect(window.localStorage.getItem('carly-managed-app-settings-v1')).toContain('monochrome');
  });

  it('unterdrückt deaktivierte Alarmkategorien', () => {
    service.setAlarm('taskMove', false);

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
    button.dispatchEvent(new Event('pointerover', { bubbles: true }));

    expect(tooltip?.dataset['visible']).toBe('false');
  });

  it('erkennt aktivierte Produktivitätstools', () => {
    expect(service.hasActiveTools()).toBe(false);

    service.updateTools({ pomodoro: true });

    expect(service.hasActiveTools()).toBe(true);
  });
});
