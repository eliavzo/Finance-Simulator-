/** Final edition — end-of-game scorecard with grade, score and key stats. */
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { enterpriseEquity } from '../engine';
import { portfolioNav } from '../portfolio';
import { fundMetrics } from '../fund';
import { maxDrawdown } from '../../engine/finance';
import { ACHIEVEMENTS } from '../achievements';
import { tierPerks } from '../tiers';
import { difficultyParams, presetLabel, heatLabel } from '../difficulty';
import { Button, Rule, StatTile } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtMultiple, fmtPct } from '../../utils/format';
import { useTr, useLang, Loc } from '../../i18n';

const REASON_HEADLINE: Record<string, Loc> = {
  horizon: { de: 'Zwanzig Jahre — die Schlussbilanz', en: 'Twenty years — the final reckoning' },
  insolvency: { de: 'Das Haus ist gefallen', en: 'The house has fallen' },
  reputation: { de: 'Die LPs haben das Vertrauen verloren', en: 'The LPs have lost trust' },
};

export function EndGameModal() {
  const t = useTr();
  const lang = useLang();
  const game = useSimStore((s) => s.game);
  const resetGame = useSimStore((s) => s.resetGame);
  const openAnalysis = useSimStore((s) => s.openAnalysis);
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
            <Text style={styles.masthead}>{t({ de: 'Schlussbilanz', en: 'Final Reckoning' })}</Text>
            <Text style={styles.dateline}>{`${game.firm.name.toUpperCase()} · ${t({ de: 'LETZTE AUSGABE', en: 'FINAL EDITION' })}`}</Text>
            <Rule double />

            <Text style={styles.headline}>{t(REASON_HEADLINE[reason])}</Text>

            <View style={styles.gradeWrap}>
              <Text style={styles.grade}>{game.finalGrade ?? '—'}</Text>
              <Text style={styles.score}>{game.finalScore ?? 0} {t({ de: 'Punkte', en: 'points' })}</Text>
              <Text style={styles.diffLine}>
                {presetLabel(game.difficulty, lang)} · {t({ de: 'Härtegrad', en: 'Heat' })} {heatLabel(difficultyParams(game.difficulty).heat, lang)} · Score ×{difficultyParams(game.difficulty).scoreMult.toFixed(2)}
              </Text>
            </View>

            <Rule />
            <View style={styles.statRow}>
              <StatTile label={t({ de: 'Unternehmenswert', en: 'Enterprise value' })} value={fmtMoney(enterprise)} />
              <StatTile label={t({ de: 'Gesamtrendite', en: 'Total return' })} value={fmtPct(enterprise / start - 1)} valueColor={enterprise >= start ? colors.positive : colors.negative} />
            </View>
            <View style={styles.statRow}>
              <StatTile label={t({ de: 'Netto-IRR', en: 'Net IRR' })} value={fmtPct(metrics.netIrr)} />
              <StatTile label="TVPI" value={fmtMultiple(metrics.tvpi)} />
            </View>
            <View style={styles.statRow}>
              <StatTile label={t({ de: 'Reputation', en: 'Reputation' })} value={game.reputation.toFixed(0)} />
              <StatTile label={t({ de: 'Max Drawdown', en: 'Max Drawdown' })} value={fmtPct(dd)} valueColor={colors.negative} />
            </View>
            <View style={styles.statRow}>
              <StatTile label={t({ de: 'Mandate erfüllt', en: 'Mandates fulfilled' })} value={`${objSucceeded}/${objTotal}`} />
              <StatTile label={t({ de: 'Auszeichnungen', en: 'Achievements' })} value={`${(game.achievements ?? []).length}/${ACHIEVEMENTS.length}`} />
            </View>
            <View style={styles.statRow}>
              <StatTile label="Committed" value={fmtMoney(game.fund.committed)} />
              <StatTile label={t({ de: 'Stufe', en: 'Tier' })} value={tierPerks(game.peakReputation ?? game.reputation).label} />
            </View>

            <Button title={t({ de: 'Spielanalyse ansehen', en: 'View game analysis' })} onPress={openAnalysis} variant="primary" style={{ marginTop: spacing.lg }} />
            <Button title={t({ de: 'Neues Spiel', en: 'New game' })} onPress={resetGame} variant="secondary" style={{ marginTop: spacing.sm }} />
            <Button title={t({ de: 'Bücher ansehen', en: 'View the books' })} onPress={() => setDismissed(true)} variant="secondary" style={{ marginTop: spacing.sm }} />
            <Text style={styles.colophon}>{t({ de: 'Alpha & Carry · Die Finanz-Chronik', en: 'Alpha & Carry · The Financial Chronicle' })}</Text>
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
  diffLine: { color: colors.accent, fontFamily: fonts.serifItalic, fontSize: 11, marginTop: spacing.xs, textAlign: 'center' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  colophon: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, textAlign: 'center', letterSpacing: 1, marginTop: spacing.md },
});
