// src/app/core/theme/theme.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('verarbeitet moderne Browserfarben und korrigiert dunkle Akzentflächen', () => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
      const style = (element as HTMLElement).style;
      const backgroundToken = style.getPropertyValue('background-color');
      const foregroundToken = style.getPropertyValue('color');
      const backgroundColor = backgroundToken.includes('--color-accent-subtle')
        ? 'color(srgb 0.117647 0.34902 0.360784)'
        : 'rgb(255 255 255)';
      const color = foregroundToken.includes('--color-accent-text')
        ? 'rgb(6 29 26)'
        : foregroundToken.includes('--color-text-primary')
          ? 'rgb(251 248 255)'
          : foregroundToken.includes('--color-text-contrast-dark')
            ? 'rgb(0 0 0)'
            : 'rgb(255 255 255)';

      return { backgroundColor, color } as CSSStyleDeclaration;
    });

    service.setMode('dark');

    expect(document.documentElement.style.getPropertyValue('--color-on-accent-subtle')).toBe(
      'var(--color-text-primary)',
    );
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
