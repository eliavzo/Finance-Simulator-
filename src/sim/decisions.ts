/**
 * Decision cards — narrative "Extrablatt" events that pause the game and make
 * the player choose, each with a trade-off. They are the main source of
 * run-to-run variety, so the pool is deliberately large and varied:
 *
 *  - many distinct templates across categories (talent, regulation, markets,
 *    scandal, opportunity, tech, world, founder), each with its own banner
 *    "kicker" so the presentation varies too;
 *  - rarity weights so mundane events are common and dramatic ones are rare;
 *  - a no-repeat window so the same card doesn't fire twice in quick succession;
 *  - varied effects beyond cash/reputation: free infrastructure, forced
 *    departures, volatility spikes, sentiment swings, fee changes, star hires,
 *    and risky gambles with a win/lose branch.
 */
import { DecisionCard, DecisionEffect, Employee, Regime, SimState } from './types';
import { exposures } from './portfolio';
import { createLP } from './fund';
import { fairSalary, MAX_TIER } from './firm';
import { g } from '../i18n/lang';
import { Rng } from '../engine/rng';

/* ------------------------------- Kickers --------------------------------- */
const K = {
  extra: () => g({ de: 'EXTRABLATT', en: 'SPECIAL EDITION' }),
  scandal: () => g({ de: 'SKANDAL', en: 'SCANDAL' }),
  chance: () => g({ de: 'CHANCE', en: 'OPPORTUNITY' }),
  warning: () => g({ de: 'WARNUNG', en: 'WARNING' }),
  law: () => g({ de: 'AUFSICHT', en: 'REGULATOR' }),
  people: () => g({ de: 'PERSONAL', en: 'PEOPLE' }),
  market: () => g({ de: 'MARKT', en: 'MARKETS' }),
  tech: () => g({ de: 'TECHNIK', en: 'TECH' }),
  world: () => g({ de: 'WELT', en: 'WORLD' }),
};

interface CardContext {
  reputation: number;
  firmCash: number;
  fundCash: number;
  hasEmployees: boolean;
  employeeCount: number;
  hasHighSkill: boolean;
  hasLowMorale: boolean;
  grossExposure: number;
  blackSwan: boolean;
  month: number;
  rivalName: string;
  regime: Regime;
  biggestSymbol: string;
  hasInfraRoom: boolean;
}

interface CardTemplate {
  id: string;
  /** Relative rarity weight (higher = more common). */
  weight: number;
  eligible: (c: CardContext) => boolean;
  build: (c: CardContext) => DecisionCard;
}

let cardCounter = 0;
const card = (id: string, kicker: string, title: string, body: string, choices: DecisionCard['choices']): DecisionCard => {
  cardCounter += 1;
  return { id: `${id}-${cardCounter}`, cardId: id, kicker, title, body, choices };
};

