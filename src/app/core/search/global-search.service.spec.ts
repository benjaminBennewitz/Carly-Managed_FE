// src/app/core/search/global-search.service.spec.ts

import { TestBed } from '@angular/core/testing';

import { WorkspaceService } from '../workspace/workspace.service';
import { GlobalSearchService } from './global-search.service';

describe('GlobalSearchService', () => {
  let service: GlobalSearchService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(GlobalSearchService);
    TestBed.inject(WorkspaceService);
  });

  it('bereinigt Steuerzeichen und HTML-Klammern', () => {
    expect(service.sanitizeQuery('  <Board>\u0000   Test  ')).toBe('Board Test');
  });

  it('liefert Treffer nach Zielroute gruppiert', () => {
    const groups = service.search('Board');

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((group) => group.id === 'personal-board')).toBe(true);
  });

  it('liefert bei einer einstelligen Anfrage keine Ergebnisse', () => {
    expect(service.search('a')).toEqual([]);
  });
});
