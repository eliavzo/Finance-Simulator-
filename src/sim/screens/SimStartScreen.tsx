/** Front page — newspaper-style landing screen. */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { Button, Masthead, Rule } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';

export function SimStartScreen() {
  const newGame = useSimStore((s) => s.newGame);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Masthead title="Alpha & Carry" dateline="Die Finanz-Chronik · Gegründet im Jahr I · Preis 2 / 20" />

      <Text style={styles.headline}>Ein Fonds entsteht: Zwanzig Jahre an der Spitze der Hochfinanz</Text>
      <Text style={styles.standfirst}>
        Übernimm eine Fondsmanagement-Firma und führe sie Monat für Monat durch Konjunkturzyklen,
        Margin Calls und Panik an den Märkten. Baue ein Team, gewinne Kapitalgeber, handle ein
        Multi-Asset-Buch mit Hebel — und schreibe Geschichte.
      </Text>

      <Rule />
      <View style={styles.columns}>
        <Column items={[
          ['Das Haus', 'Analysten, Trader, Portfolio-Manager & Quants — mit Können, Moral und Gehalt.'],
          ['Der Fonds', 'Zwei Prozent Gebühr, zwanzig Prozent Carry über acht Prozent Hürde. Kapital von LPs.'],
        ]} />
        <Column items={[
          ['Die Märkte', 'Aktien, Anleihen, Devisen, Rohstoffe und Optionen — mit Zinskurve und Greeks.'],
          ['Das Risiko', 'Faktor-VaR, Stress-Szenarien und Drawdowns. Ein guter Ruf öffnet die Türen.'],
        ]} />
      </View>
      <Rule />

      <Button title="Erste Ausgabe drucken" onPress={() => newGame()} variant="primary" style={styles.cta} />
      <Text style={styles.disclaimer}>Sämtliche Märkte sind simuliert. Keine echten Daten, keine externen Dienste.</Text>
    </ScrollView>
  );
}

function Column({ items }: { items: [string, string][] }) {
  return (
    <View style={styles.col}>
      {items.map(([h, b]) => (
        <View key={h} style={styles.item}>
          <Text style={styles.itemHead}>{h}</Text>
          <Text style={styles.itemBody}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: spacing.lg, paddingTop: spacing.xl },
  headline: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: spacing.sm },
  standfirst: { color: colors.text, fontFamily: fonts.serif, fontSize: 15, lineHeight: 23, textAlign: 'center', marginVertical: spacing.md, fontStyle: 'italic' },
  columns: { flexDirection: 'row', gap: spacing.lg, marginVertical: spacing.md },
  col: { flex: 1, gap: spacing.md },
  item: {},
  itemHead: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 },
  itemBody: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 13, lineHeight: 19 },
  cta: { marginTop: spacing.lg },
  disclaimer: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