const TEMPLATES: CardTemplate[] = [
  /* --------------------------- Talent & people --------------------------- */
  {
    id: 'poach',
    weight: 3,
    eligible: (c) => c.hasHighSkill,
    build: () =>
      card('poach', K.people(), g({ de: 'Star-Analyst abgeworben', en: 'Star Analyst Poached' }),
        g({ de: 'Ein Rivale macht deinem besten Kopf ein lukratives Angebot. Hältst du dagegen?', en: 'A rival makes your best mind a lucrative offer. Do you fight to keep them?' }),
        [
          { label: g({ de: 'Gegenangebot machen', en: 'Make a counter-offer' }), description: g({ de: 'Kostet, hält aber das Team bei Laune.', en: 'Costs money, but keeps the team happy.' }), effect: { cash: -250_000, morale: 6, reputation: 1 } },
          { label: g({ de: 'Ziehen lassen', en: 'Let them go' }), description: g({ de: 'Spart Geld, drückt aber die Moral.', en: 'Saves money but dents morale.' }), effect: { morale: -8, reputation: -1 } },
        ]),
  },
  {
    id: 'burnout',
    weight: 3,
    eligible: (c) => c.hasLowMorale,
    build: () =>
      card('burnout', K.people(), g({ de: 'Burnout im Team', en: 'Burnout on the Team' }),
        g({ de: 'Eine Schlüsselperson ist ausgebrannt und droht auszufallen.', en: 'A key person is burnt out and at risk of dropping out.' }),
        [
          { label: g({ de: 'Sabbatical gewähren', en: 'Grant a sabbatical' }), description: g({ de: 'Kostet kurzfristig, rettet die Moral.', en: 'Costs in the short term, saves morale.' }), effect: { cash: -90_000, morale: 12 } },
          { label: g({ de: 'Durcharbeiten lassen', en: 'Push them through' }), description: g({ de: 'Spart Geld — verschärft das Problem.', en: 'Saves money — makes it worse.' }), effect: { morale: -10, reputation: -1 } },
        ]),
  },
  {
    id: 'talentwar',
    weight: 2,
    eligible: (c) => c.employeeCount >= 3,
    build: () =>
      card('talentwar', K.people(), g({ de: 'Vergütungs-Wettbieten', en: 'Comp Bidding War' }),
        g({ de: 'Die Konkurrenz zahlt Mondgehälter. Dein Team wird unruhig.', en: 'Rivals are paying moon salaries. Your team is getting restless.' }),
        [
          { label: g({ de: 'Gehälter erhöhen', en: 'Raise pay' }), description: g({ de: 'Teurer Apparat, aber zufriedenes Team.', en: 'Costlier payroll, but a happy team.' }), effect: { cash: -200_000, morale: 12 } },
          { label: g({ de: 'Linie halten', en: 'Hold the line' }), description: g({ de: 'Diszipliniert — aber die Stimmung kippt.', en: 'Disciplined — but morale slips.' }), effect: { morale: -9 } },
          { label: g({ de: 'Gewinnbeteiligung', en: 'Profit-share scheme' }), description: g({ de: 'Bindet das Team, kostet etwas Carry-Spielraum.', en: 'Binds the team, costs a little carry headroom.' }), effect: { feeRate: -0.001, morale: 8, reputation: 1 } },
        ]),
  },
  {
    id: 'poachstar',
    weight: 1,
    eligible: (c) => c.reputation > 55 && c.firmCash > 600_000,
    build: (c) =>
      card('poachstar', K.people(), g({ de: `Star bei ${c.rivalName} unzufrieden`, en: `Star at ${c.rivalName} Unhappy` }),
        g({ de: 'Ein hochkarätiger Kopf der Konkurrenz ist wechselwillig — gegen eine satte Antrittsprämie.', en: 'A top mind at a rival is open to moving — for a hefty signing bonus.' }),
        [
          { label: g({ de: 'Abwerben', en: 'Poach them' }), description: g({ de: 'Teuer, aber Elite-Skill fürs Team.', en: 'Expensive, but elite skill for the team.' }), effect: { cash: -500_000, hireStar: 'Analyst', reputation: 1 } },
          { label: g({ de: 'Zu teuer', en: 'Too expensive' }), description: g({ de: 'Das Budget bleibt verschont.', en: 'The budget is spared.' }), effect: {} },
        ]),
  },
  {
    id: 'quantgenius',
    weight: 1,
    eligible: (c) => c.firmCash > 800_000 && c.reputation > 45,
    build: () =>
      card('quantgenius', K.tech(), g({ de: 'Quant-Wunderkind', en: 'Quant Prodigy' }),
        g({ de: 'Ein legendärer Quant will dein Modell bauen — gegen ein fürstliches Paket.', en: 'A legendary quant wants to build your model — for a princely package.' }),
        [
          { label: g({ de: 'Einstellen', en: 'Hire them' }), description: g({ de: 'Teuer, aber ein Quant der Spitzenklasse.', en: 'Pricey, but a world-class quant.' }), effect: { cash: -650_000, hireStar: 'Quant', reputation: 2 } },
          { label: g({ de: 'Ablehnen', en: 'Pass' }), description: g({ de: 'Zu viel für ein Versprechen.', en: 'Too much for a promise.' }), effect: {} },
        ]),
  },
  {
    id: 'intern',
    weight: 2,
    eligible: () => true,
    build: () =>
      card('intern', K.people(), g({ de: 'Praktikant glänzt', en: 'Standout Intern' }),
        g({ de: 'Ein Praktikant liefert eine herausragende Analyse. Förderst du das Talent?', en: 'An intern delivers an outstanding piece of analysis. Do you nurture the talent?' }),
        [
          { label: g({ de: 'Übernehmen & schulen', en: 'Convert & train' }), description: g({ de: 'Kostet etwas, hebt die Moral und Sichtbarkeit.', en: 'Costs a little, lifts morale and visibility.' }), effect: { cash: -60_000, morale: 5, reputation: 1 } },
          { label: g({ de: 'Ziehen lassen', en: 'Let them move on' }), description: g({ de: 'Verpasste Chance.', en: 'A missed chance.' }), effect: { morale: -2 } },
        ]),
  },

  /* ----------------------------- Regulation ------------------------------ */
  {
    id: 'probe',
    weight: 3,
    eligible: () => true,
    build: () =>
      card('probe', K.law(), g({ de: 'Regulierungsprüfung', en: 'Regulatory Probe' }),
        g({ de: 'Die Aufsicht klopft an und verlangt Einblick in deine Bücher.', en: 'The regulator comes knocking and demands a look at your books.' }),
        [
          { label: g({ de: 'Voll kooperieren', en: 'Cooperate fully' }), description: g({ de: 'Anwaltskosten, aber sauberer Ruf.', en: 'Legal costs, but a clean reputation.' }), effect: { cash: -180_000, reputation: 2 } },
          { label: g({ de: 'Mauern', en: 'Stonewall' }), description: g({ de: 'Spart Geld — sieht aber schlecht aus.', en: 'Saves money — but looks bad.' }), effect: { reputation: -6 } },
        ]),
  },
  {
    id: 'lawsuit',
    weight: 2,
    eligible: (c) => c.month > 12,
    build: () =>
      card('lawsuit', K.law(), g({ de: 'Klage eines Ex-Mitarbeiters', en: 'Ex-Employee Lawsuit' }),
        g({ de: 'Ein entlassener Mitarbeiter klagt wegen unfairer Kündigung.', en: 'A dismissed employee is suing for wrongful termination.' }),
        [
          { label: g({ de: 'Vergleich zahlen', en: 'Settle quietly' }), description: g({ de: 'Teuer, aber die Sache ist vom Tisch.', en: 'Expensive, but it goes away.' }), effect: { cash: -300_000 } },
          { label: g({ de: 'Vor Gericht ziehen', en: 'Fight it in court' }), description: g({ de: 'Riskant: gewinnst du, glänzt dein Ruf — verlierst du, wird es teuer.', en: 'Risky: win and your name shines — lose and it gets costly.' }), effect: { gamble: { p: 0.5, win: { reputation: 3, cash: -50_000 }, lose: { cash: -550_000, reputation: -4 } } } },
        ]),
  },

  /* ------------------------------- Markets ------------------------------- */
  {
    id: 'activist',
    weight: 2,
    eligible: (c) => c.grossExposure > 5_000_000,
    build: (c) =>
      card('activist', K.market(), g({ de: 'Aktivisten-Kampagne', en: 'Activist Campaign' }),
        g({ de: `Ein bekannter Short-Seller veröffentlicht einen Bericht gegen ${c.biggestSymbol}.`, en: `A well-known short-seller publishes a report against ${c.biggestSymbol}.` }),
        [
          { label: g({ de: 'Öffentlich kontern', en: 'Counter publicly' }), description: g({ de: 'PR-Aufwand, verteidigt die Position.', en: 'PR effort, defends the position.' }), effect: { cash: -120_000, reputation: 1 } },
          { label: g({ de: 'Ignorieren', en: 'Ignore it' }), description: g({ de: 'Spart Mühe, kostet aber Vertrauen.', en: 'Saves effort but costs trust.' }), effect: { reputation: -3 } },
        ]),
  },
  {
    id: 'dip',
    weight: 2,
    eligible: (c) => c.blackSwan,
    build: () =>
      card('dip', K.market(), g({ de: 'Panik an den Märkten', en: 'Panic in the Markets' }),
        g({ de: 'Alles fällt. Dein Risk-Komitee streitet, ob man antizyklisch zukaufen soll.', en: 'Everything is falling. Your risk committee is split on whether to buy the dip.' }),
        [
          { label: g({ de: 'Mutig nachlegen', en: 'Buy boldly' }), description: g({ de: 'Antizyklischer Einstieg — Mut wird honoriert.', en: 'A contrarian entry — boldness is rewarded.' }), effect: { fundCash: 400_000, reputation: 3 } },
          { label: g({ de: 'Risiko rausnehmen', en: 'De-risk' }), description: g({ de: 'Sicherheit zuerst.', en: 'Safety first.' }), effect: { reputation: -1 } },
        ]),
  },
  {
    id: 'rivalshort',
    weight: 2,
    eligible: (c) => c.month > 12 && c.reputation > 40,
    build: (c) =>
      card('rivalshort', K.market(), g({ de: `Schieflage bei ${c.rivalName}`, en: `${c.rivalName} in Trouble` }),
        g({ de: 'Dein Desk sieht massive Risse im Buch eines Rivalen. Positionierst du dich öffentlich dagegen?', en: 'Your desk sees deep cracks in a rival’s book. Do you publicly position against them?' }),
        [
          { label: g({ de: 'Dagegen wetten', en: 'Bet against them' }), description: g({ de: 'Riskant: großer Gewinn, wenn der Desk recht hat — teuer, wenn nicht.', en: 'Risky: a big win if the desk is right — costly if not.' }), effect: { gamble: { p: 0.55, win: { fundCash: 1_200_000, reputation: 2 }, lose: { fundCash: -800_000, reputation: -1 } } } },
          { label: g({ de: 'Finger weg', en: 'Stay out' }), description: g({ de: 'Kein Risiko, keine Schlagzeile.', en: 'No risk, no headline.' }), effect: {} },
        ]),
  },
  {
    id: 'whale',
    weight: 2,
    eligible: (c) => c.fundCash > 2_000_000,
    build: () =>
      card('whale', K.market(), g({ de: 'Block-Angebot eines Wals', en: 'A Whale’s Block Offer' }),
        g({ de: 'Ein Großinvestor muss schnell ein Paket loswerden und bietet es dir abseits der Börse an.', en: 'A large investor must offload a block fast and offers it to you off-market.' }),
        [
          { label: g({ de: 'Zugreifen', en: 'Take it' }), description: g({ de: 'Mit Abschlag gekauft — wenn die Liquidität hält.', en: 'Bought at a discount — if the liquidity holds.' }), effect: { gamble: { p: 0.6, win: { fundCash: 1_000_000, reputation: 1 }, lose: { fundCash: -600_000 } } } },
          { label: g({ de: 'Ablehnen', en: 'Decline' }), description: g({ de: 'Kein Klumpenrisiko.', en: 'No concentration risk.' }), effect: {} },
        ]),
  },
  {
    id: 'glitch',
    weight: 1,
    eligible: (c) => c.fundCash > 500_000,
    build: () =>
      card('glitch', K.market(), g({ de: 'Börsen-Panne', en: 'Exchange Glitch' }),
        g({ de: 'Ein technischer Fehler stellt dir kurz fehlbepreiste Kurse. Ausnutzen oder melden?', en: 'A technical fault briefly shows you mispriced quotes. Exploit them, or report?' }),
        [
          { label: g({ de: 'Schnell ausnutzen', en: 'Exploit quickly' }), description: g({ de: 'Sofortgewinn — aber grenzwertig.', en: 'Instant profit — but borderline.' }), effect: { fundCash: 700_000, reputation: -4 } },
          { label: g({ de: 'Der Börse melden', en: 'Report to the exchange' }), description: g({ de: 'Integrität bringt eine kleine Belohnung.', en: 'Integrity earns a small bounty.' }), effect: { cash: 80_000, reputation: 3 } },
        ]),
  },

  /* ------------------------------- Scandal ------------------------------- */
  {
    id: 'tip',
    weight: 2,
    eligible: (c) => c.reputation > 30,
    build: () =>
      card('tip', K.scandal(), g({ de: 'Ein heißer Tipp', en: 'A Hot Tip' }),
        g({ de: 'Ein Kontakt flüstert dir nicht-öffentliche Informationen zu. Riecht nach Insiderhandel.', en: 'A contact whispers non-public information to you. It reeks of insider trading.' }),
        [
          { label: g({ de: 'Diskret nutzen', en: 'Use it discreetly' }), description: g({ de: 'Schneller Gewinn — hohes Risiko für den Ruf.', en: 'A quick profit — high risk to your reputation.' }), effect: { gamble: { p: 0.7, win: { fundCash: 900_000, reputation: -2 }, lose: { fundCash: 300_000, reputation: -12 } } } },
          { label: g({ de: 'Dankend ablehnen', en: 'Politely decline' }), description: g({ de: 'Integrität zahlt sich langfristig aus.', en: 'Integrity pays off in the long run.' }), effect: { reputation: 2 } },
        ]),
  },
  {
    id: 'bribe',
    weight: 1,
    eligible: (c) => c.reputation > 40,
    build: () =>
      card('bribe', K.scandal(), g({ de: 'Schmiergeld-Angebot', en: 'A Kickback Offer' }),
        g({ de: 'Ein Mittelsmann verspricht ein riesiges Staatsfonds-Commitment — gegen eine „Beraterprovision".', en: 'A fixer promises a huge sovereign commitment — in exchange for a "consulting fee".' }),
        [
          { label: g({ de: 'Zahlen', en: 'Pay it' }), description: g({ de: 'Großes Kapital — aber moralisch verseucht.', en: 'Big capital — but morally toxic.' }), effect: { cash: -150_000, committed: 25_000_000, reputation: -7 } },
          { label: g({ de: 'Empört ablehnen', en: 'Refuse, offended' }), description: g({ de: 'Sauber bleiben zahlt sich aus.', en: 'Staying clean pays off.' }), effect: { reputation: 3 } },
        ]),
  },
  {
    id: 'leak',
    weight: 1,
    eligible: (c) => c.employeeCount >= 2,
    build: () =>
      card('leak', K.scandal(), g({ de: 'Datenleck', en: 'Data Leak' }),
        g({ de: 'Ein Junior hat versehentlich eure Positionen geleakt. Die Presse fragt nach.', en: 'A junior accidentally leaked your positions. The press is asking questions.' }),
        [
          { label: g({ de: 'Verantwortlichen entlassen', en: 'Fire the culprit' }), description: g({ de: 'Hart, aber stellt Vertrauen wieder her.', en: 'Harsh, but restores trust.' }), effect: { loseEmployee: true, reputation: 2 } },
          { label: g({ de: 'Vertuschen', en: 'Cover it up' }), description: g({ de: 'Riskant — fliegt es auf, wird es übel.', en: 'Risky — if it surfaces, it gets ugly.' }), effect: { gamble: { p: 0.5, win: { reputation: 0 }, lose: { reputation: -9 } } } },
        ]),
  },
  {
    id: 'fraud',
    weight: 1,
    eligible: (c) => c.reputation > 50 && c.grossExposure > 4_000_000,
    build: (c) =>
      card('fraud', K.scandal(), g({ de: 'Bilanzbetrug entdeckt', en: 'Accounting Fraud Found' }),
        g({ de: `Dein Research findet manipulierte Zahlen bei ${c.biggestSymbol}. Was tust du mit dem Wissen?`, en: `Your research uncovers cooked books at ${c.biggestSymbol}. What do you do with the knowledge?` }),
        [
          { label: g({ de: 'Öffentlich aufdecken', en: 'Blow the whistle' }), description: g({ de: 'Kostet die Position, aber der Ruf glänzt.', en: 'Costs you the position, but your name shines.' }), effect: { fundCash: -300_000, reputation: 6 } },
          { label: g({ de: 'Leise aussteigen', en: 'Quietly exit' }), description: g({ de: 'Schaden begrenzt — Schweigen hat einen Preis.', en: 'Damage limited — silence has a price.' }), effect: { fundCash: -100_000, reputation: -3 } },
        ]),
  },

  /* ------------------------------ Tech / ops ----------------------------- */
  {
    id: 'cyber',
    weight: 2,
    eligible: (c) => c.hasEmployees,
    build: () =>
      card('cyber', K.tech(), g({ de: 'Ransomware-Angriff', en: 'Ransomware Attack' }),
        g({ de: 'Hacker verschlüsseln eure Systeme und fordern Lösegeld.', en: 'Hackers have encrypted your systems and demand a ransom.' }),
        [
          { label: g({ de: 'Lösegeld zahlen', en: 'Pay the ransom' }), description: g({ de: 'Schnell wieder online — aber teuer.', en: 'Back online fast — but costly.' }), effect: { cash: -220_000 } },
          { label: g({ de: 'Verweigern & wiederherstellen', en: 'Refuse & rebuild' }), description: g({ de: 'Riskant: gelingt die Wiederherstellung, glänzt ihr — sonst Datenverlust.', en: 'Risky: recover cleanly and you shine — otherwise data is lost.' }), effect: { gamble: { p: 0.55, win: { reputation: 2 }, lose: { loseEmployee: true, reputation: -3 } } } },
        ]),
  },
  {
    id: 'infragrant',
    weight: 1,
    eligible: (c) => c.hasInfraRoom,
    build: () =>
      card('infragrant', K.chance(), g({ de: 'Vendor-Pilotprogramm', en: 'Vendor Pilot Programme' }),
        g({ de: 'Ein Datenanbieter bietet ein kostenloses Upgrade an, um euch als Referenzkunden zu gewinnen.', en: 'A data vendor offers a free upgrade to win you as a flagship client.' }),
        [
          { label: g({ de: 'Pilotkunde werden', en: 'Become a pilot client' }), description: g({ de: 'Gratis-Upgrade der Marktdaten.', en: 'Free market-data tier upgrade.' }), effect: { infraGift: 'dataTier', reputation: 1 } },
          { label: g({ de: 'Unabhängig bleiben', en: 'Stay independent' }), description: g({ de: 'Keine Bindung an einen Anbieter.', en: 'No lock-in to a vendor.' }), effect: {} },
        ]),
  },
  {
    id: 'outage',
    weight: 2,
    eligible: (c) => c.hasEmployees,
    build: () =>
      card('outage', K.tech(), g({ de: 'Systemausfall', en: 'System Outage' }),
        g({ de: 'Mitten im Handelstag fällt euer Order-System aus.', en: 'Your order system goes down in the middle of the trading day.' }),
        [
          { label: g({ de: 'Notfall-Team einfliegen', en: 'Fly in an emergency team' }), description: g({ de: 'Teuer, aber schnell behoben.', en: 'Expensive, but fixed fast.' }), effect: { cash: -110_000, morale: 2 } },
          { label: g({ de: 'Intern durchwursteln', en: 'Muddle through internally' }), description: g({ de: 'Spart Geld, zermürbt aber das Team.', en: 'Saves money but grinds the team down.' }), effect: { morale: -7, reputation: -1 } },
        ]),
  },

  /* -------------------------------- World -------------------------------- */
  {
    id: 'raterumor',
    weight: 2,
    eligible: (c) => c.month > 6,
    build: () =>
      card('raterumor', K.warning(), g({ de: 'Zinsgerücht', en: 'Rate Rumour' }),
        g({ de: 'Gerüchte über eine überraschende Notenbank-Sitzung machen die Runde. Absichern?', en: 'Rumours of a surprise central-bank meeting are swirling. Hedge up?' }),
        [
          { label: g({ de: 'Schutz kaufen', en: 'Buy protection' }), description: g({ de: 'Kostet Prämie, dämpft aber die Nerven.', en: 'Costs a premium, but steadies nerves.' }), effect: { fundCash: -150_000, patience: 0.03 } },
          { label: g({ de: 'Ignorieren', en: 'Ignore it' }), description: g({ de: 'Stimmt das Gerücht, schießt die Vola hoch.', en: 'If the rumour is true, volatility spikes.' }), effect: { gamble: { p: 0.5, win: {}, lose: { volSpike: 10, sentiment: -0.15 } } } },
        ]),
  },
  {
    id: 'sanctions',
    weight: 1,
    eligible: (c) => c.month > 12,
    build: () =>
      card('sanctions', K.world(), g({ de: 'Geopolitischer Schock', en: 'Geopolitical Shock' }),
        g({ de: 'Über Nacht werden neue Sanktionen verhängt. Die Märkte sind nervös.', en: 'New sanctions land overnight. Markets are jittery.' }),
        [
          { label: g({ de: 'Defensiv umschichten', en: 'Reposition defensively' }), description: g({ de: 'Kostet Handelskosten, senkt aber das Risiko.', en: 'Costs trading expenses, lowers risk.' }), effect: { fundCash: -120_000, reputation: 1 } },
          { label: g({ de: 'Position halten', en: 'Hold the line' }), description: g({ de: 'Kein Aktionismus — aber die Stimmung dreht.', en: 'No knee-jerk moves — but sentiment turns.' }), effect: { sentiment: -0.1 } },
        ]),
  },
  {
    id: 'greenmandate',
    weight: 2,
    eligible: (c) => c.reputation > 45,
    build: () =>
      card('greenmandate', K.chance(), g({ de: 'ESG-Mandat angeboten', en: 'ESG Mandate Offered' }),
        g({ de: 'Ein grüner Pensionsfonds will ein nachhaltiges Sleeve — zu leicht reduzierten Gebühren.', en: 'A green pension wants a sustainable sleeve — at a slightly reduced fee.' }),
        [
          { label: g({ de: 'Mandat annehmen', en: 'Take the mandate' }), description: g({ de: 'Frisches Kapital, etwas weniger Fee.', en: 'Fresh capital, a little less fee.' }), effect: { committed: 18_000_000, feeRate: -0.0015, reputation: 2 } },
          { label: g({ de: 'Ablehnen', en: 'Decline' }), description: g({ de: 'Kein zusätzlicher Reporting-Aufwand.', en: 'No extra reporting burden.' }), effect: {} },
        ]),
  },

  /* ---------------------------- Opportunity ------------------------------ */
  {
    id: 'biglp',
    weight: 2,
    eligible: (c) => c.reputation > 55,
    build: () =>
      card('biglp', K.chance(), g({ de: 'Großer LP interessiert', en: 'Large LP Interested' }),
        g({ de: 'Ein Staatsfonds erwägt ein Commitment — will dich aber auf einer teuren Roadshow sehen.', en: 'A sovereign fund is weighing a commitment — but wants to see you on an expensive roadshow.' }),
        [
          { label: g({ de: 'Roadshow finanzieren', en: 'Fund the roadshow' }), description: g({ de: 'Teuer, bringt aber großes Kapital.', en: 'Expensive, but brings in big capital.' }), effect: { cash: -200_000, committed: 30_000_000, reputation: 2 } },
          { label: g({ de: 'Verzichten', en: 'Pass' }), description: g({ de: 'Kein Risiko, keine Belohnung.', en: 'No risk, no reward.' }), effect: {} },
        ]),
  },
  {
    id: 'media',
    weight: 3,
    eligible: (c) => c.reputation > 45,
    build: () =>
      card('media', K.chance(), g({ de: 'Medien-Porträt', en: 'Media Profile' }),
        g({ de: 'Ein Finanzmagazin will ein Porträt über dein Haus bringen.', en: 'A finance magazine wants to run a profile of your house.' }),
        [
          { label: g({ de: 'Interview geben', en: 'Give the interview' }), description: g({ de: 'Sichtbarkeit hebt den Ruf.', en: 'Visibility lifts your reputation.' }), effect: { reputation: 3 } },
          { label: g({ de: 'Presse meiden', en: 'Avoid the press' }), description: g({ de: 'Diskretion — keine Wirkung.', en: 'Discretion — no effect.' }), effect: {} },
        ]),
  },
  {
    id: 'award',
    weight: 1,
    eligible: (c) => c.reputation > 60,
    build: () =>
      card('award', K.chance(), g({ de: 'Branchenpreis', en: 'Industry Award' }),
        g({ de: 'Du bist für „Manager des Jahres" nominiert. Die Gala kostet — und die Bühne lockt.', en: 'You’re nominated for "Manager of the Year". The gala costs — and the stage beckons.' }),
        [
          { label: g({ de: 'Zur Gala gehen', en: 'Attend the gala' }), description: g({ de: 'Teuer, aber großer Reputations- & Kapitalschub.', en: 'Costly, but a big reputation & capital boost.' }), effect: { cash: -120_000, committed: 8_000_000, reputation: 5 } },
          { label: g({ de: 'Bescheiden absagen', en: 'Decline modestly' }), description: g({ de: 'Understatement wird honoriert.', en: 'Understatement is quietly rewarded.' }), effect: { reputation: 2 } },
        ]),
  },
  {
    id: 'mentor',
    weight: 1,
    eligible: (c) => c.reputation > 50,
    build: () =>
      card('mentor', K.chance(), g({ de: 'Vermächtnis eines Mentors', en: 'A Mentor’s Legacy' }),
        g({ de: 'Dein früherer Mentor zieht sich zurück und vertraut dir das Kapital seiner Familie an.', en: 'Your old mentor is retiring and entrusts you with his family’s capital.' }),
        [
          { label: g({ de: 'Dankend annehmen', en: 'Accept with gratitude' }), description: g({ de: 'Treues Langfrist-Kapital.', en: 'Loyal, long-term capital.' }), effect: { committed: 12_000_000, morale: 5, patience: 0.05 } },
          { label: g({ de: 'Höflich ablehnen', en: 'Politely decline' }), description: g({ de: 'Keine emotionalen Verpflichtungen.', en: 'No emotional obligations.' }), effect: {} },
        ]),
  },
  {
    id: 'bookdeal',
    weight: 1,
    eligible: (c) => c.reputation > 65,
    build: () =>
      card('bookdeal', K.chance(), g({ de: 'Buchvertrag', en: 'Book Deal' }),
        g({ de: 'Ein Verlag bietet dir einen Vorschuss für deine Memoiren. Schreiben kostet Zeit und Fokus.', en: 'A publisher offers an advance for your memoir. Writing it costs time and focus.' }),
        [
          { label: g({ de: 'Memoiren schreiben', en: 'Write the memoir' }), description: g({ de: 'Vorschuss & Ruhm — aber das Team trägt die Last.', en: 'Advance & fame — but the team carries the load.' }), effect: { cash: 250_000, reputation: 4, morale: -6 } },
          { label: g({ de: 'Fokussiert bleiben', en: 'Stay focused' }), description: g({ de: 'Das Geschäft zuerst.', en: 'Business first.' }), effect: { morale: 2 } },
        ]),
  },
  {
    id: 'philanthropy',
    weight: 2,
    eligible: (c) => c.firmCash > 500_000 && c.reputation > 40,
    build: () =>
      card('philanthropy', K.chance(), g({ de: 'Wohltätigkeits-Gala', en: 'Charity Gala' }),
        g({ de: 'Eine prominente Stiftung bittet um eine großzügige Spende.', en: 'A prominent foundation asks for a generous donation.' }),
        [
          { label: g({ de: 'Großzügig spenden', en: 'Donate generously' }), description: g({ de: 'Kostet — aber hebt Ruf und Moral spürbar.', en: 'Costs money — but markedly lifts reputation and morale.' }), effect: { cash: -200_000, reputation: 5, morale: 4 } },
          { label: g({ de: 'Symbolisch geben', en: 'Give a token sum' }), description: g({ de: 'Wirkt etwas knausrig.', en: 'Comes across a touch stingy.' }), effect: { cash: -20_000, reputation: -1 } },
        ]),
  },

  /* ------------------------------- Founder ------------------------------- */
  {
    id: 'health',
    weight: 2,
    eligible: (c) => c.month > 24,
    build: () =>
      card('health', K.people(), g({ de: 'Gesundheitlicher Warnschuss', en: 'A Health Scare' }),
        g({ de: 'Der Dauerstress fordert seinen Tribut. Dein Arzt rät dringend zu einer Pause.', en: 'The relentless stress is taking its toll. Your doctor strongly advises a break.' }),
        [
          { label: g({ de: 'Auszeit nehmen', en: 'Take time off' }), description: g({ de: 'Erholt das Team — kurzzeitig weniger Sichtbarkeit.', en: 'Restores the team — briefly less visibility.' }), effect: { morale: 8, reputation: -2 } },
          { label: g({ de: 'Weitermachen', en: 'Power through' }), description: g({ de: 'Riskant: hält die Schlagzahl — oder bricht zusammen.', en: 'Risky: keeps the pace — or burns out.' }), effect: { gamble: { p: 0.5, win: { reputation: 1 }, lose: { morale: -10, reputation: -2 } } } },
        ]),
  },
];

