<!-- tools.md -->

# Carly Managed Frontend: Tools und Befehle

Alle Befehle werden in CMD ausgeführt.

## Installation

```cmd
cd /d "C:\Pfad\zu\Carly-Managed_FE"
npm ci
```

## Entwicklungsserver

Backend-Proxy und Port 4555 verwenden:

```cmd
npm start
```

Entspricht:

```cmd
npx ng serve --port 4555 --proxy-config proxy.conf.json
```

Frontend:

```text
http://localhost:4555
```

Backend:

```text
http://localhost:8000
```

## Build und Tests

```cmd
npm run build
npm run build -- --configuration development
npm test -- --watch=false
```

## Angular Analytics

```cmd
npx ng analytics disable --global
```

## Projektstruktur aktualisieren

Das PowerShell-Skript wird aus CMD aufgerufen:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File .\make-tree.ps1 -Depth 10 -Files -OutFile .\tree.txt
```

## Backend-Testdaten

Der Reset wird in der App unter **Einstellungen → Testdaten** ausgelöst. Backendseitig müssen Staff-Rechte und `DEMO_DATA_RESET_ENABLED=true` aktiv sein.

## Git

```cmd
git status
git log --oneline --decorate --graph
git push
```
