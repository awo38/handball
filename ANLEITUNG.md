# Handball-App online stellen (einmalig, ca. 10 Minuten)

Danach hat die App eine feste Adresse wie `https://DEINNAME.github.io/handball/`.
Die öffnest du auf jedem Handy, auch auf dem deiner Freundin. Die Statistik
(Torschützen, 7m, Strafen, Spielverlauf) aktualisiert sich dann von selbst:
stündlich und am Wochenende abends alle 20 Minuten. Alles kostenlos.

## 1. GitHub-Konto
Auf https://github.com kostenlos registrieren (falls noch nicht vorhanden).

## 2. Neues Repository anlegen
- Oben rechts **+ → New repository**
- Name: `handball`
- **Public** auswählen (für die kostenlose Webseite nötig)
- **Create repository**

## 3. Dateien hochladen
- Auf der neuen Seite: **uploading an existing file**
- Den **Inhalt** des entpackten Ordners `handball-app` hineinziehen
  (also `index.html`, `config.json`, `icon.png` und die Ordner `data`, `scripts`)
- **Commit changes**

Der Ordner `.github` ist auf dem Mac versteckt und wird beim Ziehen oft nicht
mitgenommen. Deshalb als eigener Schritt:
- **Add file → Create new file**
- Als Dateiname eintippen: `.github/workflows/update.yml`
- Den Inhalt der Datei `.github/workflows/update.yml` hineinkopieren → **Commit changes**

(Versteckte Dateien zeigst du im Finder mit `Cmd + Shift + .` an.)

## 4. Webseite einschalten
- Im Repository: **Settings → Pages**
- Bei **Source**: **GitHub Actions** auswählen

## 5. Erstes Update starten
- Reiter **Actions** → links **Statistik aktualisieren & veröffentlichen**
- **Run workflow** → **Run workflow**
- Nach ca. 1–2 Minuten ist alles grün. Die Adresse steht unter
  **Settings → Pages** (z. B. `https://DEINNAME.github.io/handball/`).

## 6. Aufs iPhone
- Adresse in **Safari** öffnen
- **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm**
- Fertig: Die App startet wie eine echte App mit eigenem Symbol.

Für deine Freundin: Link schicken (in der App unter Mannschaften → **App teilen**),
sie macht Schritt 6 auf ihrem Handy. Ihre Mannschaften und Farben speichert die App
auf ihrem Handy getrennt von deinen.

## Weitere Mannschaften
- In der App: Mannschafts-Symbol oben rechts → Link von handball4all einfügen.
  Ergebnisse, Tabelle und Live-Stand funktionieren damit sofort.
- Damit auch **Torschützen und Strafen** dieser Liga erscheinen, die Liga
  zusätzlich in `config.json` eintragen (auf GitHub die Datei öffnen → Stift-Symbol):

```json
{
  "leagues": [
    { "og": "216", "lId": "164116", "name": "Männer Bezirksliga Rhein-Neckar" },
    { "og": "216", "lId": "NEUE_LIGA_ID", "name": "z. B. Damen Landesliga" }
  ]
}
```
`og` und `lId` stehen im handball4all-Link (`ogId=…&lId=…`).

## Gut zu wissen
- Live-Ergebnisse kommen direkt von handball4all (alle 20 Sekunden während eines Spiels),
  sofern die Halle den Spielstand live meldet.
- Torschützen und Strafen kommen aus den offiziellen Spielberichten. Die gibt es erst,
  wenn der Bericht nach dem Spiel freigegeben ist, meist am selben Abend.
- Falls der Updater mal rot ist (z. B. handball4all nicht erreichbar), läuft er
  beim nächsten Mal einfach wieder. Die App zeigt solange den letzten Stand.