/** The dead-fund rescue card: an anchor backer offers a re-seed. */
function buildRescue(reputation: number): DecisionCard {
  if (reputation >= 25) {
    return card('reseed', K.chance(), g({ de: 'Rettungs-Re-Seed', en: 'Rescue Re-Seed' }),
      g({ de: 'Ein Anker-Investor bietet an, den toten Fonds neu zu verankern — gegen einen dauerhaften Gebührenrabatt.', en: 'An anchor investor offers to re-seed the dead fund — in exchange for a permanent fee discount.' }),
      [
        { label: g({ de: 'Re-Seed annehmen', en: 'Accept the re-seed' }), description: g({ de: '$10M Commitment, aber 0,5 Pkt. weniger Management-Fee.', en: '$10M commitment, but 0.5pts less management fee.' }), effect: { committed: 10_000_000, feeRate: -0.005, reputation: 1 } },
        { label: g({ de: 'Stolz ablehnen', en: 'Proudly decline' }), description: g({ de: 'Keine Bedingungen — und kein Kapital.', en: 'No strings — and no capital.' }), effect: {} },
      ]);
  }
  return card('ffround', K.chance(), g({ de: 'Friends & Family', en: 'Friends & Family' }),
    g({ de: 'Dein Ruf ist angeschlagen, aber das private Netzwerk würde dir noch einmal Startkapital anvertrauen.', en: 'Your standing is dented, but your private network would entrust you with seed capital once more.' }),
    [
      { label: g({ de: 'Annehmen', en: 'Accept' }), description: g({ de: '$4M Commitment — die letzte Chance, es zu beweisen.', en: '$4M commitment — the last chance to prove it.' }), effect: { committed: 4_000_000, morale: 4 } },
      { label: g({ de: 'Ablehnen', en: 'Decline' }), description: g({ de: 'Kein privates Geld aufs Spiel setzen.', en: 'Don’t put private money at risk.' }), effect: {} },
    ]);
}

