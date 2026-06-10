/** Leitfaden — a reference manual, one section per system. Opened from settings. */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../sim/store';
import { useTr, Loc } from '../i18n';
import { Button, Rule } from './ui';
import { colors, fonts, spacing } from '../utils/theme';

const SECTIONS: { title: Loc; body: Loc }[] = [
  {
    title: { de: 'Der Kernablauf', en: 'The core loop' },
    body: {
      de: 'Jeder Zug ist ein Monat. „Nächste Ausgabe ▸" rückt die Zeit vor; danach kommt der Monatsbericht. Dein Ziel: über 20 Jahre den Unternehmenswert (GP-Cash + Fonds-NAV + Beteiligungen) steigern und Reputation aufbauen.',
      en: 'Each turn is a month. "Next edition ▸" advances time; afterwards the monthly report appears. Your goal: over 20 years, grow the enterprise value (GP cash + fund NAV + holdings) and build reputation.',
    },
  },
  {
    title: { de: 'Bewertung & Aktien', en: 'Valuation & equities' },
    body: {
      de: 'Aktien haben Gewinne (EPS), Wachstum und einen fairen Wert (aus Gewinn, Wachstum & Zinsen). Kurse kehren langfristig zum fairen Wert zurück. Kaufe unterbewertete Titel (Etikett „günstig"), verkaufe/shorte teure. Steigende Zinsen drücken besonders teure Wachstumsaktien.',
      en: 'Stocks have earnings (EPS), growth and a fair value (derived from earnings, growth & interest rates). Prices revert to fair value over the long run. Buy undervalued names (labelled "cheap"), sell/short expensive ones. Rising interest rates weigh especially on expensive growth stocks.',
    },
  },
  {
    title: { de: 'Hebel, Risiko & Hedging', en: 'Leverage, risk & hedging' },
    body: {
      de: 'Hebel (1–5×, durch Stufe begrenzt) vervielfacht Gewinn UND Verlust und kostet Finanzierung. Fällt der Wert zu stark, gibt es einen Margin Call (Zwangsverkauf). Im Risiko-Tab siehst du VaR & Stress-Szenarien — und kannst vor Krisen eine Absicherung kaufen, die in Crashs auszahlt.',
      en: 'Leverage (1–5×, capped by your tier) multiplies gains AND losses and costs financing. If your value falls too far, a margin call follows (forced liquidation). In the Risk tab you see VaR & stress scenarios — and you can buy a hedge before crises that pays off in crashes.',
    },
  },
  {
    title: { de: 'Makro & Sektoren', en: 'Macro & sectors' },
    body: {
      de: 'Die Wirtschaft durchläuft Expansion → Hochkonjunktur → Kontraktion → Rezession. Treiber sind nachvollziehbar: Zinsen↑ → Banken gut, lange Anleihen schlecht; Öl↑ → Energie gut; Wachstum → Tech/Konsum. Der Sektor-Ausblick im Markt-Tab zeigt Rücken-/Gegenwind.',
      en: 'The economy cycles through expansion → boom → contraction → recession. The drivers are intuitive: rates↑ → good for banks, bad for long bonds; oil↑ → good for energy; growth → tech/consumer. The sector outlook in the Markets tab shows tailwinds and headwinds.',
    },
  },
  {
    title: { de: 'Firma & Team', en: 'Firm & team' },
    body: {
      de: 'Stelle Personal ein (einmal pro Rolle und Monat; Niveau steigt mit Reputation) und rüste Infrastruktur auf. Fähigkeiten: Research (Alpha & Tipps), Execution (günstigere Finanzierung), Risk (weniger Margin Calls), Fundraising (mehr LP-Kapital). Überlastetes Team verliert Moral und kündigt.',
      en: 'Hire staff (once per role per month; their calibre rises with reputation) and upgrade infrastructure. Skills: Research (alpha & tips), Execution (cheaper financing), Risk (fewer margin calls), Fundraising (more LP capital). An overworked team loses morale and quits.',
    },
  },
  {
    title: { de: 'Fonds, Gebühren & Mandate', en: 'Fund, fees & mandates' },
    body: {
      de: 'Du verdienst 2 % Management-Fee und 20 % Carry über einer 8 %-Hürde. Rufe LP-Kapital ab („Capital Call") für Dry Powder. LPs vergeben Mandate (Ziele) — erfüllst du sie, gibt es Reputation & frisches Kapital; verfehlst du sie, kostet es Reputation.',
      en: 'You earn a 2% management fee and 20% carry above an 8% hurdle. Call LP capital (a "capital call") for dry powder. LPs hand out mandates (targets) — meet them and you gain reputation & fresh capital; miss them and it costs you reputation.',
    },
  },
  {
    title: { de: 'Liquidität & Mittelabzüge', en: 'Liquidity & redemptions' },
    body: {
      de: 'Nach einer Sperrfrist ziehen LPs Kapital ab, wenn deine rollierende 12-Monats-Rendite klar unter ihrer Erwartung liegt (Pension 8 %, Endowment 10 %, Family Office 12 %, FoF 13 %) oder du in einem tiefen Drawdown steckst. Wichtig: Abzüge kommen von Underperformance, NICHT von zu wenig Cash. Reines Cash bringt nur den Geldmarktzins (~Leitzins) und liegt damit meist unter den LP-Zielen — zu viel Cash führt also selbst zu Abzügen. Ein Puffer verhindert keine Abzüge; er verhindert nur Notverkaufs-Verluste, wenn doch abgezogen wird. Der Hebel zur Bindung der LPs ist Rendite über ihrem Ziel.',
      en: 'After a lock-up period, LPs pull their capital when your trailing 12-month return is clearly below their expectation (Pension 8%, Endowment 10%, Family Office 12%, FoF 13%) or you are in a deep drawdown. Important: redemptions come from underperformance, NOT from holding too little cash. Pure cash earns only the money-market (≈policy) rate, which usually sits below the LP targets — so holding too much cash itself triggers redemptions. A buffer does not prevent redemptions; it only prevents fire-sale losses when one does hit. The lever for retaining LPs is returns above their target.',
    },
  },
  {
    title: { de: 'Startups (Venture)', en: 'Startups (venture)' },
    body: {
      de: 'Investiere in junge Firmen für einen Anteil. Sie wachsen, verbrennen Cash und raisen neue Runden (du verwässerst, außer du ziehst pro-rata mit). „Operative Unterstützung" hebt Wachstum & Überlebenschance. Wenige werden Raketen (IPO/M&A-Exit), viele scheitern — das ist das Power-Law.',
      en: 'Invest in young companies for an equity stake. They grow, burn cash and raise new rounds (you get diluted unless you follow on pro-rata). "Operational support" boosts growth & survival odds. A few become rockets (IPO/M&A exit), many fail — that is the power law.',
    },
  },
  {
    title: { de: 'Konkurrenz & Rangliste', en: 'Competition & leaderboard' },
    body: {
      de: 'KI-Fonds handeln eigene Bücher und stehen mit dir in der Rangliste (12-Monats-Rendite). Schlägst du sie, steigt deine Reputation; hinkst du hinterher, sinkt sie.',
      en: 'AI funds trade their own books and rank against you on the leaderboard (12-month return). Beat them and your reputation rises; lag behind and it falls.',
    },
  },
  {
    title: { de: 'Stufen & Auszeichnungen', en: 'Tiers & awards' },
    body: {
      de: 'Reputation bestimmt deine Stufe (Boutique → Aufstrebend → Etabliert → Titan) und schaltet höheren Hebel, Optionshandel, Top-Infrastruktur und bessere LP-Typen frei (bleibt freigeschaltet). Auszeichnungen sind Meilensteine zum Sammeln (über das Zahnrad einsehbar).',
      en: 'Reputation determines your tier (Boutique → Rising → Established → Titan) and unlocks higher leverage, options trading, top-tier infrastructure and better LP types (which stay unlocked). Awards are milestones to collect (viewable via the gear).',
    },
  },
  {
    title: { de: 'Ereignisse & Gelegenheiten', en: 'Events & opportunities' },
    body: {
      de: 'Manchmal erscheint ein „Extrablatt" (Entscheidung mit Trade-off) oder eine „Gelegenheit" (IPO-Zuteilung, Block-Trade, Private Placement, Aktivisten-Stake). Diese binden Kapital und lösen sich später zu einem Payoff auf.',
      en: 'Sometimes a "special edition" appears (a decision with a trade-off) or an "opportunity" (IPO allocation, block trade, private placement, activist stake). These tie up capital and later resolve into a payoff.',
    },
  },
  {
    title: { de: 'Schwere Grade: warum man verliert', en: 'Difficulty: why you lose' },
    body: {
      de: 'Auf Hart/Brutal schwanken die Kurse stärker und weichen weiter vom fairen Wert ab. Das ist KEIN Nachteil deiner Bewertung — größere Abschläge = höhere erwartete Rendite. Du verlierst nicht, weil die These falsch ist, sondern weil du vor der Rückkehr rausgeworfen wirst: Das Überschießen erzeugt einen Drawdown → Margin Call oder LP-Mittelabzug → Notverkauf am Tief, genau bevor der Kurs zum fairen Wert zurückkehrt. Es ist ein Durchhalte-Problem, kein Analyse-Problem.',
      en: 'On Hard/Brutal, prices swing more violently and stray further from fair value. This is NOT a disadvantage for your valuation — bigger discounts = higher expected return. You do not lose because the thesis is wrong, but because you get shaken out before the reversion: the overshoot creates a drawdown → margin call or LP redemption → fire sale at the bottom, right before the price reverts to fair value. It is a staying-power problem, not an analysis problem.',
    },
  },
  {
    title: { de: 'Schwere Grade: die Strategie', en: 'Difficulty: the strategy' },
    body: {
      de: '1) Hebel radikal runter (Kern 1×, max 2×) — in Stress verschärft der Prime Broker zudem die Margin-Schwelle. 2) Tiefer kaufen (−15 bis −25 % zum Fair) und den Einstieg staffeln. 3) Breit streuen über Sektoren UND Anlageklassen — das mittelt das verstärkte idiosynkratische Rauschen weg. 4) Netto-Beta klein halten (Longs gegen Shorts / Tail-Hedge), um das Markt-Rauschen zu neutralisieren. 5) 25–35 % Cash-Puffer halten — das ist die eigentliche Halte-Fähigkeit: so musst du bei Mittelabzügen nicht am Tief verkaufen und kannst bis zur Rückkehr durchhalten. 6) Antizyklisch handeln: vor Krisen hedgen, im Crash mit dem Puffer nachkaufen (max. erwartete Rückkehr), in der Euphorie abbauen. 7) Früh Risk Manager & Quant einstellen (weniger Margin Calls, schärfere Signale). 8) Geduld — die Rückkehr ist eine Mehrmonats-Kraft; nicht hin- und herhandeln.',
      en: '1) Cut leverage radically (core 1×, max 2×) — under stress the prime broker also tightens the margin threshold. 2) Buy lower (−15 to −25% to fair) and scale into your entries. 3) Diversify broadly across sectors AND asset classes — this averages out the amplified idiosyncratic noise. 4) Keep net beta small (longs against shorts / tail hedge) to neutralise the market noise. 5) Hold a 25–35% cash buffer — this is the real staying power: so you do not have to sell at the bottom on redemptions and can hold on until the reversion. 6) Trade counter-cyclically: hedge before crises, buy more during the crash with your buffer (maximum expected reversion), trim into euphoria. 7) Hire a Risk Manager & Quant early (fewer margin calls, sharper signals). 8) Patience — the reversion is a multi-month force; do not trade back and forth.',
    },
  },
];

