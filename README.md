<p align="center">
  <img src="./public/assets/img/carly-logo.webp" alt="Carly Managed Logo mit der stilisierten Katze Carly" width="180">
</p>

<h1 align="center">Carly Managed</h1>

<p align="center">
  Kollaboratives Task- und Projektmanagement mit ruhiger Business-UI und einer dezenten, motivierenden Carly-Ebene.
</p>

## Projektstatus

Carly Managed befindet sich im strukturierten Neuaufbau. Die Anwendung wird auf einer modernen Angular-Basis entwickelt. Bewährte Fachlogik aus einem bestehenden Task-Management-System wird schrittweise übernommen, technisch bereinigt und an das neue Designsystem angepasst.

Der aktuelle Stand umfasst:

- Angular 21.2.19
- Standalone Components
- SCSS
- Vitest
- zoneless Angular
- semantische Design-Tokens
- getrennten Light- und Dark-Mode
- vorbereitete Asset-Struktur
- CRLF als einheitliche Zeilenendung

## Technischer Stack

### Frontend

- Angular 21.2.19
- TypeScript
- SCSS
- Angular CDK
- Signals
- Vitest
- REST und WebSockets

### Geplantes Backend

- Django
- Django REST Framework
- PostgreSQL
- Django Channels
- Redis
- Daphne

## Designprinzipien

Carly Managed verbindet eine funktionale Business-Oberfläche mit wenigen sympathischen und leicht mystischen Akzenten.

Die Gestaltung folgt diesen Grundsätzen:

- Produktivität und Übersicht stehen im Vordergrund.
- Carly bleibt auf normalen Business-Routen dezent.
- Light- und Dark-Mode sind vom gewählten Farbthema getrennt.
- Komponenten verwenden ausschließlich semantische Design-Tokens.
- Animationen respektieren `prefers-reduced-motion`.
- Fokuszustände, Kontraste und Tastaturbedienung werden von Anfang an berücksichtigt.
- Weitere Farbwelten können ergänzt werden, ohne Komponenten neu zu gestalten.

## Default Light

| Verwendung | Token | Farbe |
|---|---|---|
| Seitenhintergrund | `--color-page-background` | `#F7F4FA` |
| Primäre Oberfläche | `--color-surface-primary` | `#FFFFFF` |
| Sekundäre Oberfläche | `--color-surface-secondary` | `#F0EAF6` |
| Erhöhte Oberfläche | `--color-surface-elevated` | `#FBF9FD` |
| Hover-Oberfläche | `--color-surface-hover` | `#EEE7F7` |
| Aktive Oberfläche | `--color-surface-active` | `#E5DAEF` |
| Primärer Text | `--color-text-primary` | `#241B2E` |
| Sekundärer Text | `--color-text-secondary` | `#665B70` |
| Dezenter Text | `--color-text-muted` | `#756A7E` |
| Deaktivierter Text | `--color-text-disabled` | `#8A8093` |
| Primäre Markenfarbe | `--color-action-primary` | `#7752B3` |
| Primäre Hoverfarbe | `--color-action-primary-hover` | `#64439D` |
| Primäre aktive Farbe | `--color-action-primary-active` | `#553584` |
| Helles Flieder | `--color-brand-soft` | `#C7B0E7` |
| Sehr helles Flieder | `--color-brand-subtle` | `#EEE7F7` |
| Komplementärfarbe | `--color-accent` | `#D5A646` |
| Helles Gold | `--color-accent-subtle` | `#F1D99B` |
| Dezenter Rahmen | `--color-border-subtle` | `#DED4E7` |
| Starker Rahmen | `--color-border-strong` | `#C5B5D2` |
| Fokusfarbe | `--color-focus` | `#7A5BC2` |
| Erfolg | `--color-success` | `#4F9572` |
| Warnung | `--color-warning` | `#C58939` |
| Fehler | `--color-danger` | `#B9546A` |
| Information | `--color-info` | `#4E82A8` |

## Default Dark

