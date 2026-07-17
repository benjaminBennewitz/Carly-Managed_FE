// src/app/features/settings/pages/settings-page/settings-page.component.ts

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { CarlySettings } from '../../../../core/carly/carly.models';
import { CarlyService } from '../../../../core/carly/carly.service';
import { DemoDataService } from '../../../../core/demo/demo-data.service';
import {
  AccessibilityFontSize,
  ColorVisionMode,
  WorkspaceAlarmCategory,
} from '../../../../core/settings/app-settings.models';
import { AppSettingsService } from '../../../../core/settings/app-settings.service';
import { ThemeMode, ThemeName, ThemeService } from '../../../../core/theme/theme.service';
import { WorkspaceDisplayPreferencesService } from '../../../../core/workspace/workspace-display-preferences.service';
import { WorkspaceService } from '../../../../core/workspace/workspace.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

type SettingsTab = 'carly' | 'accessibility' | 'general' | 'tools' | 'themes' | 'testdata';
type AccessibilityBooleanKey =
  'neuroMode' | 'reduceMotion' | 'reduceHover' | 'magnifier' | 'highContrast';
type GeneralBooleanKey = 'dynamicNewColumns' | 'tooltipsEnabled' | 'allowInvites';
type ToolBooleanKey = 'pomodoro' | 'taskTimer' | 'weather';
type CarlyBooleanKey = keyof CarlySettings;

interface SettingsTabOption {
  id: SettingsTab;
  label: string;
  icon: string;
  description: string;
}

interface ColorVisionOption {
  id: ColorVisionMode;
  label: string;
  description: string;
  icon: string;
}

interface AlarmOption {
  id: WorkspaceAlarmCategory;
  label: string;
  description: string;
  icon: string;
}

interface ThemeOption {
  id: ThemeName;
  label: string;
  description: string;
  colors: readonly [string, string, string];
}

