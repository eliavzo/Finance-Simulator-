/** Leitfaden — a reference manual, one section per system. Opened from settings. */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../sim/store';
import { Button, Rule } from './ui';
import { colors, fonts, spacing } from '../utils/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Der Kernablauf',
    body: 'Jeder Zug ist ein Monat. „Nächste Ausgabe ▸" rückt die Zeit vor; danach kommt der Monatsbericht. Dein Ziel: über 20 Jahre den Unternehmenswert (GP-Cash + Fonds-NAV + Beteiligungen) steigern und Reputation aufbauen.',
  },
  {
    title: 'Bewertung & Aktien',
    body: 'Aktien haben Gewinne (EPS), Wachstum und einen fairen Wert (aus Gewinn, Wachstum & Zinsen). Kurse kehren langfristig zum fairen Wert zurück. Kaufe unterbewertete Titel (Etikett „günstig"), verkaufe/shorte teure. Steigende Zinsen drücken besonders teure Wachstumsaktien.',
  },
  {
    title: 'Hebel, Risiko & Hedging',
    body: 'Hebel (1–5×, durch Stufe begrenzt) vervielfacht Gewinn UND Verlust und kostet Finanzierung. Fällt der Wert zu stark, gibt es einen Margin Call (Zwangsverkauf). Im Risiko-Tab siehst du VaR & Stress-Szenarien — und kannst vor Krisen eine Absicherung kaufen, die in Crashs auszahlt.',
  },
  {
    title: 'Makro & Sektoren',
    body: 'Die Wirtschaft durchläuft Expansion → Hochkonjunktur → Kontraktion → Rezession. Treiber sind nachvollziehbar: Zinsen↑ → Banken gut, lange Anleihen schlecht; Öl↑ → Energie gut; Wachstum → Tech/Konsum. Der Sektor-Ausblick im Markt-Tab zeigt Rücken-/Gegenwind.',
  },
  {
    title: 'Firma & Team',
    body: 'Stelle Personal ein (einmal pro Rolle und Monat; Niveau steigt mit Reputation) und rüste Infrastruktur auf. Fähigkeiten: Research (Alpha & Tipps), Execution (günstigere Finanzierung), Risk (weniger Margin Calls), Fundraising (mehr LP-Kapital). Überlastetes Team verliert Moral und kündigt.',
  },
  {
    title: 'Fonds, Gebühren & Mandate',
    body: 'Du verdienst 2 % Management-Fee und 20 % Carry über einer 8 %-Hürde. Rufe LP-Kapital ab („Capital Call") für Dry Powder. LPs vergeben Mandate (Ziele) — erfüllst du sie, gibt es Reputation & frisches Kapital; verfehlst du sie, kostet es Reputation.',
  },
  {
    title: 'Liquidität & Mittelabzüge',
    body: 'Nach einer Sperrfrist ziehen enttäuschte LPs Kapital ab — reicht dein Cash nicht, drohen Notverkäufe mit Verlust. Halte einen Cash-Puffer (siehe „Liquidität & Abzugsrisiko" im Fonds-Tab), besonders in Drawdowns.',
  },
  {
    title: 'Startups (Venture)',
    body: 'Investiere in junge Firmen für einen Anteil. Sie wachsen, verbrennen Cash und raisen neue Runden (du verwässerst, außer du ziehst pro-rata mit). „Operative Unterstützung" hebt Wachstum & Überlebenschance. Wenige werden Raketen (IPO/M&A-Exit), viele scheitern — das ist das Power-Law.',
  },
  {
    title: 'Konkurrenz & Rangliste',
    body: 'KI-Fonds handeln eigene Bücher und stehen mit dir in der Rangliste (12-Monats-Rendite). Schlägst du sie, steigt deine Reputation; hinkst du hinterher, sinkt sie.',
  },
  {
    title: 'Stufen & Auszeichnungen',
    body: 'Reputation bestimmt deine Stufe (Boutique → Aufstrebend → Etabliert → Titan) und schaltet höheren Hebel, Optionshandel, Top-Infrastruktur und bessere LP-Typen frei (bleibt freigeschaltet). Auszeichnungen sind Meilensteine zum Sammeln (über das Zahnrad einsehbar).',
  },
  {
    title: 'Ereignisse & Gelegenheiten',
    body: 'Manchmal erscheint ein „Extrablatt" (Entscheidung mit Trade-off) oder eine „Gelegenheit" (IPO-Zuteilung, Block-Trade, Private Placement, Aktivisten-Stake). Diese binden Kapital und lösen sich später zu einem Payoff auf.',
  },
];

export function ManualModal() {
  const show = useSimStore((s) => s.showManual);
  const close = useSimStore((s) => s.closeManual);
  if (!show) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.title}>Leitfaden</Text>
            <Text style={styles.dateline}>DAS HANDBUCH DES ALLOCATORS</Text>
            <Rule double />
            {SECTIONS.map((sec) => (
              <View key={sec.title} style={styles.section}>
                <Text style={styles.secTitle}>{sec.title}</Text>
                <Text style={styles.secBody}>{sec.body}</Text>
              </View>
            ))}
            <Button title="Schließen" variant="secondary" onPress={close} style={{ marginTop: spacing.md }} />
            <Text style={styles.colophon}>Alpha &amp; Carry · Die Finanz-Chronik</Text>
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
