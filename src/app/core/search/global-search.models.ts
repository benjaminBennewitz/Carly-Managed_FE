// src/app/core/search/global-search.models.ts

export type GlobalSearchResultType = 'route' | 'project' | 'task' | 'member' | 'archive';

export interface GlobalSearchResult {
  id: string;
  groupId: string;
  groupLabel: string;
  groupIcon: string;
  title: string;
  subtitle: string;
  icon: string;
  route: readonly string[];
  queryParams?: Readonly<Record<string, string>>;
  type: GlobalSearchResultType;
  score: number;
}

export interface GlobalSearchGroup {
  id: string;
  label: string;
  icon: string;
  results: readonly GlobalSearchResult[];
}
