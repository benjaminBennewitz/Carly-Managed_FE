<p align="center">
  <img src="./public/assets/img/readme/hero.svg" alt="Carly Managed – kollaboratives Task- und Projektmanagement">
</p>

<p align="center">
  <a href="https://github.com/benjaminBennewitz/Carly-Managed_BE">
    <img src="./public/assets/img/readme/backend-repository.svg" alt="Backend-Repository von Carly Managed öffnen" width="520">
  </a>
</p>

## Eine Business-App mit einer freundlichen Fassade

**Carly Managed** ist eine moderne, responsive Web-App für kollaboratives Task- und Projektmanagement. Sie richtet sich vor allem an Freelancer, Creator, junge Selbstständige und kleine Teams.

Die Anwendung verbindet eine fokussierte Business-UI mit dezenten mystischen, verspielten und Y2K-inspirierten Akzenten. Produktivität, Übersichtlichkeit und Bedienbarkeit stehen dabei im Vordergrund. Das optionale Carly-Modul soll regelmäßiges Arbeiten motivierender gestalten, ohne wichtige Funktionen zu blockieren oder die Oberfläche zu dominieren.

<table>
  <tr>
    <td width="50%">
      <img src="./public/assets/img/readme/kpi-navigation.svg" alt="Sechs Kernbereiche">
    </td>
    <td width="50%">
      <img src="./public/assets/img/readme/kpi-views.svg" alt="Zwei Board-Ansichten">
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="./public/assets/img/readme/kpi-realtime.svg" alt="Geplante Live-Zusammenarbeit">
    </td>
    <td width="50%">
      <img src="./public/assets/img/readme/kpi-carly.svg" alt="Optionales Carly-Modul">
    </td>
  </tr>
</table>

## Aktueller Entwicklungsstand

Das Frontend ist bereits als umfangreiche lokale Produktvorschau nutzbar. Projekte, Boards, Aufgaben, Unteraufgaben, Regeln, Wiederholungen und weitere Workspace-Daten werden momentan im `localStorage` gespeichert.

Die spätere produktive Persistenz, Authentifizierung und Zusammenarbeit in Echtzeit werden über das separate Django-Backend umgesetzt.

### Bereits umgesetzt

#### App-Grundlage

- Angular-21.2-Frontend mit Standalone Components
- zoneless Angular, Signals und OnPush Change Detection
- lazy geladene Routen
- responsive App-Shell mit vollständig ausblendbarer Sidebar
- Light- und Dark-Mode mit animiertem Theme-Wechsel
- semantisches Designsystem für Farben, Typografie, Abstände, Zustände und Animationen
- lokale Schriftarten: Archivo, Bricolage Grotesque und Material Symbols
- animierte Routenwechsel
- Browser-Online-/Offline-Anzeige
- Impressum und Datenschutz
- lokale Login- und Registrierungsvorschau mit geschützten App-Routen

#### Navigation und Workspace

- Dashboard
- persönliches Board
- Projektübersicht und Projektboards
- Mitglieder
- Inbox-Grundroute
- Pool
- Archiv
- Carly-Grundroute
- Einstellungen-Grundroute
- Projekteinstellungen
- globale Suche mit gruppierten Ergebnissen
- Schnellaktionen für Tasks, Projekte, Einladungen und Nachrichten

#### Projekte

- Projekte erstellen, bearbeiten und anpinnen
- Name, Kurzlabel, Beschreibung, Laufzeit, Icon und Farbe verwalten
- Owner, Admins und Mitwirkende lokal zuordnen
- Abruf-Aufgaben aktivieren
- Projekte abschließen, archivieren und dauerhaft löschen
- Bestätigungsdialoge für kritische Aktionen
- abgeschlossene und archivierte Projekte im Archiv anzeigen

#### Boards und Spalten

- Kanban- und Listenansicht
- horizontal scrollbar angelegte Boards
- eigener vertikaler Scrollbereich je Spalte
- Spalten per Drag-and-drop verschieben
- Tasks innerhalb einer Spalte und zwischen Spalten verschieben
- Spalten erstellen, umbenennen, einfärben, sortieren und löschen
- Speicherung von Reihenfolge, Farben und Sortierung im `localStorage`
- dynamische Spalte „Neu“ für neu zugewiesene Aufgaben
- automatisches Entfernen leerer dynamischer Spalten

