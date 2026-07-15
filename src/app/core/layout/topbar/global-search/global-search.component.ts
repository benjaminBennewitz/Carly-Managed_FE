// src/app/core/layout/topbar/global-search/global-search.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  signal,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { GlobalSearchResult } from '../../../search/global-search.models';
import { GlobalSearchService } from '../../../search/global-search.service';
import { DropdownCoordinatorService } from '../../../../shared/ui/dropdown/dropdown-coordinator.service';

const GLOBAL_SEARCH_MENU_ID = 'topbar-global-search';

@Component({
  selector: 'cm-global-search',
  templateUrl: './global-search.component.html',
  styleUrl: './global-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalSearchComponent {
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  protected readonly query = signal('');
  protected readonly activeResultIndex = signal(0);
  protected readonly open = computed(
    () => this.dropdownCoordinator.activeId() === GLOBAL_SEARCH_MENU_ID,
  );
  protected readonly groups = computed(() => this.searchService.search(this.query()));
  protected readonly flatResults = computed(() => this.groups().flatMap((group) => group.results));
  protected readonly sanitizedQuery = computed(() =>
    this.searchService.sanitizeQuery(this.query()),
  );
  protected readonly resultCount = computed(() => this.flatResults().length);

  constructor(
    private readonly searchService: GlobalSearchService,
    private readonly dropdownCoordinator: DropdownCoordinatorService,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly router: Router,
    destroyRef: DestroyRef,
  ) {
    const handlePointerDown = (event: PointerEvent): void => {
      if (!this.elementRef.nativeElement.contains(event.target as Node)) {
        this.dropdownCoordinator.close(GLOBAL_SEARCH_MENU_ID);
      }
    };
    const handleKeydown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('de') === 'k') {
        event.preventDefault();
        this.focusSearch();
        return;
      }

      if (event.key === 'Escape') {
        this.closeSearch();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeydown);

    destroyRef.onDestroy(() => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeydown);
    });
  }

  /** Öffnet die Ergebnisliste beim Fokus des Suchfelds. */
  openSearch(): void {
    this.dropdownCoordinator.open(GLOBAL_SEARCH_MENU_ID);
  }

  /** Bereinigt und übernimmt den aktuellen Suchwert. */
  updateQuery(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = this.searchService.sanitizeQuery(input.value);
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
    this.query.set(sanitized);
    this.activeResultIndex.set(0);
    this.openSearch();
  }

  /** Leert die Suche und hält das Eingabefeld fokussiert. */
  clearQuery(): void {
    this.query.set('');
    this.activeResultIndex.set(0);
    this.searchInput?.nativeElement.focus();
  }

  /** Verarbeitet Pfeiltasten und Enter innerhalb des Suchfelds. */
  handleInputKeydown(event: KeyboardEvent): void {
    const results = this.flatResults();
    if (results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeResultIndex.update((index) => (index + 1) % results.length);
      this.revealActiveResult();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeResultIndex.update((index) => (index - 1 + results.length) % results.length);
      this.revealActiveResult();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[this.activeResultIndex()];
      if (result) {
        this.selectResult(result);
      }
    }
  }

  /** Navigiert zu einem Treffer und schließt die Suche. */
  selectResult(result: GlobalSearchResult): void {
    this.dropdownCoordinator.closeAll();
    this.query.set('');
    this.activeResultIndex.set(0);
    void this.router.navigate(result.route, {
      queryParams: result.queryParams ?? {},
    });
  }

  /** Prüft, ob ein Treffer aktuell per Tastatur markiert ist. */
  isActiveResult(result: GlobalSearchResult): boolean {
    return this.flatResults()[this.activeResultIndex()]?.id === result.id;
  }

  /** Erzeugt eine stabile DOM-ID für die Tastaturnavigation. */
  getResultDomId(result: GlobalSearchResult): string {
    return `global-search-result-${result.id}`;
  }

  /** Schließt die Suche und entfernt den Fokus aus dem Eingabefeld. */
  private closeSearch(): void {
    this.dropdownCoordinator.close(GLOBAL_SEARCH_MENU_ID);
    this.searchInput?.nativeElement.blur();
  }

  /** Fokussiert die Suche über den globalen Tastaturkurzbefehl. */
  private focusSearch(): void {
    this.dropdownCoordinator.open(GLOBAL_SEARCH_MENU_ID);
    window.requestAnimationFrame(() => {
      this.searchInput?.nativeElement.focus();
      this.searchInput?.nativeElement.select();
    });
  }

  /** Scrollt den aktiven Treffer innerhalb der Ergebnisliste sichtbar. */
  private revealActiveResult(): void {
    window.requestAnimationFrame(() => {
      const result = this.flatResults()[this.activeResultIndex()];
      if (!result) {
        return;
      }
      this.elementRef.nativeElement
        .querySelector<HTMLElement>(`#${this.getResultDomId(result)}`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }
}