@Component({
  selector: 'cm-settings-page',
  imports: [PageHeaderComponent],
  templateUrl: './settings-page.component.html',
  styleUrls: [
    './settings-page.component.scss',
    './settings-page.forms.scss',
    './settings-page.cards.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent {
  protected readonly carlyService: CarlyService;
  protected readonly settingsService: AppSettingsService;
  protected readonly themeService: ThemeService;
  protected readonly displayPreferences: WorkspaceDisplayPreferencesService;
  protected readonly demoDataService: DemoDataService;
  protected readonly activeTab = signal<SettingsTab>('carly');
  protected readonly statusMessage = signal('');
  protected readonly fadeLevels: readonly (15 | 35 | 55)[] = [15, 35, 55];

  /** Liefert die Anzahl der Aufgaben, die eine Deaktivierung der Neu-Spalten verhindern. */
  protected dynamicNewColumnTaskCount(): number {
    return this.workspaceService.getDynamicNewColumnTaskCount();
  }

  protected readonly tabs: readonly SettingsTabOption[] = [
    {
      id: 'carly',
      label: 'Carly',
      icon: 'pets',
      description: 'Maskottchen und Reaktionen',
    },
    {
      id: 'accessibility',
      label: 'Barrierefreiheit',
      icon: 'accessibility_new',
      description: 'Wahrnehmung, Fokus und Bedienung',
    },
    {
      id: 'general',
      label: 'Allgemein',
      icon: 'tune',
      description: 'Workspace, Hinweise und Privatsphäre',
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: 'construction',
      description: 'Produktivitätshelfer zuschalten',
    },
    {
      id: 'themes',
      label: 'Themes',
      icon: 'palette',
      description: 'Farbsets unabhängig vom Modus',
    },
    {
      id: 'testdata',
      label: 'Testdaten',
      icon: 'database',
      description: 'Demo-Workspace reproduzierbar zurücksetzen',
    },
  ];

  protected readonly colorVisionOptions: readonly ColorVisionOption[] = [
    {
      id: 'standard',
      label: 'Standard',
      description: 'Unveränderte semantische Farbpalette.',
      icon: 'visibility',
    },
    {
      id: 'protanopia',
      label: 'Rot-Schwäche',
      description: 'Rot-Grün-Signale werden durch Blau, Gold und Violett ersetzt.',
      icon: 'filter_1',
    },
    {
      id: 'deuteranopia',
      label: 'Grün-Schwäche',
      description: 'Statusfarben bleiben ohne Grün-Rot-Unterscheidung lesbar.',
      icon: 'filter_2',
    },
    {
      id: 'tritanopia',
      label: 'Blau-Gelb-Schwäche',
      description: 'Violett-, Rot- und Türkisabstufungen übernehmen die Signale.',
      icon: 'filter_3',
    },
    {
      id: 'monochrome',
      label: 'Schwarzweiß',
      description: 'Die Oberfläche wird vollständig in Graustufen dargestellt.',
      icon: 'monochrome_photos',
    },
  ];

  protected readonly alarmOptions: readonly AlarmOption[] = [
    {
      id: 'assignment',
      label: 'Zuweisungen',
      description: 'Neue, geänderte oder entfernte Verantwortlichkeiten.',
      icon: 'assignment_ind',
    },
    {
      id: 'taskMove',
      label: 'Aufgaben verschoben',
      description: 'Bewegungen zwischen Spalten und Boards.',
      icon: 'drive_file_move',
    },
    {
      id: 'taskCompleted',
      label: 'Aufgaben erledigt',
      description: 'Abschlüsse und erreichte Task-Ziele.',
      icon: 'task_alt',
    },
    {
      id: 'taskReopened',
      label: 'Aufgaben wieder geöffnet',
      description: 'Erledigte Aufgaben werden erneut aktiv.',
      icon: 'restart_alt',
    },
    {
      id: 'taskChanged',
      label: 'Taskdetails geändert',
      description: 'Titel, Termine, Kommentare, Anhänge und weitere Details.',
      icon: 'edit_note',
    },
    {
      id: 'taskDeleted',
      label: 'Aufgaben gelöscht',
      description: 'Dauerhaft entfernte Aufgaben.',
      icon: 'delete',
    },
    {
      id: 'projectCreated',
      label: 'Neue Projekte',
      description: 'Neu angelegte Projekte und Boards.',
      icon: 'create_new_folder',
    },
    {
      id: 'projectChanged',
      label: 'Projekte geändert',
      description: 'Projektinfos, Laufzeiten und Teams wurden bearbeitet.',
      icon: 'folder_copy',
    },
    {
      id: 'projectCompleted',
      label: 'Projekte abgeschlossen',
      description: 'Ein Projekt wurde erfolgreich beendet.',
      icon: 'verified',
    },
    {
      id: 'projectArchived',
      label: 'Projekte archiviert',
      description: 'Abgeschlossene Projekte wurden ins Archiv verschoben.',
      icon: 'archive',
    },
    {
      id: 'projectDeleted',
      label: 'Projekte gelöscht',
      description: 'Projekte wurden dauerhaft entfernt.',
      icon: 'folder_delete',
    },
    {
      id: 'members',
      label: 'Mitglieder und Einladungen',
      description: 'Beitritte, Rollen und Teamänderungen.',
      icon: 'group',
    },
    {
      id: 'directMessages',
      label: 'Direkt- und Gruppennachrichten',
      description: 'Neue Nachrichten und Chataktivitäten.',
      icon: 'forum',
    },
  ];

  protected readonly themeOptions: readonly ThemeOption[] = [
    {
      id: 'default',
      label: 'Default',
      description: 'Ruhige Business-UI mit mystischem Violett und warmem Gold.',
      colors: ['#7752b3', '#d5a646', '#f7f4fa'],
    },
    {
      id: 'neon',
      label: 'Neon',
      description: 'Mehrfarbig, digital und kontrastreich ohne dauerhafte Glitches.',
      colors: ['#d45cff', '#31f3da', '#0b0814'],
    },
    {
      id: 'retro',
      label: 'Retro',
      description: 'Gedämpfte 70er-/90er-Töne mit warmem Papiercharakter.',
      colors: ['#b74f37', '#2b7a78', '#f4ead6'],
    },
    {
      id: 'summer',
      label: 'Summer',
      description: 'Warme Creme- und Koralltöne mit einem klaren Türkisakzent.',
      colors: ['#ef6b4a', '#167f83', '#fff7e7'],
    },
    {
      id: 'nightsky',
      label: 'Nightsky',
      description: 'Überwiegend dunkel, ruhig und mit einem einzigen Cyanakzent.',
      colors: ['#56c8ef', '#17243a', '#070c18'],
    },
    {
      id: 'ocean',
      label: 'Ocean',
      description: 'Klare Blau-, Petrol- und Wasserflächen für ruhiges Arbeiten.',
      colors: ['#147d8f', '#3ea6d8', '#edf7f8'],
    },
    {
      id: 'lava',
      label: 'Lava',
      description: 'Dunkle Gesteinstöne mit kräftigem Orange und glühendem Gold.',
      colors: ['#ff6843', '#ffb23f', '#160b08'],
    },
  ];

  constructor(
    carlyService: CarlyService,
    settingsService: AppSettingsService,
    themeService: ThemeService,
    displayPreferences: WorkspaceDisplayPreferencesService,
    demoDataService: DemoDataService,
    private readonly workspaceService: WorkspaceService,
  ) {
    this.carlyService = carlyService;
    this.settingsService = settingsService;
    this.themeService = themeService;
    this.displayPreferences = displayPreferences;
    this.demoDataService = demoDataService;
  }

  /** Aktualisiert eine Carly-Einstellung. */
  protected setCarlySetting(key: CarlyBooleanKey, event: Event): void {
    this.carlyService.updateSettings({ [key]: this.readChecked(event) });
    this.showSavedState('Carly-Einstellung gespeichert.');
  }

  /** Aktiviert einen Einstellungsbereich. */
  protected selectTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }

  /** Aktiviert einen Farbenblindheits- oder Schwarzweißmodus. */
  protected setColorVision(mode: ColorVisionMode): void {
    this.settingsService.updateAccessibility({ colorVisionMode: mode });
    this.showSavedState('Farbwahrnehmung aktualisiert.');
  }

  /** Aktualisiert eine boolesche Barrierefreiheitseinstellung. */
  protected setAccessibilityBoolean(key: AccessibilityBooleanKey, event: Event): void {
    const enabled = this.readChecked(event);
    this.settingsService.updateAccessibility({ [key]: enabled });
    this.showSavedState('Barrierefreiheit aktualisiert.');
  }

  /** Setzt die globale Schriftstufe. */
  protected setFontSize(fontSize: AccessibilityFontSize): void {
    this.settingsService.updateAccessibility({ fontSize });
    this.showSavedState('Schriftgröße aktualisiert.');
  }

  /** Aktualisiert eine boolesche allgemeine Einstellung. */
  protected setGeneralBoolean(key: GeneralBooleanKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    const enabled = input.checked;

    if (key === 'dynamicNewColumns' && !enabled) {
      const taskCount = this.workspaceService.getDynamicNewColumnTaskCount();
      if (taskCount > 0) {
        input.checked = true;
        window.alert(
          `Die dynamische Neu-Spalte enthält noch ${taskCount} ${taskCount === 1 ? 'Aufgabe' : 'Aufgaben'}. Verschiebe oder bearbeite diese zuerst, bevor du die Spaltenlogik deaktivierst.`,
        );
        this.statusMessage.set('Die Neu-Spalten müssen vor dem Deaktivieren leer sein.');
        return;
      }
    }

    this.settingsService.updateGeneral({ [key]: enabled });

    if (key === 'dynamicNewColumns') {
      this.workspaceService.refreshIntakePreferences();
    }

    this.showSavedState('Allgemeine Einstellung gespeichert.');
  }

  /** Aktiviert oder deaktiviert das Verbergen des Klarnamens. */
  protected setHideRealName(event: Event): void {
    const enabled = this.readChecked(event);
    this.settingsService.updateGeneral({ hideRealName: enabled });
    this.workspaceService.applyCurrentMemberPrivacy();
    this.showSavedState('Privatsphäre aktualisiert.');
  }

  /** Speichert den lokalen Nickname und aktualisiert die Workspace-Anzeige. */
  protected setNickname(event: Event): void {
    const nickname = this.readText(event, 40);
    if (!nickname) {
      return;
    }

    this.settingsService.updateGeneral({ nickname });
    this.workspaceService.applyCurrentMemberPrivacy();
    this.showSavedState('Nickname gespeichert.');
  }

  /** Aktiviert oder deaktiviert eine Alarmkategorie. */
  protected setAlarm(category: WorkspaceAlarmCategory, event: Event): void {
    this.settingsService.setAlarm(category, this.readChecked(event));
    this.showSavedState('Benachrichtigungsauswahl gespeichert.');
  }

  /** Aktualisiert eine zuschaltbare Toolfunktion. */
  protected setTool(key: ToolBooleanKey, event: Event): void {
    this.settingsService.updateTools({ [key]: this.readChecked(event) });
    this.showSavedState('Toolauswahl gespeichert.');
  }

  /** Speichert den Ort für die spätere Wetter-API. */
  protected setWeatherLocation(event: Event): void {
    const weatherLocation = this.readText(event, 80);
    if (!weatherLocation) {
      return;
    }

    this.settingsService.updateTools({ weatherLocation });
    this.showSavedState('Wetterstandort gespeichert.');
  }

  /** Wählt ein semantisches Farbset aus. */
  protected setTheme(theme: ThemeName): void {
    this.themeService.setTheme(theme);
    this.showSavedState('Theme aktualisiert.');
  }

  /** Wählt den hellen oder dunklen Darstellungsmodus. */
  protected setThemeMode(mode: ThemeMode): void {
    this.themeService.setMode(mode);
    this.showSavedState('Darstellungsmodus aktualisiert.');
  }

  /** Aktiviert oder deaktiviert das Abblenden erledigter Aufgaben. */
  protected setCompletedTaskFade(event: Event): void {
    this.displayPreferences.setFadeCompletedTasks(this.readChecked(event));
    this.showSavedState('Taskdarstellung aktualisiert.');
  }

  /** Setzt die Abblendstärke erledigter Aufgaben. */
  protected setCompletedTaskFadeLevel(level: 15 | 35 | 55): void {
    this.displayPreferences.setCompletedTaskFadeLevel(level);
    this.showSavedState('Abblendstärke aktualisiert.');
  }

  /** Setzt alle App-Einstellungen auf den Ausgangszustand zurück. */
  protected resetSettings(): void {
    if (!window.confirm('Alle App-Einstellungen wirklich zurücksetzen?')) {
      return;
    }

    this.settingsService.reset();
    this.carlyService.reset();
    this.themeService.setTheme('default');
    this.themeService.setMode('light');
    this.displayPreferences.setFadeCompletedTasks(true);
    this.displayPreferences.setCompletedTaskFadeLevel(15);
    this.workspaceService.refreshIntakePreferences();
    this.workspaceService.applyCurrentMemberPrivacy();
    this.showSavedState('Alle Einstellungen wurden zurückgesetzt.');
  }

  /** Setzt den abgegrenzten Demo-Workspace nach ausdrücklicher Bestätigung zurück. */
  protected resetTestData(): void {
    const workspaceName = this.demoDataService.status().workspaceName;
    if (
      this.demoDataService.pending() ||
      !window.confirm(
        `Alle Änderungen im Demo-Workspace „${workspaceName}“ verwerfen und den definierten Ausgangsstand wiederherstellen?`,
      )
    ) {
      return;
    }

    this.statusMessage.set('Testdaten werden zurückgesetzt …');
    this.demoDataService
      .reset()
      .pipe(finalize(() => this.demoDataService.reloadStatus()))
      .subscribe({
        next: (result) => {
          this.workspaceService.reload();
          this.settingsService.reload();
          this.carlyService.reload();
          this.statusMessage.set(
            `${result.projects} Projekte und ${result.tasks} Aufgaben wurden wiederhergestellt.`,
          );
        },
        error: () => {
          this.statusMessage.set(
            'Die Testdaten konnten nicht zurückgesetzt werden. Prüfe Staff-Rechte und Backend-Konfiguration.',
          );
        },
      });
  }

  /** Liest den Zustand eines Checkbox- oder Switch-Inputs. */
  private readChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  /** Liest und begrenzt einen einzeiligen Texteingabewert. */
  private readText(event: Event, maxLength: number): string {
    return (event.target as HTMLInputElement).value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  /** Zeigt kurzzeitig eine nicht störende Speicherrückmeldung. */
  private showSavedState(message: string): void {
    this.statusMessage.set(message);
    window.setTimeout(() => {
      if (this.statusMessage() === message) {
        this.statusMessage.set('');
      }
    }, 2_000);
  }
}
