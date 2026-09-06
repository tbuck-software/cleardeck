# Veröffentlichte Release Notes korrigieren

Eine reine Textkorrektur erhält Version, Tag und Installationspakete. Eine neue Version veröffentlichst du nur, wenn der Auftrag auch eine neue Auslieferung verlangt.

1. Ermittle den betroffenen Release und lade Beschreibung und Update-Dateien in ein temporäres Arbeitsverzeichnis. Sichere ihre Originale und erfasse Assetliste samt Prüfsummen. Lies den passenden Abschnitt in `CHANGELOG.md`.
2. Korrigiere dort die deutschen Stichpunkte nach dem Nutzerauftrag. Erzeuge daraus die GitHub-Beschreibung und die Notizen der betreffenden Version. Erhalte einen gegebenenfalls erforderlichen knappen Plattformhinweis.
3. Bearbeite in den betroffenen YAML-Dateien ausschließlich den Notiztext der Zielversion. Erhalte die übrige Historie sowie Versionen, Downloadziele, Größen, Hashes und alle weiteren Metadaten. Ein zurückbehaltener Kanal einer anderen Plattformversion bleibt unverändert, wenn die Korrektur ihn nicht betrifft.
4. Vergleiche die geparsten Metadaten vor dem Upload: Abweichungen dürfen ausschließlich die beauftragten Notizen betreffen. Alle Downloadreferenzen müssen weiterhin auf dieselben Dateien zeigen.
5. Aktualisiere die Beschreibung mit `gh release edit <Tag> --notes-file <Datei>`. Ersetze gezielt nur die geänderten YAML-Assets mit `gh release upload <Tag> <Dateien> --clobber`. Nutze CLI-Dateiargumente für mehrzeilige Texte. Das normale Veröffentlichungsskript schützt bestehende Releases vor Überschreiben; ändere diesen Schutz nicht für eine Notizkorrektur.
6. Lade Beschreibung und Metadaten erneut herunter. Bestätige den neuen Text in allen beauftragten Ausgaben, gleiche unveränderte Felder und übrige Assets mit dem Vorherzustand ab und prüfe den Release-/Updatezustand. Belege die Korrektur knapp im vorhandenen Release-Bericht und committe die Quelldateien.

Abgeschlossen ist die Korrektur, wenn Changelog, GitHub-Beschreibung und betroffene `releaseNotes` übereinstimmen und der Downloadstand unverändert nachgewiesen ist. Ein bloßes Ändern des GitHub-Textes aktualisiert die Anzeige in der App nicht.