export function ManualModal() {
  const t = useTr();
  const show = useSimStore((s) => s.showManual);
  const close = useSimStore((s) => s.closeManual);
  if (!show) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.title}>{t({ de: 'Leitfaden', en: 'Guide' })}</Text>
            <Text style={styles.dateline}>{t({ de: 'DAS HANDBUCH DES ALLOCATORS', en: "THE ALLOCATOR'S HANDBOOK" })}</Text>
            <Rule double />
            {SECTIONS.map((sec) => (
              <View key={sec.title.de} style={styles.section}>
                <Text style={styles.secTitle}>{t(sec.title)}</Text>
                <Text style={styles.secBody}>{t(sec.body)}</Text>
              </View>
            ))}
            <Button title={t({ de: 'Schließen', en: 'Close' })} variant="secondary" onPress={close} style={{ marginTop: spacing.md }} />
            <Text style={styles.colophon}>{t({ de: 'Alpha & Carry · Die Finanz-Chronik', en: 'Alpha & Carry · The Financial Chronicle' })}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,10,0.6)', justifyContent: 'center', padding: spacing.md },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxHeight: '92%' },
  scroll: { padding: spacing.lg },
  title: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 30, textAlign: 'center', paddingVertical: 2 },
  dateline: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginBottom: spacing.xs },
  section: { marginTop: spacing.md },
  secTitle: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 14, letterSpacing: 0.5, marginBottom: 3 },
  secBody: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 13, lineHeight: 20 },
  colophon: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, textAlign: 'center', letterSpacing: 1, marginTop: spacing.md },
});