#### Tasks und Zusammenarbeit

- Tasks erstellen, bearbeiten, abschließen, wieder öffnen und löschen
- Titel, Beschreibung, Priorität, Startdatum und Enddatum
- verantwortliche Person und weitere Mitwirkende
- Labels, Kommentare, Anhänge-Metadaten und Verlauf
- Unteraufgaben mit eigener Zuweisung
- erledigte Tasks mit konfigurierbarer Abblendung
- Schreibschutz für abgeschlossene Tasks und Projekte
- Pool-Freigabe und Review-Hinweise für unzugewiesene Tasks
- eigene wiederverwendbare User-Select-Komponente
- Avatare mit Initialen und Farben
- `@`-Erwähnungen im Kommentartext
- Avatargruppen auf kollaborativ bearbeiteten Task-Karten
- persönliche Spiegelung zugewiesener Unteraufgaben
- Synchronisierung von Statusänderungen zwischen Unteraufgabe und Spiegelung
- History-Einträge bei Zuweisungen und Statusänderungen

#### Regeln und Wiederholungen

- visueller Regelbaukasten
- automatische Verschieberegeln mit Triggern, Bedingungen und Zielspalten
- Regeln erstellen, aktivieren, pausieren, bearbeiten und löschen
- Wiederholungen täglich, wöchentlich und monatlich konfigurieren
- Startdatum und Intervall verwalten
- aktive Regeln und Wiederholungen direkt im Board anzeigen
- lokale Speicherung aller Konfigurationen

### Teilweise umgesetzt

- Dashboard derzeit überwiegend als statische Designvorschau
- Mitgliederübersicht ohne vollständiges Workspace-Mitglieder-Management
- Pool-Darstellung ohne finalen Übernahme-, Zuweisungs- und Review-Workflow
- Inbox-Route ohne Darstellung gespeicherter Einladungen, Nachrichten und Erwähnungen
- Einstellungen-Route ohne vollständige Bedienoberfläche
- Carly-Route als vorbereitete Feature-Hülle
- Anhänge speichern derzeit nur Metadaten, keine Dateiinhalte
- Erwähnungen sind noch keine strukturierten Benachrichtigungen
- Wiederholungen besitzen noch keinen ausführenden Scheduler
- Rollen sind modelliert, schränken lokale Aktionen aber noch nicht technisch ein

### Noch offen

- produktive Benutzerregistrierung und Anmeldung über die API
- E-Mail-Verifizierung
- Cookie-basierte JWT-Authentifizierung
- PostgreSQL-Persistenz
- REST-CRUD für Projekte, Boards, Tasks, Mitglieder und Einladungen
- serverseitiges Rollen- und Berechtigungssystem
- echter Einladungsworkflow
- echte Datei-Uploads
- serverseitige Kommentare und History
- vollständige Inbox und Benachrichtigungen
- serverseitige Wiederholungen und Automationen
- WebSocket-Präsenz und Live-Cursor
- Echtzeit-Taskbewegungen und Board-Aktivitäten
- Bearbeitungshinweise, Versionierung und Konfliktkontrolle
- vollständiger Pool-Workflow
- Archiv-Wiederherstellung
- dynamisches Dashboard
- Carly-Mascot-, Motivations- und Teamfunktionen
- Einstellungen für Abblendung, Kontrast, Schriftgröße und reduzierte Animationen
- zusätzliche Tests für komplexe UI- und Kollaborationsfälle

## Hauptnavigation

| Bereich | Aktueller Zweck |
|---|---|
| Dashboard | Persönlicher Einstieg und vorbereitete Übersicht |
| Board | Persönliches Kanban- oder Listenboard |
| Projekte | Projektübersicht, Projektboards und Projekteinstellungen |
| Mitglieder | Lokale Übersicht über Personen, Rollen und Anwesenheitsvorschau |
| Inbox | Vorbereiteter Bereich für Einladungen, Erwähnungen und Aktivitäten |
| Pool | Noch nicht fest zugewiesene Aufgaben und Review-Hinweise |
| Archiv | Abgeschlossene Tasks sowie abgeschlossene und archivierte Projekte |
| Carly | Vorbereiteter Motivations- und Fortschrittsbereich |
| Einstellungen | Vorbereiteter Bereich für Darstellung, Barrierefreiheit und App-Verhalten |