/** Semi-annual LP meeting: negotiate expectations, fees and goodwill. */
export function buildLpMeeting(rng: Rng): DecisionCard {
  void rng;
  return card('lpmeeting', g({ de: 'LP-VERSAMMLUNG', en: 'LP MEETING' }), g({ de: 'LP-Versammlung', en: 'LP Meeting' }),
    g({ de: 'Die halbjährliche Versammlung deiner Investoren. Wie trittst du auf?', en: 'The semi-annual meeting of your investors. How do you present?' }),
    [
      { label: g({ de: 'Erwartungen dämpfen', en: 'Temper expectations' }), description: g({ de: 'Ehrlichkeit kauft Geduld, dämpft aber den Glanz.', en: 'Honesty buys patience but dims the shine.' }), effect: { patience: 0.08, reputation: -1 } },
      { label: g({ de: 'Große Versprechen', en: 'Big promises' }), description: g({ de: 'Hebt den Ruf — und die Fallhöhe.', en: 'Lifts your standing — and the height of the fall.' }), effect: { reputation: 2, patience: -0.06 } },
      { label: g({ de: 'Fee-Rabatt anbieten', en: 'Offer a fee discount' }), description: g({ de: '0,25 Pkt. weniger Fee, deutlich geduldigere LPs.', en: '0.25pts less fee, markedly more patient LPs.' }), effect: { feeRate: -0.0025, patience: 0.12 } },
    ]);
}

