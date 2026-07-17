<p align="center">
  <img src="./public/assets/img/readme/hero.svg" alt="Carly Managed – kollaboratives Task- und Projektmanagement">
</p>

<p align="center">
  <a href="https://github.com/benjaminBennewitz/Carly-Managed_BE">
    <img src="./public/assets/img/readme/backend-repository.svg" alt="Backend-Repository von Carly Managed öffnen" width="520">
  </a>
</p>

## Eine Business-App mit einer freundlichen Fassade

**Carly Managed** ist eine responsive Angular-Web-App für kollaboratives Task- und Projektmanagement. Die Oberfläche verbindet eine fokussierte Business-UI mit dezenten mystischen, verspielten und Y2K-inspirierten Akzenten.

## Aktueller Entwicklungsstand

Das Frontend ist mit dem Django-Backend verbunden. Fachliche Workspace-Daten werden nicht mehr als Mock-Daten oder im Browser gespeichert, sondern über die versionierte REST-API in PostgreSQL persistiert.

### Angebundene Bereiche

- Session-basierte Registrierung, Anmeldung, Abmeldung und Sitzungswiederherstellung
- CSRF-geschützte Requests über den Angular-Entwicklungsproxy
- Workspaces, Mitglieder, Einladungen und Beitrittsanfragen
- Projekte, persönliche und projektbezogene Boards
- Spalten, Tasks, Unteraufgaben, Kommentare, Anhänge und Historie
- Rollen, Zuweisungen, Pool, Archiv und Projektstatus
- Wiederholungen und Automationen
- Inbox, Benachrichtigungen, Gespräche und Nachrichten
- App-, Barrierefreiheits- und Tool-Einstellungen
- Carly-Zustand und serverseitig begrenzte Aktionen
- Staff-geschützter Testdaten-Reset unter **Einstellungen → Testdaten**

Gerätebezogene Darstellungswerte wie Theme und Task-Abblendung bleiben bewusst lokal verfügbar. Sitzungsdaten werden ausschließlich über sichere Cookies verwaltet; Anmeldetokens liegen nicht im `localStorage`.

## Demo-Daten

Der Backend-Seed erzeugt einen reproduzierbaren Workspace mit:

- vier Projekten einschließlich Archivzuständen
- persönlichem und projektbezogenen Boards
- Spalten, Aufgaben und zugewiesenen Unteraufgaben
- Kommentaren, Verlauf, Wiederholungen und Automationen
- Mitgliedern, Einladungs- und Beitrittsdaten
- Inbox-Benachrichtigungen und einer Unterhaltung
- Einstellungen und Carly-Ausgangszustand

Der Reset-Button ist nur sichtbar, wenn das angemeldete Konto Staff-Rechte besitzt und der Backend-Reset ausdrücklich freigeschaltet ist. Andere Workspaces und Benutzerkonten bleiben erhalten.

## Technische Architektur

- Angular 21.2 mit Standalone Components
- TypeScript 5.9 und SCSS
- Signals und OnPush Change Detection
- Angular CDK
- zoneless Angular
- Vitest
- Django REST Framework über `/api/v1`
- Entwicklungsproxy für `/api`, `/ws` und `/media`
- HttpOnly-Session-Cookies und lesbares CSRF-Cookie
- PostgreSQL-Persistenz im Backend

## Lokale Entwicklung

Voraussetzungen:

- laufendes Django-Backend auf `http://localhost:8000`
- Node.js in einer mit Angular 21 kompatiblen Version
- npm `11.5.1`

Abhängigkeiten reproduzierbar installieren:

```cmd
npm ci
```

Entwicklungsserver mit Backend-Proxy starten:

```cmd
npm start
```

Die Anwendung läuft unter:

```text
http://localhost:4555
```

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

| Bereich  | Repository                                                                |
| -------- | ------------------------------------------------------------------------- |
| Frontend | Dieses Repository                                                         |
| Backend  | [Carly-Managed_BE](https://github.com/benjaminBennewitz/Carly-Managed_BE) |
