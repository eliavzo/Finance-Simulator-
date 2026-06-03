/** v2 landing screen. */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { Button } from '../../components/ui';
import { colors, spacing } from '../../utils/theme';

export function SimStartScreen() {
  const newGame = useSimStore((s) => s.newGame);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.kicker}>FUND MANAGEMENT SIM</Text>
      <Text style={styles.title}>Alpha & Carry</Text>
      <Text style={styles.subtitle}>
        Führe eine Fondsmanagement-Firma über 20 Jahre (monatliche Züge). Baue ein Team auf, raise LP-Kapital,
        handle Aktien, Anleihen, FX, Rohstoffe & Optionen mit Hebel – und überlebe Konjunkturzyklen, Margin Calls
        und Black Swans.
      </Text>

      <View style={styles.bullets}>
        <Bullet text="🏢 Firma: Analysten, Trader, PMs, Quants – Skills, Moral, Infrastruktur" />
        <Bullet text="💼 Fonds: 2% Fee · 20% Carry über 8% Hurdle · LP-Kapital, Capital Calls" />
        <Bullet text="📊 Instrumente: Aktien, Anleihen (Zinskurve), FX, Rohstoffe, Optionen (Greeks)" />
        <Bullet text="⚠️ Risiko: Faktor-VaR, Stress-Tests, Drawdowns" />
        <Bullet text="📑 Echte GuV & Bilanz, IRR/TVPI/DPI, Reputation" />
      </View>

      <Button title="Neues Spiel starten" onPress={() => newGame()} variant="primary" style={styles.cta} />
      <Text style={styles.disclaimer}>Alles simuliert. Keine echten Märkte, keine externen APIs.</Text>
    </ScrollView>
  );
}

function Bullet({ text }: { text: string }) {
  return <Text style={styles.bullet}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: spacing.xl, paddingTop: spacing.xl * 2 },
  kicker: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 42, fontWeight: '900', marginTop: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: spacing.md },
  bullets: { marginTop: spacing.xl, gap: spacing.md },
  bullet: { color: colors.text, fontSize: 14, lineHeight: 20 },
  cta: { marginTop: spacing.xl },
  disclaimer: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
