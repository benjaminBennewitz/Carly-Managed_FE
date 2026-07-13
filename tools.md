## Server mit proxy conf starten
ng serve --port 4555 --proxy-config proxy.conf.json

## Optionale Analytics ausschalten
ng analytics disable --global

## Build auf VM
ng build --configuration production


## Doku
# tree.txt erstellen, Powershell Skript ausführen
# Powershell öffnen

powershell -NoProfile -ExecutionPolicy Bypass -File .\make-tree.ps1 -Depth 10 -Files -OutFile .\tree.txt