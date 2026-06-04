/** Final edition — end-of-game scorecard with grade, score and key stats. */
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { enterpriseEquity } from '../engine';
import { portfolioNav } from '../portfolio';
import { fundMetrics } from '../fund';
import { maxDrawdown } from '../../engine/finance';
import { Button, Rule, StatTile } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtMultiple, fmtPct } from '../../utils/format';

const REASON_HEADLINE: Record<string, string> = {
  horizon: 'Zwanzig Jahre — die Schlussbilanz',
  insolvency: 'Das Haus ist gefallen',
  reputation: 'Die LPs haben das Vertrauen verloren',
};

export function EndGameModal() {
  const game = useSimStore((s) => s.game);
  const newGame = useSimStore((s) => s.newGame);
  const [dismissed, setDismissed] = useState(false);

  // Re-arm the scorecard whenever a fresh game-over happens.
  useEffect(() => {
    if (game && !game.gameOver) setDismissed(false);
  }, [game?.gameOver]);

  if (!game || !game.gameOver) return null;
  const visible = !dismissed;

  const nav = portfolioNav(game.portfolio, game.instruments);
  const metrics = fundMetrics(game.fund, nav, game.month);
  const enterprise = enterpriseEquity(game);
  const start = game.equityHistory[0] ?? enterprise;
  const dd = maxDrawdown(game.portfolio.navHistory);
  const objSucceeded = game.objectives.filter((o) => o.status === 'succeeded').length;
  const objTotal = game.objectives.length;
  const reason = game.gameOverReason ?? 'horizon';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.masthead}>Schlussbilanz</Text>
            <Text style={styles.dateline}>DIE FINANZ-CHRONIK · LETZTE AUSGABE</Text>
            <Rule double />

            <Text style={styles.headline}>{REASON_HEADLINE[reason]}</Text>

            <View style={styles.gradeWrap}>
              <Text style={styles.grade}>{game.finalGrade ?? '—'}</Text>
              <Text style={styles.score}>{game.finalScore ?? 0} Punkte</Text>
            </View>

            <Rule />
            <View style={styles.statRow}>
              <StatTile label="Unternehmenswert" value={fmtMoney(enterprise)} />
              <StatTile label="Gesamtrendite" value={fmtPct(enterprise / start - 1)} valueColor={enterprise >= start ? colors.positive : colors.negative} />
            </View>
            <View style={styles.statRow}>
              <StatTile label="Netto-IRR" value={fmtPct(metrics.netIrr)} />
              <StatTile label="TVPI" value={fmtMultiple(metrics.tvpi)} />
            </View>
            <View style={styles.statRow}>
              <StatTile label="Reputation" value={game.reputation.toFixed(0)} />
              <StatTile label="Max Drawdown" value={fmtPct(dd)} valueColor={colors.negative} />
            </View>
            <View style={styles.statRow}>
              <StatTile label="Mandate erfüllt" value={`${objSucceeded}/${objTotal}`} />
              <StatTile label="Committed" value={fmtMoney(game.fund.committed)} />
            </View>

            <Button title="Neues Spiel" onPress={() => newGame()} variant="primary" style={{ marginTop: spacing.lg }} />
            <Button title="Bücher ansehen" onPress={() => setDismissed(true)} variant="secondary" style={{ marginTop: spacing.sm }} />
            <Text style={styles.colophon}>Alpha &amp; Carry · Die Finanz-Chronik</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,10,0.7)', justifyContent: 'center', padding: spacing.md },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxHeight: '90%' },
  scroll: { padding: spacing.lg },
  masthead: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 32, textAlign: 'center', paddingVertical: 2 },
  dateline: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginBottom: spacing.xs },
  headline: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 22, lineHeight: 26, textAlign: 'center', marginTop: spacing.md },
  gradeWrap: { alignItems: 'center', marginVertical: spacing.md },
  grade: { color: colors.primary, fontFamily: fonts.displayBlack, fontSize: 72, lineHeight: 78 },
  score: { color: colors.textMuted, fontFamily: fonts.serifBold, fontSize: 14, letterSpacing: 1 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  colophon: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, textAlign: 'center', letterSpacing: 1, marginTop: spacing.md },
});
