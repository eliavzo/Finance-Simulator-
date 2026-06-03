# Alpha & Carry 📈🚀

Ein mobiles **Finanzsimulator-Spiel** (Expo React Native + TypeScript). Du führst
ein **Family Office** mit **10 Mio. $** Startkapital über **20 Jahre** (jeder Zug =
1 Quartal) und steuerst parallel einen **Hedge Fund** und einen **VC-Fonds** durch
Konjunkturzyklen, Black-Swans und Margin Calls.

> Alles ist simuliert — keine echten Märkte, keine externen APIs.

## 🎮 Im Browser spielen

Bei jedem Push baut GitHub Actions einen statischen Web-Build und veröffentlicht
ihn auf GitHub Pages:

**→ https://eliavzo.github.io/finance-simulator-/**

(Funktioniert auch im Safari auf dem iPhone — einfach die URL öffnen.) Der
Build-Status steht unter dem Reiter **Actions**; die erste Veröffentlichung
dauert ein paar Minuten.

## Features

- **Hedge Fund:** Long/Short-Positionen mit Hebel (1–5x), Mark-to-Market,
  Drawdowns und automatische Margin Calls. Tracking von **Sharpe Ratio**,
  **Max Drawdown** und **VaR₉₅**.
- **VC-Fonds:** Investitionen von Seed bis Pre-IPO, **Cap Table**, Verwässerung,
  Folgerunden, Ausfälle und IPO/M&A-Exits. Tracking von **IRR**, **TVPI** und **MOIC**.
- **Makro-Engine:** Vier-Phasen-Konjunkturzyklus (Expansion → Peak → Kontraktion
  → Rezession), der beide Bereiche unterschiedlich beeinflusst.
- **Marktsimulation:** Aktienkurse folgen einer **geometrischen Brownschen
  Bewegung**; seltene **Black-Swan-Ereignisse** crashen die Märkte.
- **Synergie:** HF-Cash finanziert neue VC-Deals und umgekehrt.
- **Reputation (0–100):** schaltet besseren Deal-Flow und abrufbares **LP-Kapital** frei.
- **Persistenz:** Spielstände via AsyncStorage; deterministischer, seedbarer RNG.

## Architektur

```
src/
  models/types.ts        # Datenmodelle (GameState, Positionen, Startups …)
  engine/
    finance.ts           # IRR, NPV, VaR, Sharpe, Max Drawdown, TVPI, MOIC
    rng.ts               # deterministischer, persistierbarer PRNG (Box-Muller)
    market.ts            # GBM-Kurssimulation + Black-Swan
    macro.ts             # Konjunkturzyklus-Zustandsmaschine
    hedgefund.ts         # Positionen, Hebel, Margin Calls, NAV/Returns
    vc.ts                # Deal Flow, Startup-Entwicklung, Exits, IRR/TVPI
    reputation.ts        # Reputation & LP-Kapital
    metrics.ts           # abgeleitete Portfolio-Kennzahlen
    gameEngine.ts        # advanceQuarter-Orchestrierung
  store/gameStore.ts     # Zustand-Store + AsyncStorage-Persistenz
  components/            # UI-Primitives, SVG-LineChart, Controls
  screens/               # Dashboard, Hedge Fund, VC, Übersicht, Start
App.tsx                  # Navigation (Bottom Tabs) + Hydration
```

Die gesamte Spiellogik ist **rein und seiteneffektfrei** und in der `engine/`-Ebene
gekapselt; der Store verdrahtet nur Spieler-Aktionen mit Engine-Transitionen.

## Loslegen

```bash
npm install
npm start        # Expo Dev Server (QR-Code für Expo Go scannen)
npm run ios      # iOS-Simulator
npm run android  # Android-Emulator
npm run web      # im Browser
```

## Qualität

```bash
npm run typecheck   # tsc --noEmit
npm test            # Jest-Unit-Tests (Finanzmathematik + Engine)
```

Die Finanzberechnungen und die Spiel-Engine sind unit-getestet
(`src/engine/__tests__/`), inklusive Determinismus des RNG, IRR-Rückgewinnung
bekannter Raten, Margin-Call-Liquidation und Spielende-Logik.