## Geplante Zusammenarbeit in Echtzeit

Dauerhafte Ressourcen wie Projekte, Boards, Tasks, Mitglieder und Einladungen werden künftig über eine REST-API verwaltet. Flüchtige Informationen werden ausschließlich über WebSockets übertragen.

Dazu gehören:

- Online-Präsenz auf Boards
- Live-Mauszeiger eingeladener Personen
- sichtbare Board- und Task-Aktivitäten
- Bearbeitungshinweise
- Echtzeit-Taskbewegungen
- kontrollierte parallele Änderungen
- Versionsprüfung gegen unbemerktes Überschreiben
- kooperative Carly-Aktionen

## Carly

Carly ist eine stilisierte magische Katze und ein vollständig optionales Motivationsmodul.

<p align="center">
  <img src="./public/assets/img/carly.webp" alt="Carly, die stilisierte magische Katze" width="280">
</p>

Carly soll auf abgeschlossene Aufgaben, Inaktivität, überfällige Tasks und gemeinsame Erfolge reagieren. Im eigenen Bereich sind Stimmung, Zuneigung, Streaks, Trophäen, Statistiken, Anpassungen und Entwicklungsstufen vorgesehen.

Optional kann Carly kleine Aufgaben wie Pausen oder kurze Interaktionen vorschlagen. Diese Aufgaben dürfen reguläre Arbeit weder blockieren noch verdrängen. Tageslimits, Cooldowns und serverseitige Prüfungen sollen Task-Spam verhindern.

## Barrierefreiheit

Barrierefreiheit ist Bestandteil der Produktarchitektur und keine spätere Ergänzung.

Bereits berücksichtigt beziehungsweise vorgesehen sind:

- vollständige Tastaturbedienung
- sichtbare Fokuszustände
- verständliche ARIA-Beschriftungen
- ausreichende Farbkontraste
- klar erkennbare Fehlerzustände
- ausreichend große Klickflächen
- Unterstützung von `prefers-reduced-motion`
- optional reduzierte Animationen
- optional stärkerer Kontrast
- optional größere Schrift

## Technische Architektur

### Frontend

- Angular 21.2
- Standalone Components
- TypeScript 5.9
- SCSS
- Signals
- Angular CDK
- Vitest
- zoneless Angular
- OnPush Change Detection
- Lazy Loading
- lokale Fonts und Material Symbols
- lokale Demo-Persistenz über `localStorage`

### Geplantes Backend

- Django
- Django REST Framework
- PostgreSQL
- Django Channels
- Redis
- Daphne
- Celery für zeitgesteuerte Prozesse und Automatisierungen

[Backend-Repository öffnen](https://github.com/benjaminBennewitz/Carly-Managed_BE)

## Lokale Entwicklung

Voraussetzungen:

- Node.js in einer mit Angular 21 kompatiblen Version
- npm `11.5.1`

Abhängigkeiten reproduzierbar installieren:

```cmd
npm ci
```

Entwicklungsserver starten:

```cmd
npm start
```

Die Anwendung ist anschließend standardmäßig unter `http://localhost:4200` erreichbar.

Produktionsbuild prüfen:

```cmd
npm run build
```

Tests einmalig ausführen:

```cmd
npm test -- --watch=false
```

## Code-Konventionen

- Clean Code, KISS und DRY
- deutsche JSDoc-Dokumentation für TypeScript
- SCSS-Projekt-Header mit Inhaltsverzeichnis
- Pfadkommentar als erste Zeile neuer Quellcodedateien
- CRLF-Zeilenenden für Text-, Konfigurations- und Codedateien
- einzeilige Imports
- semantische Design-Tokens statt komponentenspezifischer Farbwerte

## Repositories

| Bereich | Repository |
|---|---|
| Frontend | Dieses Repository |
| Backend | [Carly-Managed_BE](https://github.com/benjaminBennewitz/Carly-Managed_BE) |
