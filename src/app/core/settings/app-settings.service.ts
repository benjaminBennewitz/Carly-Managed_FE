// src/app/core/settings/app-settings.service.ts

import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, Inject, Injectable, signal } from '@angular/core';

import {
  AccessibilitySettings,
  AppSettings,
  GeneralSettings,
  ToolSettings,
  WorkspaceAlarmCategory,
  WorkspaceAlarmSettings,
} from './app-settings.models';

import { API_BASE_URL } from '../api/api.config';

const DEFAULT_ALARMS: WorkspaceAlarmSettings = {
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
};
const DEFAULT_SETTINGS: AppSettings = {
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
    realName: 'Nutzer',
    nickname: 'Nutzer',
    alarms: DEFAULT_ALARMS,
  },
  tools: {
    pomodoro: false,
    taskTimer: false,
    weather: false,
    weatherLocation: '',
  },
};

/** Erstellt eine unabhängige Kopie der Standardeinstellungen. */
function createDefaultSettings(): AppSettings {
  return {
    accessibility: { ...DEFAULT_SETTINGS.accessibility },
    general: {
      ...DEFAULT_SETTINGS.general,
      alarms: { ...DEFAULT_ALARMS },
    },
    tools: { ...DEFAULT_SETTINGS.tools },
  };
}

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly settingsState = signal<AppSettings>(createDefaultSettings());
  private tooltipElement: HTMLElement | null = null;
  private tooltipObserver: MutationObserver | null = null;
  private activeTooltipTarget: HTMLElement | null = null;

  readonly settings = this.settingsState.asReadonly();
  readonly accessibility = computed(() => this.settingsState().accessibility);
  readonly general = computed(() => this.settingsState().general);
  readonly tools = computed(() => this.settingsState().tools);
  readonly hasActiveTools = computed(() => {
    const tools = this.settingsState().tools;
    return tools.pomodoro || tools.taskTimer || tools.weather;
  });
  readonly publicDisplayName = computed(() => {
    const general = this.settingsState().general;
    return general.hideRealName ? general.nickname : general.realName;
  });

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly http: HttpClient,
  ) {
    this.applyDocumentSettings(this.settingsState());
    this.reload();
  }

  /** Lädt den serverseitig gespeicherten Einstellungszustand. */
  reload(): void {
    this.http.get<AppSettings>(`${API_BASE_URL}/preferences/settings/`).subscribe({
      next: (settings) => {
        this.settingsState.set(settings);
        this.applyDocumentSettings(settings);
      },
    });
  }

  /** Stellt sicher, dass der Service beim App-Start initialisiert wird. */
  initialize(): void {
    this.applyDocumentSettings(this.settingsState());
  }

  /** Aktualisiert eine Barrierefreiheitseinstellung. */
  updateAccessibility(changes: Partial<AccessibilitySettings>): void {
    this.updateSettings({
      accessibility: {
        ...this.settingsState().accessibility,
        ...changes,
      },
    });
  }

  /** Aktualisiert eine allgemeine Einstellung. */
  updateGeneral(changes: Partial<Omit<GeneralSettings, 'alarms'>>): void {
    this.updateSettings({
      general: {
        ...this.settingsState().general,
        ...changes,
        alarms: { ...this.settingsState().general.alarms },
      },
    });
  }

  /** Aktiviert oder deaktiviert eine Benachrichtigungskategorie. */
  setAlarm(category: WorkspaceAlarmCategory, enabled: boolean): void {
    this.updateSettings({
      general: {
        ...this.settingsState().general,
        alarms: {
          ...this.settingsState().general.alarms,
          [category]: enabled,
        },
      },
    });
  }

  /** Prüft, ob eine Aktivitätskategorie neue Systemmeldungen erzeugen darf. */
  isAlarmEnabled(category: WorkspaceAlarmCategory): boolean {
    return this.settingsState().general.alarms[category];
  }

  /** Aktualisiert eine Tool-Einstellung. */
  updateTools(changes: Partial<ToolSettings>): void {
    this.updateSettings({
      tools: {
        ...this.settingsState().tools,
        ...changes,
      },
    });
  }

  /** Setzt die persönlichen Einstellungen serverseitig zurück. */
  reset(): void {
    this.http.delete<AppSettings>(`${API_BASE_URL}/preferences/settings/`).subscribe({
      next: (settings) => {
        this.settingsState.set(settings);
        this.applyDocumentSettings(settings);
      },
    });
  }

  /** Aktualisiert, persistiert und aktiviert geänderte Einstellungen. */
  private updateSettings(changes: Partial<AppSettings>): void {
    const current = this.settingsState();
    const nextSettings: AppSettings = {
      accessibility: changes.accessibility ?? current.accessibility,
      general: changes.general ?? current.general,
      tools: changes.tools ?? current.tools,
      version: current.version,
    };

    this.settingsState.set(nextSettings);
    this.applyDocumentSettings(nextSettings);
    this.http.patch<AppSettings>(`${API_BASE_URL}/preferences/settings/`, nextSettings).subscribe({
      next: (settings) => {
        this.settingsState.set(settings);
        this.applyDocumentSettings(settings);
      },
      error: () => this.reload(),
    });
  }

  /** Überträgt Darstellungs- und Bedienoptionen auf das Wurzeldokument. */
  private applyDocumentSettings(settings: AppSettings): void {
    const root = this.document.documentElement;
    root.dataset['colorVision'] = settings.accessibility.colorVisionMode;
    root.dataset['neuro'] = String(settings.accessibility.neuroMode);
    root.dataset['motion'] = settings.accessibility.reduceMotion ? 'reduced' : 'full';
    root.dataset['hover'] = settings.accessibility.reduceHover ? 'reduced' : 'full';
    root.dataset['magnifier'] = String(settings.accessibility.magnifier);
    root.dataset['fontSize'] = settings.accessibility.fontSize;
    root.dataset['contrast'] = settings.accessibility.highContrast ? 'more' : 'normal';
    root.dataset['tooltips'] = settings.general.tooltipsEnabled ? 'on' : 'off';
    this.applyTooltipPreference(settings.general.tooltipsEnabled);
  }

  /** Aktiviert oder deaktiviert globale Tooltips für reine Icon-Aktionen. */
  private applyTooltipPreference(enabled: boolean): void {
    this.ensureTooltipInfrastructure();
    if (!enabled) {
      this.hideTooltip();
    }
  }

  /** Registriert einmalig die Ereignisdelegation für dynamische Icon-Buttons. */
  private ensureTooltipInfrastructure(): void {
    if (this.tooltipElement) {
      return;
    }

    const tooltip = this.document.createElement('div');
    tooltip.className = 'cm-global-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.dataset['visible'] = 'false';
    this.document.body.appendChild(tooltip);
    this.tooltipElement = tooltip;
    this.prepareIconTooltips(this.document.body);
    this.tooltipObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => this.prepareIconTooltips(node));
      });
    });
    this.tooltipObserver.observe(this.document.body, { childList: true, subtree: true });

    this.document.addEventListener('pointerover', this.handleTooltipPointerOver);
    this.document.addEventListener('pointerout', this.handleTooltipPointerOut);
    this.document.addEventListener('focusin', this.handleTooltipFocusIn);
    this.document.addEventListener('focusout', this.handleTooltipFocusOut);
    this.document.addEventListener('keydown', this.handleTooltipKeydown);
    window.addEventListener('scroll', this.hideTooltip, true);
    window.addEventListener('resize', this.hideTooltip);
  }

  /** Öffnet einen Tooltip beim Überfahren einer geeigneten Icon-Aktion. */
  private readonly handleTooltipPointerOver = (event: Event): void => {
    const target = this.getTooltipTarget(event.target);
    if (target) {
      this.showTooltip(target);
    }
  };

  /** Schließt den Tooltip beim Verlassen der aktuellen Aktion. */
  private readonly handleTooltipPointerOut = (event: Event): void => {
    if (!this.activeTooltipTarget) {
      return;
    }

    const relatedTarget = (event as PointerEvent).relatedTarget;
    if (relatedTarget instanceof Node && this.activeTooltipTarget.contains(relatedTarget)) {
      return;
    }
    this.hideTooltip();
  };

  /** Öffnet einen Tooltip bei Tastaturfokus. */
  private readonly handleTooltipFocusIn = (event: FocusEvent): void => {
    const target = this.getTooltipTarget(event.target);
    if (target) {
      this.showTooltip(target);
    }
  };

  /** Schließt den Tooltip nach dem Verlassen des Tastaturfokus. */
  private readonly handleTooltipFocusOut = (): void => {
    this.hideTooltip();
  };

  /** Schließt offene Tooltips über Escape. */
  private readonly handleTooltipKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hideTooltip();
    }
  };

  /** Ermittelt, ob ein Ereignisziel eine reine Icon-Aktion mit Beschriftung ist. */
  private getTooltipTarget(eventTarget: EventTarget | null): HTMLElement | null {
    if (
      this.settingsState().general.tooltipsEnabled === false ||
      !(eventTarget instanceof Element)
    ) {
      return null;
    }

    const target = eventTarget.closest<HTMLElement>('button, a[href], [role="button"]');
    if (!target || !this.isIconOnlyAction(target)) {
      return null;
    }

    return this.getTooltipLabel(target) ? target : null;
  }

  /** Prüft, ob eine Aktion ausschließlich aus einem Symbol besteht. */
  private isIconOnlyAction(target: HTMLElement): boolean {
    const icon = target.querySelector('.material-symbols-outlined');
    if (!icon) {
      return false;
    }

    const copy = target.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.material-symbols-outlined, .visually-hidden').forEach((element) => {
      element.remove();
    });
    return copy.textContent?.replace(/\s+/g, '').length === 0;
  }

  /** Liefert eine verständliche Tooltip-Beschriftung für eine Icon-Aktion. */
  private getTooltipLabel(target: HTMLElement): string {
    const explicitLabel =
      target.getAttribute('aria-label') ??
      target.dataset['cmTooltipTitle'] ??
      target.getAttribute('title') ??
      target.dataset['tooltip'];
    if (explicitLabel?.trim()) {
      return explicitLabel.trim();
    }

    const iconName = target.querySelector('.material-symbols-outlined')?.textContent?.trim() ?? '';
    return this.getIconFallbackLabel(iconName);
  }

  /** Entfernt native Titel von Icon-Aktionen und sichert deren Beschriftung. */
  private prepareIconTooltips(node: Node): void {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const actions = [
      ...(node.matches('button, a[href], [role="button"]') ? [node] : []),
      ...node.querySelectorAll<HTMLElement>('button, a[href], [role="button"]'),
    ];
    actions.forEach((action) => {
      if (!this.isIconOnlyAction(action)) {
        return;
      }

      const title = action.getAttribute('title');
      if (title?.trim()) {
        action.dataset['cmTooltipTitle'] = title.trim();
        action.removeAttribute('title');
      }
    });
  }

  /** Übersetzt häufige Material-Symbole für fehlende explizite Beschriftungen. */
  private getIconFallbackLabel(iconName: string): string {
    const labels: Record<string, string> = {
      add: 'Hinzufügen',
      archive: 'Archivieren',
      close: 'Schließen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      filter_list: 'Filtern',
      more_horiz: 'Weitere Aktionen',
      more_vert: 'Weitere Aktionen',
      refresh: 'Aktualisieren',
      search: 'Suchen',
      settings: 'Einstellungen öffnen',
      sort: 'Sortieren',
      task_alt: 'Als erledigt markieren',
    };
    return labels[iconName] ?? '';
  }

  /** Zeigt und positioniert den globalen Tooltip. */
  private showTooltip(target: HTMLElement): void {
    const tooltip = this.tooltipElement;
    const label = this.getTooltipLabel(target);
    if (!tooltip || !label) {
      return;
    }

    this.activeTooltipTarget = target;
    tooltip.textContent = label;
    tooltip.dataset['visible'] = 'true';

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    let top = targetRect.bottom + gap;

    left = Math.min(
      window.innerWidth - tooltipRect.width - viewportPadding,
      Math.max(viewportPadding, left),
    );
    if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
      top = targetRect.top - tooltipRect.height - gap;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(viewportPadding, top)}px`;
  }

  /** Verbirgt den aktuell sichtbaren Tooltip. */
  private readonly hideTooltip = (): void => {
    if (this.tooltipElement) {
      this.tooltipElement.dataset['visible'] = 'false';
    }
    this.activeTooltipTarget = null;
  };
}