/** Possibly produce a decision card this month (≈14% base chance). */
export function maybeDecision(state: SimState, blackSwan: boolean, rng: Rng): DecisionCard | undefined {
  // While the fund is dead, rescue offers dominate the news cycle.
  if ((state.fundDeadMonths ?? 0) >= 2 && rng.chance(0.45)) return buildRescue(state.reputation);
  if (!rng.chance(blackSwan ? 0.6 : 0.14)) return undefined;

  const positions = state.portfolio.positions;
  let biggest = positions[0];
  for (const p of positions) {
    const inst = state.instruments.find((i) => i.id === p.instrumentId);
    const big = state.instruments.find((i) => i.id === biggest?.instrumentId);
    if (inst && (!big || Math.abs(p.quantity) * inst.price > Math.abs(biggest.quantity) * big.price)) biggest = p;
  }
  const infra = state.firm.infrastructure;
  const ctx: CardContext = {
    reputation: state.reputation,
    firmCash: state.firm.cash,
    fundCash: state.portfolio.cash,
    hasEmployees: state.firm.employees.length > 0,
    employeeCount: state.firm.employees.length,
    hasHighSkill: state.firm.employees.some((e) => e.skill >= 70),
    hasLowMorale: state.firm.employees.some((e) => e.morale < 55),
    grossExposure: exposures(state.portfolio, state.instruments).gross,
    blackSwan,
    month: state.month,
    rivalName: state.rivals.length > 0 ? rng.pick(state.rivals).name : 'Meridian Capital',
    regime: state.economy.regime,
    biggestSymbol: biggest?.symbol ?? g({ de: 'deine Top-Position', en: 'your top holding' }),
    hasInfraRoom: infra.dataTier < MAX_TIER || infra.quantTier < MAX_TIER || infra.primeBrokerTier < MAX_TIER || infra.officeTier < MAX_TIER,
  };

  // Exclude the last few fired templates so the news feels fresh.
  const recent = new Set(state.lastDecisionIds ?? []);
  let pool = TEMPLATES.filter((t) => t.eligible(ctx) && !recent.has(t.id));
  if (pool.length === 0) pool = TEMPLATES.filter((t) => t.eligible(ctx));
  if (pool.length === 0) return undefined;

  // Weighted pick by rarity.
  const total = pool.reduce((s, t) => s + t.weight, 0);
  let r = rng.range(0, total);
  let chosen = pool[0];
  for (const t of pool) {
    r -= t.weight;
    if (r <= 0) { chosen = t; break; }
  }
  return chosen.build(ctx);
}

