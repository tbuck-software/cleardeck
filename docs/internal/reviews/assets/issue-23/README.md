# Beschäftigungsanzeige, Issue 23

Die Bilder stammen aus der echten Electron-Demo mit ausschließlich synthetischen Daten, aufgenommen am 11.09.2026 bei 1440 × 1000 CSS-Pixeln.

Vorher: `0a1ce1c`. Nachher: `54ae46c` und `23b5184`. Das Aufnahmeprofil enthielt zusätzlich den Pflegegrad-Fix aus `0e12f9c`; dieser verändert die hier geprüften Beschäftigungsansichten nicht.

Die synthetische Person Anna Beispiel hat aufeinanderfolgende Abschnitte seit 03.08.2022 und 24.07.2024. Vorher wurde 24.07.2024 als Eintritt gezeigt. Nachher zeigt die Liste 03.08.2022; die Detailansicht unterscheidet Beschäftigungsbeginn und Abschnittsbeginn. Die Historie behält das Eintrittsereignis mit einer eigenen Notiz. Ausgeschiedene Personen bleiben lesbar und erhalten eine dezente graue Zeile.

Unabhängiges Review ohne offene Codebefunde. Die anfangs fehlende Anpassung der Datumssortierung und ein zu weit gefasster Filter für Altnotizen wurden korrigiert und getestet. Abschließend bestanden 352 Tests in 61 Dateien, TypeScript und ESLint. Die Vorher-/Nachher-Bilder wurden visuell geprüft. Windows und Linux wurden für diese UI-Änderung nicht separat gestartet.

Start: `CLEARDECK_DEMO_DEBUG=1 npm run demo`, eigenes synthetisches Demo-Profil, Zugriff auf das echte Electron-Fenster über CDP.