| Verwendung | Token | Farbe |
|---|---|---|
| Seitenhintergrund | `--color-page-background` | `#141019` |
| Primäre Oberfläche | `--color-surface-primary` | `#1D1724` |
| Sekundäre Oberfläche | `--color-surface-secondary` | `#292031` |
| Erhöhte Oberfläche | `--color-surface-elevated` | `#34283E` |
| Hover-Oberfläche | `--color-surface-hover` | `#31223F` |
| Aktive Oberfläche | `--color-surface-active` | `#3C2E49` |
| Primärer Text | `--color-text-primary` | `#F7F2FA` |
| Sekundärer Text | `--color-text-secondary` | `#C7BBCF` |
| Dezenter Text | `--color-text-muted` | `#91849B` |
| Deaktivierter Text | `--color-text-disabled` | `#756A7E` |
| Primäre Markenfarbe | `--color-action-primary` | `#A987DE` |
| Primäre Hoverfarbe | `--color-action-primary-hover` | `#B99AE8` |
| Primäre aktive Farbe | `--color-action-primary-active` | `#C8ADF0` |
| Helles Flieder | `--color-brand-soft` | `#7D64A1` |
| Dunkles Violett | `--color-brand-subtle` | `#31223F` |
| Komplementärfarbe | `--color-accent` | `#E4BE66` |
| Helles Gold | `--color-accent-subtle` | `#F2D993` |
| Dezenter Rahmen | `--color-border-subtle` | `#493A54` |
| Starker Rahmen | `--color-border-strong` | `#685673` |
| Fokusfarbe | `--color-focus` | `#B79AE6` |
| Erfolg | `--color-success` | `#71B28D` |
| Warnung | `--color-warning` | `#D9A659` |
| Fehler | `--color-danger` | `#D06D82` |
| Information | `--color-info` | `#72A5C7` |

## Semantische Farb-Tokens

Komponenten dürfen keine festen Theme-Farben enthalten. Stattdessen werden die vorhandenen semantischen Variablen verwendet:

```scss
.component {
  border: var(--border-width-subtle) solid var(--color-border-subtle);
  background: var(--color-surface-primary);
  color: var(--color-text-primary);
}

.component:hover {
  background: var(--color-surface-hover);
}
```

Wichtige Token-Gruppen:

```text
--color-page-background
--color-surface-primary
--color-surface-secondary
--color-surface-elevated
--color-surface-hover
--color-surface-active
--color-surface-disabled

--color-text-primary
--color-text-secondary
--color-text-muted
--color-text-disabled
--color-text-inverse

--color-border-subtle
--color-border-strong

--color-action-primary
--color-action-primary-hover
--color-action-primary-active
--color-action-primary-text
--color-action-secondary
--color-action-secondary-hover
--color-action-secondary-active
--color-action-secondary-text
--color-action-disabled
--color-action-disabled-text

--color-accent
--color-accent-subtle
--color-brand-soft
--color-brand-subtle

--color-focus
--color-success
--color-warning
--color-danger
--color-info

--color-icon-primary
--color-icon-secondary
--color-icon-muted
```

## Theme-Steuerung

Farbthema und Helligkeitsmodus werden getrennt am Root-Element gesetzt:

```html
<html lang="de" data-theme="default" data-mode="light">
```

Dark-Mode:

```html
<html lang="de" data-theme="default" data-mode="dark">
```

Spätere Themes können unabhängig vom Modus ergänzt werden:

```html
<html lang="de" data-theme="sky" data-mode="dark">
```

## Asset-Struktur

Statische Dateien liegen im öffentlichen Angular-Verzeichnis:

```text
public/
└── assets/
    ├── fonts/
    └── img/
        └── carly-logo.webp
```

Verwendung in Angular-Templates:

```html
<img
  src="/assets/img/carly-logo.webp"
  alt="Carly"
  width="180"
  height="180"
>
```

Lokale Icon- und Schriftdateien werden später unter `public/assets/fonts/` abgelegt. Schriftdateien selbst werden nicht über externe CDNs eingebunden.

## SCSS-Struktur

```text
src/
├── styles.scss
└── styles/
    ├── _index.scss
    ├── base/
    │   ├── _accessibility.scss
    │   ├── _global.scss
    │   └── _reset.scss
    └── settings/
        ├── _design-tokens.scss
        └── _themes.scss
```

Jede SCSS-Datei erhält den Carly-Managed-Projekt-Header mit Dateipfad, Version, Beschreibung und Inhaltsverzeichnis.

## Lokale Entwicklung

Abhängigkeiten installieren:

```cmd
npm install
```

Entwicklungsserver starten:

```cmd
npm start
```

Die Anwendung ist anschließend erreichbar unter:

```text
http://localhost:4200
```

Produktionsbuild prüfen:

```cmd
npm run build
```

Tests einmalig ausführen:

```cmd
npm test -- --run
```

## Git-Konvention

Die Historie wird schrittweise aufgebaut. Infrastruktur, Designsystem und Features werden in getrennten Commits umgesetzt.

Beispiele:

```text
build(fe): initialize Angular 21 application
chore: enforce CRLF line endings
feat(ui): add design system foundation
docs: add project and design system documentation
```
