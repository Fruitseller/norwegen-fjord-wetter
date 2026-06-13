# ⛴️ Norwegens Fjorde – Wetter zur Reise

Eine kleine, hübsche Übersichtsseite zur **Mein Schiff 3**-Reise *„Norwegens
Fjorde"* (Reise 4476611, 21.–28. Juni 2026). Sie zeigt die komplette Route auf
einer Karte und für **jeden Hafen den aktuellen Wetterbericht** – damit auf
einen Blick klar ist, **wann welches Wetter** ist.

## 🌍 Live-Seite

**👉 https://fruitseller.github.io/norwegen-fjord-wetter/**

> Hinweis: Die Seite ist erst nach dem ersten erfolgreichen Deployment
> erreichbar (siehe [Einrichtung](#einrichtung)).

## ✨ Funktionen

- **Wochenüberblick** – alle 8 Tage als Wetterstreifen, farblich nach
  Wetterlage codiert (Sonne, Wolken, Regen, …) für schnelle Erkennbarkeit.
- **Interaktive Karte** (Leaflet + OpenStreetMap) mit der Reiseroute und einem
  Marker je Hafen, der direkt Symbol und Temperatur anzeigt.
- **Tag-für-Tag-Detailkarten** mit Liegezeiten (Ankunft / Alle an Bord /
  Abfahrt), Höchst-/Tiefsttemperatur, Regenwahrscheinlichkeit, Wind,
  Niederschlag, einer **Stundenvorhersage für die Zeit im Hafen** sowie den
  Hafeninfos (Sprache, Währung, Zeitzone).
- **Immer aktuell**: Das Wetter wird bei jedem Seitenaufruf live geladen.

## 🌦️ Wetterdaten

Die Vorhersage stammt von **[Open-Meteo](https://open-meteo.com/)**:

- kostenlos und **ohne API-Key** – ideal für eine rein statische Seite,
- CORS-fähig, daher direkt aus dem Browser abrufbar,
- liefert WMO-Wettercodes, Temperatur, Niederschlag, Wind u. v. m.,
- Vorhersage für bis zu 16 Tage.

Es wird **eine einzige** Multi-Standort-Anfrage über den gesamten Reisezeitraum
gestellt. Liegt das Reisedatum außerhalb des 16-Tage-Vorhersagefensters, zeigt
die jeweilige Karte „Keine Vorhersage verfügbar".

Daten © Open-Meteo (CC BY 4.0) · Karte © OpenStreetMap-Mitwirkende.

## 🗂️ Aufbau

| Datei         | Inhalt                                                        |
| ------------- | ------------------------------------------------------------- |
| `index.html`  | Seitengerüst                                                  |
| `styles.css`  | Gestaltung (maritimes Theme, responsiv)                       |
| `data.js`     | Reisedaten: Häfen, Zeiten, Koordinaten, Beschreibungen        |
| `app.js`      | Wetterabruf (Open-Meteo), Karte (Leaflet) und Darstellung     |

Reine statische Seite – kein Build-Schritt, keine Abhängigkeiten zum Installieren.

## 🚀 Einrichtung

Das automatische Deployment erfolgt per GitHub Actions
(`.github/workflows/deploy.yml`) bei jedem Push auf `main`. Einmalig muss
GitHub Pages auf den Actions-Modus gestellt werden:

1. **Settings → Pages → Build and deployment → Source: „GitHub Actions"**.
2. Anschließend deployt jeder Push auf `main` automatisch die Seite.

## 🧪 Lokal testen

```bash
python3 -m http.server 8000
# danach http://localhost:8000 öffnen
```

## 📄 Lizenz

[BSD Zero Clause License (0BSD)](./LICENSE).

---

*Private, inoffizielle Seite. Keine offizielle Seite von TUI Cruises / Mein
Schiff. Reisezeiten gemäß Reiseplan, ohne Gewähr.*
