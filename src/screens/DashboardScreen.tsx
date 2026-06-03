/** Dashboard: the family office at a glance — combined equity, both books,
 *  reputation, macro snapshot and the recent event log. */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { computeMetrics } from '../engine/metrics';
import { totalEquity } from '../engine/gameEngine';
import { PHASE_DESCRIPTION, PHASE_LABEL } from '../engine/macro';
import { reputationTier } from '../engine/reputation';
import { GameHeader } from '../components/GameHeader';
import { Card, ProgressBar, SectionTitle, StatTile } from '../components/ui';
import { LineChart } from '../components/LineChart';
import { colors, spacing } from '../utils/theme';
import { fmtMoney, fmtMultiple, fmtNum, fmtPct, fmtPctSigned } from '../utils/format';
import { STARTING_CAPITAL } from '../models/types';
import { GameEventType } from '../models/types';

const EVENT_COLOR: Record<GameEventType, string> = {
  macro: colors.accent,
  hedge: colors.primary,
  vc: colors.positive,
  blackswan: colors.negative,
  reputation: colors.warning,
  info: colors.textMuted,
};

export function DashboardScreen() {
  const game = useGameStore((s) => s.game)!;
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => computeMetrics(game), [game]);

  const equity = metrics.totalEquity;
  const totalReturn = equity / STARTING_CAPITAL - 1;
  const history = game.totalEquityHistory;
  const prev = history.length >= 2 ? history[history.length - 2] : STARTING_CAPITAL;
  const qReturn = prev > 0 ? totalEquity(game) / prev - 1 : 0;

  return (
    <View style={styles.container}>
      <GameHeader title="Family Office" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero equity card */}
        <Card>
          <SectionTitle>Gesamtvermögen</SectionTitle>
          <Text style={styles.equity}>{fmtMoney(equity)}</Text>
          <View style={styles.heroRow}>
            <Text style={[styles.heroSub, { color: totalReturn >= 0 ? colors.positive : colors.negative }]}>
              {fmtPctSigned(totalReturn)} gesamt
            </Text>
            <Text style={[styles.heroSub, { color: qReturn >= 0 ? colors.positive : colors.negative }]}>
              {fmtPctSigned(qReturn)} Quartal
            </Text>
          </View>
          <View style={styles.chartWrap}>
            <LineChart
              data={history}
              width={width - spacing.lg * 4}
              height={120}
              baseline={STARTING_CAPITAL}
              color={totalReturn >= 0 ? colors.positive : colors.negative}
            />
          </View>
        </Card>

        {/* Two books */}
        <View style={styles.twoCol}>
          <Card style={styles.col}>
            <SectionTitle>Hedge Fund</SectionTitle>
            <Text style={styles.bookValue}>{fmtMoney(metrics.hedgeFundNav)}</Text>
            <Text style={styles.bookHint}>Sharpe {fmtNum(metrics.sharpe)}</Text>
            <Text style={styles.bookHint}>Max DD {fmtPct(metrics.maxDrawdown)}</Text>
            <Text style={styles.bookHint}>VaR₉₅ {fmtMoney(metrics.var95)}</Text>
          </Card>
          <Card style={styles.col}>
            <SectionTitle>VC Fonds</SectionTitle>
            <Text style={styles.bookValue}>{fmtMoney(metrics.vcNav)}</Text>
            <Text style={styles.bookHint}>IRR {fmtPct(metrics.vcIrr)}</Text>
            <Text style={styles.bookHint}>TVPI {fmtMultiple(metrics.tvpi)}</Text>
            <Text style={styles.bookHint}>MOIC {fmtMultiple(metrics.moic)}</Text>
          </Card>
        </View>

        {/* Reputation */}
        <Card>
          <SectionTitle>Reputation</SectionTitle>
          <View style={styles.repRow}>
            <Text style={styles.repValue}>{game.reputation.toFixed(0)}</Text>
            <Text style={styles.repTier}>{reputationTier(game.reputation)}</Text>
          </View>
          <ProgressBar value={game.reputation / 100} color={colors.warning} />
          <Text style={styles.repHint}>
            Abrufbares LP-Kapital: {fmtMoney(game.lpCapitalAvailable)}
          </Text>
        </Card>

        {/* Macro snapshot */}
        <Card>
          <SectionTitle>Makro-Umfeld · {PHASE_LABEL[game.macro.phase]}</SectionTitle>
          <Text style={styles.macroDesc}>{PHASE_DESCRIPTION[game.macro.phase]}</Text>
          <View style={styles.statRow}>
            <StatTile label="BIP" value={fmtPct(game.macro.gdpGrowth)} />
            <StatTile label="Zins" value={fmtPct(game.macro.interestRate)} />
            <StatTile label="Inflation" value={fmtPct(game.macro.inflation)} />
            <StatTile
              label="Stimmung"
              value={fmtNum(game.macro.sentiment)}
              valueColor={game.macro.sentiment >= 0 ? colors.positive : colors.negative}
            />
          </View>
        </Card>

        {/* Event log */}
        <Card>
          <SectionTitle>Ereignisse</SectionTitle>
          {game.events.slice(0, 12).map((ev) => (
            <View key={ev.id} style={styles.event}>
              <View style={[styles.eventDot, { backgroundColor: EVENT_COLOR[ev.type] }]} />
              <View style={styles.eventBody}>
                <Text style={styles.eventTitle}>{ev.title}</Text>
                <Text style={styles.eventDesc}>{ev.description}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  equity: { color: colors.text, fontSize: 38, fontWeight: '800' },
  heroRow: { flexDirection: 'row', gap: spacing.lg, marginTop: 2 },
  heroSub: { fontSize: 14, fontWeight: '700' },
  chartWrap: { marginTop: spacing.md, alignItems: 'center' },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  bookValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xs },
  bookHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  repRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, marginBottom: spacing.sm },
  repValue: { color: colors.text, fontSize: 30, fontWeight: '800' },
  repTier: { color: colors.warning, fontSize: 14, fontWeight: '700' },
  repHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  macroDesc: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  event: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  eventBody: { flex: 1 },
  eventTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  eventDesc: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
});
