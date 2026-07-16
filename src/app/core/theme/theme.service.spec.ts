// src/app/core/theme/theme.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset['theme'] = 'default';
    document.documentElement.dataset['mode'] = 'light';
    document.documentElement.dataset['neuro'] = 'false';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('setzt Farbset und Modus getrennt voneinander', async () => {
    service.setTheme('ocean');
    service.setMode('dark');

    expect(service.theme()).toBe('ocean');
    expect(service.mode()).toBe('dark');

    await vi.waitFor(() => {
      expect(document.documentElement.dataset['theme']).toBe('ocean');
    });
    expect(document.documentElement.dataset['mode']).toBe('dark');
    expect(service.label()).toBe('Ocean · Dunkel');
  });
  it('überspringt die Theme-Animation im Neuro-Modus', () => {
    const startViewTransition = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    document.documentElement.dataset['neuro'] = 'true';

    service.toggleMode();

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(service.mode()).toBe('dark');
  });

});
