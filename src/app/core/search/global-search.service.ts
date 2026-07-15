// src/app/core/search/global-search.service.ts

import { Injectable } from '@angular/core';

import { normalizeSearchValue, normalizeSingleLineInput } from '../security/frontend-input.utils';
import { WorkspacePreviewService } from '../workspace/workspace-preview.service';
import {
  GlobalSearchGroup,
  GlobalSearchResult,
  GlobalSearchResultType,
} from './global-search.models';

interface SearchEntry {
  id: string;
  groupId: string;
  groupLabel: string;
  groupIcon: string;
  title: string;
  subtitle: string;
  keywords: string;
  icon: string;
  route: readonly string[];
  queryParams?: Readonly<Record<string, string>>;
  type: GlobalSearchResultType;
}

const MAX_QUERY_LENGTH = 80;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS_PER_ROUTE = 7;

const ROUTE_ENTRIES: readonly SearchEntry[] = [
  {
    id: 'route-dashboard',
    groupId: 'dashboard',
    groupLabel: 'Dashboard',
    groupIcon: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Übersicht, Kennzahlen und aktuelle Aktivitäten',
    keywords: 'start übersicht kpi aktivität',
    icon: 'dashboard',
    route: ['/dashboard'],
    type: 'route',
  },
  {
    id: 'route-projects',
    groupId: 'projects',
    groupLabel: 'Projekte',
    groupIcon: 'folder_open',
    title: 'Projekte',
    subtitle: 'Projektübersicht und angepinnte Arbeitsbereiche',
    keywords: 'projekt arbeitsbereich board',
    icon: 'folder_open',
    route: ['/projects'],
    type: 'route',
  },
  {
    id: 'route-board',
    groupId: 'personal-board',
    groupLabel: 'Mein Board',
    groupIcon: 'view_kanban',
    title: 'Mein Board',
    subtitle: 'Persönliche Aufgaben und neue Zuweisungen',
    keywords: 'board kanban task aufgabe persönlich neu',
    icon: 'view_kanban',
    route: ['/board'],
    type: 'route',
  },
  {
    id: 'route-members',
    groupId: 'members',
    groupLabel: 'Mitglieder',
    groupIcon: 'group',
    title: 'Mitglieder',
    subtitle: 'Personen, Rollen und Präsenz',
    keywords: 'user benutzer team person rolle online',
    icon: 'group',
    route: ['/members'],
    type: 'route',
  },
  {
    id: 'route-inbox',
    groupId: 'inbox',
    groupLabel: 'Inbox',
    groupIcon: 'inbox',
    title: 'Inbox',
    subtitle: 'Nachrichten und Benachrichtigungen',
    keywords: 'nachricht alarm benachrichtigung',
    icon: 'inbox',
    route: ['/inbox'],
    type: 'route',
  },
  {
    id: 'route-pool',
    groupId: 'pool',
    groupLabel: 'Pool',
    groupIcon: 'inventory_2',
    title: 'Pool',
    subtitle: 'Freie Aufgaben und Aufgaben mit Prüfbedarf',
    keywords: 'unzugewiesen review vergabe task aufgabe',
    icon: 'inventory_2',
    route: ['/pool'],
    type: 'route',
  },
  {
    id: 'route-archive',
    groupId: 'archive',
    groupLabel: 'Archiv',
    groupIcon: 'archive',
    title: 'Archiv',
    subtitle: 'Abgeschlossene Projekte und Aufgabenverlauf',
    keywords: 'historie erledigt abgeschlossen',
    icon: 'archive',
    route: ['/archive'],
    type: 'route',
  },
  {
    id: 'route-carly',
    groupId: 'carly',
    groupLabel: 'Carly',
    groupIcon: 'pets',
    title: 'Carly',
    subtitle: 'Motivation, Stimmung und Fortschritt',
    keywords: 'katze mascot trophäen streak',
    icon: 'pets',
    route: ['/carly'],
    type: 'route',
  },
  {
    id: 'route-settings',
    groupId: 'settings',
    groupLabel: 'Einstellungen',
    groupIcon: 'settings',
    title: 'Einstellungen',
    subtitle: 'Darstellung, Barrierefreiheit und Präferenzen',
    keywords: 'theme darkmode kontrast animation schrift',
    icon: 'settings',
    route: ['/settings'],
    type: 'route',
  },
];

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  constructor(private readonly workspaceService: WorkspacePreviewService) {}

  /**
   * Bereinigt eine Suchanfrage vollständig im Frontend.
   */
  sanitizeQuery(value: string): string {
    return normalizeSingleLineInput(value, MAX_QUERY_LENGTH);
  }

  /**
   * Durchsucht lokale Vorschauinhalte und gruppiert Treffer nach Zielroute.
   */
  search(rawQuery: string): GlobalSearchGroup[] {
    const query = this.sanitizeQuery(rawQuery);
    if (query.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const normalizedQuery = normalizeSearchValue(query);
    const tokens = normalizedQuery.split(' ').filter(Boolean);
    const results = this.buildIndex()
      .map((entry) => this.toResult(entry, tokens, normalizedQuery))
      .filter((result): result is GlobalSearchResult => result !== null)
      .sort(
        (left, right) => right.score - left.score || left.title.localeCompare(right.title, 'de'),
      );

    const groups = new Map<string, GlobalSearchGroup>();

    for (const result of results) {
      const group = groups.get(result.groupId) ?? {
        id: result.groupId,
        label: result.groupLabel,
        icon: result.groupIcon,
        results: [],
      };

      if (group.results.length >= MAX_RESULTS_PER_ROUTE) {
        continue;
      }

      groups.set(result.groupId, {
        ...group,
        results: [...group.results, result],
      });
    }

    return [...groups.values()];
  }

  /**
   * Erstellt den lokalen Suchindex aus Routen, Projekten, Tasks und Personen.
   */
  private buildIndex(): SearchEntry[] {
    const entries: SearchEntry[] = [...ROUTE_ENTRIES];
    const seenBoardTaskIds = new Set<string>();

    for (const project of this.workspaceService.projects()) {
      entries.push({
        id: `project-${project.id}`,
        groupId: 'projects',
        groupLabel: 'Projekte',
        groupIcon: 'folder_open',
        title: project.name,
        subtitle: `${project.slugLabel} · ${project.description}`,
        keywords: `${project.dueSummary} ${project.owner.fullName}`,
        icon: project.icon,
        route: ['/projects', project.id, 'board'],
        type: 'project',
      });

      for (const column of this.workspaceService.getBoard(project.id)) {
        for (const task of column.tasks) {
          seenBoardTaskIds.add(task.id);
          entries.push({
            id: `task-${project.id}-${task.id}`,
            groupId: `project-board-${project.id}`,
            groupLabel: project.name,
            groupIcon: project.icon,
            title: task.title,
            subtitle: `${column.title} · ${task.assignee?.fullName ?? 'Nicht zugewiesen'}`,
            keywords: `${task.description} ${task.tags.join(' ')} ${task.priority}`,
            icon: task.isDone ? 'task_alt' : 'check_box_outline_blank',
            route: ['/projects', project.id, 'board'],
            queryParams: { task: task.id },
            type: 'task',
          });
        }
      }
    }

    for (const column of this.workspaceService.getBoard('personal')) {
      for (const task of column.tasks) {
        if (seenBoardTaskIds.has(task.id)) {
          continue;
        }
        seenBoardTaskIds.add(task.id);
        entries.push({
          id: `task-personal-${task.id}`,
          groupId: 'personal-board',
          groupLabel: 'Mein Board',
          groupIcon: 'view_kanban',
          title: task.title,
          subtitle: `${column.title} · ${task.projectTitle ?? 'Persönliche Aufgabe'}`,
          keywords: `${task.description} ${task.tags.join(' ')} ${task.priority}`,
          icon: task.isDone ? 'task_alt' : 'check_box_outline_blank',
          route: ['/board'],
          queryParams: { task: task.id },
          type: 'task',
        });
      }
    }

    for (const task of this.workspaceService.poolTasks()) {
      entries.push({
        id: `pool-task-${task.id}`,
        groupId: 'pool',
        groupLabel: 'Pool',
        groupIcon: 'inventory_2',
        title: task.title,
        subtitle: task.reviewHint ?? task.projectTitle ?? 'Freie Aufgabe',
        keywords: `${task.description} ${task.tags.join(' ')} review vergabe`,
        icon: task.requiresReview ? 'rate_review' : 'inventory_2',
        route: ['/pool'],
        type: 'task',
      });
    }

    for (const project of this.workspaceService.archivedProjects()) {
      entries.push({
        id: `archive-project-${project.id}`,
        groupId: 'archive',
        groupLabel: 'Archiv',
        groupIcon: 'archive',
        title: project.name,
        subtitle: `${project.slugLabel} · ${project.description}`,
        keywords: `${project.status} ${project.owner.fullName}`,
        icon: 'folder_zip',
        route: ['/archive'],
        type: 'archive',
      });
    }

    for (const member of this.workspaceService.members()) {
      entries.push({
        id: `member-${member.id}`,
        groupId: 'members',
        groupLabel: 'Mitglieder',
        groupIcon: 'group',
        title: member.fullName,
        subtitle: `${member.email} · ${member.isOnline ? 'Online' : 'Offline'}`,
        keywords: `${member.role} ${member.initials}`,
        icon: 'person',
        route: ['/members'],
        queryParams: { member: member.id },
        type: 'member',
      });
    }

    return entries;
  }

  /**
   * Bewertet einen Indexeintrag gegen die vollständige Suchanfrage.
   */
  private toResult(
    entry: SearchEntry,
    tokens: readonly string[],
    normalizedQuery: string,
  ): GlobalSearchResult | null {
    const normalizedTitle = normalizeSearchValue(entry.title);
    const normalizedSubtitle = normalizeSearchValue(entry.subtitle);
    const normalizedKeywords = normalizeSearchValue(entry.keywords);
    const haystack = `${normalizedTitle} ${normalizedSubtitle} ${normalizedKeywords}`;

    if (!tokens.every((token) => haystack.includes(token))) {
      return null;
    }

    let score = 10;
    if (normalizedTitle === normalizedQuery) score += 120;
    if (normalizedTitle.startsWith(normalizedQuery)) score += 80;
    if (normalizedTitle.includes(normalizedQuery)) score += 50;
    if (normalizedSubtitle.includes(normalizedQuery)) score += 20;
    score += Math.max(0, 20 - entry.title.length / 5);

    return { ...entry, score };
  }
}
