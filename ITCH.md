# Auf itch.io veröffentlichen — Anleitung

Das Spiel ist ein einziges, sich selbst enthaltendes HTML-Dokument (JS + Fonts inline,
keine externen Dienste), daher ideal für itch.io.

## Build-Paket erzeugen

```bash
npx expo export --platform web
node scripts/build-single-html.mjs          # schreibt dist/alpha-and-carry.html
cp dist/alpha-and-carry.html standalone/index.html

mkdir -p itch-dist
cp standalone/index.html itch-dist/index.html
cd itch-dist && zip -j alpha-and-carry-itch.zip index.html
```

Wichtig: `index.html` muss im **Wurzelverzeichnis** der ZIP liegen (`zip -j` verwirft Pfade) —
itch.io sucht dort die Startdatei.

## Auf itch.io hochladen

1. Dashboard → **Create new project**.
2. **Kind of project:** `HTML`.
3. **Upload files:** `alpha-and-carry-itch.zip` hochladen, dann das Häkchen
   **„This file will be played in the browser"** setzen.
4. **Embed options:**
   - **Mobile friendly** aktivieren (das Spiel ist für Hochformat/Phone gebaut).
   - **Fullscreen button** aktivieren.
   - **Orientation:** Portrait. Viewport z. B. 480 × 854 (egal — füllt responsiv).
   - **Automatically start on page load**: an.
5. **Pricing:** „No payment" oder „Pay what you want" (Spende optional).
6. **Genre/Tags** (siehe unten) setzen, Cover-Bild (630 × 500) + ein paar Screenshots hochladen.
7. **Visibility** zunächst auf *Draft*/*Restricted*, testen, dann *Public*.

Hinweis: Das Spiel speichert Fortschritt im `localStorage` des Browsers. Im itch-iFrame
funktioniert das; im privaten Modus geht der Fortschritt beim Schließen verloren.

---

## Fertiger Seitentext

**Title:** Alpha & Carry

**Short description (Tagline):**
- EN: A deep monthly fund-management sim in a newspaper broadsheet style.
- DE: Eine tiefe, monatsweise Fonds-Management-Simulation im Zeitungs-Stil.

**Description (EN):**
> You run a fund-management firm across 20 years. Read the macro cycle, trade equities,
> bonds, FX, commodities and options, back startups, raise LP capital and live off fees
> and carry. Hire a team, upgrade infrastructure, hit LP mandates, survive crises and
> black swans — all rendered as a 19th-century financial broadsheet.
>
> - Deterministic, fully simulated markets — no real data, no servers, no tracking.
> - Composable difficulty with a "heat" score multiplier; harder modes unlock via renown.
> - Bilingual: English & German (switch in settings).
> - Plays in the browser, installable to your home screen.

**Description (DE):**
> Führe 20 Jahre lang ein Fonds-Management-Haus. Lies den Konjunkturzyklus, handle Aktien,
> Anleihen, Devisen, Rohstoffe und Optionen, finanziere Startups, wirb LP-Kapital ein und
> lebe von Gebühren und Carry. Stelle ein Team ein, rüste Infrastruktur auf, erfülle
> LP-Mandate, überstehe Krisen und Schwarze Schwäne — alles im Stil einer alten Finanz-Zeitung.
>
> - Deterministische, voll simulierte Märkte — keine echten Daten, keine Server, kein Tracking.
> - Kombinierbarer Schwierigkeitsgrad mit „Härtegrad"-Score-Multiplikator; harte Modi
>   werden über Renommee freigeschaltet.
> - Zweisprachig: Deutsch & Englisch (in den Einstellungen umschaltbar).
> - Läuft im Browser, auf dem Home-Bildschirm installierbar.

**How to play:** Tippe „Nächste Ausgabe", um einen Monat vorzurücken; zwischen den Tabs
(Übersicht / Markt / Firma / Fonds / Startups / Risiko) navigieren. Der Leitfaden im
Zahnrad-Menü erklärt alle Mechaniken.

**Suggested tags:** simulation, finance, economy, management, strategy, business, singleplayer,
incremental, text-based, mobile-friendly

**Genre:** Simulation
