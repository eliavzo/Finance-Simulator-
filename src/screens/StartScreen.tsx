/** Landing screen shown when there is no active game (fresh install or after a
 *  reset). Explains the premise and starts a new 20-year run. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { Button } from '../components/ui';
import { colors, spacing } from '../utils/theme';
import { STARTING_CAPITAL } from '../models/types';
import { fmtMoney } from '../utils/format';

export function StartScreen() {
  const newGame = useGameStore((s) => s.newGame);
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.kicker}>FAMILY OFFICE SIMULATOR</Text>
        <Text style={styles.title}>Alpha & Carry</Text>
        <Text style={styles.subtitle}>
          Führe ein Family Office mit {fmtMoney(STARTING_CAPITAL)} Startkapital über 20 Jahre.
          Jongliere einen Hedge Fund und einen VC-Fonds durch Konjunkturzyklen,
          Black-Swans und Margin Calls.
        </Text>

        <View style={styles.bullets}>
          <Bullet text="📈 Hedge Fund: Long/Short mit Hebel, Sharpe & Drawdown" />
          <Bullet text="🚀 VC: Seed bis IPO, Cap Table, IRR & TVPI" />
          <Bullet text="🌐 Makro-Engine: Expansion bis Rezession" />
          <Bullet text="⭐ Reputation schaltet LP-Kapital frei" />
        </View>

        <Button title="Neues Spiel starten" onPress={() => newGame()} variant="primary" style={styles.cta} />
        <Text style={styles.disclaimer}>Alles simuliert. Keine echten Märkte, keine externen APIs.</Text>
      </View>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return <Text style={styles.bullet}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  inner: { padding: spacing.xl },
  kicker: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 44, fontWeight: '900', marginTop: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: spacing.md },
  bullets: { marginTop: spacing.xl, gap: spacing.md },
  bullet: { color: colors.text, fontSize: 15 },
  cta: { marginTop: spacing.xl },
  disclaimer: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