/** Apply the chosen option of the pending decision and return a new state. */
export function applyDecision(state: SimState, choiceIndex: number, rng: Rng): SimState {
  const card = state.pendingDecision;
  if (!card) return state;
  const choice = card.choices[choiceIndex];
  if (!choice) return { ...state, pendingDecision: undefined };

  let firm = state.firm;
  let portfolio = state.portfolio;
  let fund = state.fund;
  let economy = state.economy;
  let reputation = state.reputation;
  let gambleNote: string | undefined;

  const applyEffect = (e: DecisionEffect) => {
    if (e.cash) firm = { ...firm, cash: firm.cash + e.cash };
    if (e.morale) {
      firm = { ...firm, employees: firm.employees.map((emp) => ({ ...emp, morale: Math.max(0, Math.min(100, emp.morale + e.morale!)) })) };
    }
    if (e.fundCash) portfolio = { ...portfolio, cash: portfolio.cash + e.fundCash };
    if (e.committed && e.committed > 0) {
      const lp = createLP('SovereignWealth', e.committed, rng);
      fund = { ...fund, committed: fund.committed + lp.committed, lps: [...fund.lps, lp] };
    }
    if (e.patience) {
      fund = { ...fund, lps: fund.lps.map((lp) => (lp.redeemed ? lp : { ...lp, patience: Math.max(0.2, Math.min(0.95, lp.patience + e.patience!)) })) };
    }
    if (e.feeRate) fund = { ...fund, mgmtFeeRate: Math.max(0.005, fund.mgmtFeeRate + e.feeRate) };
    if (e.hireStar) {
      cardCounter += 1;
      const star: Employee = {
        id: `star-${state.month}-${cardCounter}`,
        name: g({ de: 'Der Neuzugang', en: 'The New Signing' }),
        role: e.hireStar,
        skill: 85,
        salary: fairSalary(e.hireStar, 85) * 1.35,
        morale: 80,
        hiredMonth: state.month,
      };
      firm = { ...firm, employees: [...firm.employees, star] };
    }
    if (e.infraGift) {
      const cur = firm.infrastructure[e.infraGift];
      firm = { ...firm, infrastructure: { ...firm.infrastructure, [e.infraGift]: Math.min(MAX_TIER, cur + 1) } };
    }
    if (e.loseEmployee && firm.employees.length > 0) {
      const gone = rng.pick(firm.employees);
      firm = { ...firm, employees: firm.employees.filter((emp) => emp.id !== gone.id) };
    }
    if (e.volSpike) economy = { ...economy, volIndex: Math.max(5, economy.volIndex + e.volSpike) };
    if (e.sentiment) economy = { ...economy, sentiment: Math.max(-1, Math.min(1, economy.sentiment + e.sentiment)) };
    if (e.reputation) reputation = Math.max(0, Math.min(100, reputation + e.reputation));
    if (e.gamble) {
      const won = rng.chance(e.gamble.p);
      gambleNote = won ? g({ de: 'Die Wette ging auf.', en: 'The bet paid off.' }) : g({ de: 'Die Wette ging schief.', en: 'The bet went wrong.' });
      applyEffect(won ? e.gamble.win : e.gamble.lose);
    }
  };
  applyEffect(choice.effect);

  const lastDecisionIds = card.cardId ? [card.cardId, ...(state.lastDecisionIds ?? [])].slice(0, 5) : state.lastDecisionIds;

  return {
    ...state,
    firm,
    portfolio,
    fund,
    economy,
    reputation,
    pendingDecision: undefined,
    lastDecisionIds,
    events: [
      { id: `dec-res-${state.month}-${choiceIndex}-${cardCounter}`, month: state.month, type: 'firm' as const, title: card.title, description: g({ de: `Entscheidung: ${choice.label}.`, en: `Decision: ${choice.label}.` }) + (gambleNote ? ` ${gambleNote}` : '') },
      ...state.events,
    ].slice(0, 80),
  };
}
