/** v2 Dashboard: enterprise value, fund & GP snapshot, reputation, macro, events. */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSimStore, useCapabilities } from '../store';
import { enterpriseEquity } from '../engine';
import { portfolioNav } from '../portfolio';
import { fundMetrics } from '../fund';
import { computeRisk } from '../risk';
import { buildLeague, trailingReturn } from '../rivals';
import { REGIME_DESC, REGIME_LABEL } from '../economy';
import { SimEventType } from '../types';
import { SimHeader } from './SimHeader';
import { Card, ProgressBar, SectionTitle, StatTile } from '../../components/ui';
import { LineChart } from '../../components/LineChart';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtMultiple, fmtNum, fmtPct, fmtPctSigned } from '../../utils/format';

const EVENT_COLOR: Record<SimEventType, string> = {
  economy: colors.accent,
  market: colors.primary,
  firm: colors.warning,
  fund: colors.positive,
  risk: colors.negative,
  blackswan: colors.negative,
  info: colors.textMuted,
};

export function SimDashboardScreen() {
  const game = useSimStore((s) => s.game)!;
  const caps = useCapabilities()!;
  const { width } = useWindowDimensions();

  const fundNav = useMemo(() => portfolioNav(game.portfolio, game.instruments), [game.portfolio, game.instruments]);
  const metrics = useMemo(() => fundMetrics(game.fund, fundNav, game.month), [game.fund, fundNav, game.month]);
  const risk = useMemo(() => computeRisk(game.portfolio, game.instruments, game.economy), [game.portfolio, game.instruments, game.economy]);

  const enterprise = enterpriseEquity(game);
  const hist = game.equityHistory;
  const start = hist[0] ?? enterprise;
  const totalRet = enterprise / start - 1;

  return (
    <View style={styles.container}>
      <SimHeader title="Übersicht" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <SectionTitle>Unternehmenswert (GP + Fonds-NAV)</SectionTitle>
          <Text style={styles.big}>{fmtMoney(enterprise)}</Text>
          <Text style={[styles.sub, { color: totalRet >= 0 ? colors.positive : colors.negative }]}>
            {fmtPctSigned(totalRet)} seit Start
          </Text>
          <View style={styles.chartWrap}>
            <LineChart data={hist} width={width - spacing.lg * 4} height={110} baseline={start} color={totalRet >= 0 ? colors.positive : colors.negative} />
          </View>
        </Card>

        <View style={styles.twoCol}>
          <Card style={styles.col}>
            <SectionTitle>Fonds</SectionTitle>
            <Text style={styles.colVal}>{fmtMoney(fundNav)}</Text>
            <Text style={styles.hint}>Netto-IRR {fmtPct(metrics.netIrr)}</Text>
            <Text style={styles.hint}>TVPI {fmtMultiple(metrics.tvpi)} · DPI {fmtMultiple(metrics.dpi)}</Text>
            <Text style={styles.hint}>Committed {fmtMoney(game.fund.committed)}</Text>
          </Card>
          <Card style={styles.col}>
            <SectionTitle>GP-Firma</SectionTitle>
            <Text style={styles.colVal}>{fmtMoney(game.firm.cash)}</Text>
            <Text style={styles.hint}>Fees {fmtMoney(game.firm.feesEarned)}</Text>
            <Text style={styles.hint}>Carry {fmtMoney(game.firm.carryEarned)}</Text>
            <Text style={styles.hint}>Team {game.firm.employees.length}</Text>
          </Card>
        </View>

        <Card>
          <SectionTitle>Risiko & Buch</SectionTitle>
          <View style={styles.statRow}>
            <StatTile label="VaR₉₅ (1M)" value={fmtMoney(risk.var95)} valueColor={colors.warning} />
            <StatTile label="Brutto-Exp." value={fmtMoney(risk.grossExposure)} />
            <StatTile label="Netto-β" value={fmtNum(risk.netBeta / Math.max(1, fundNav), 2)} />
            <StatTile label="Positionen" value={`${game.portfolio.positions.length}/${caps.capacityPositions}`} valueColor={game.portfolio.positions.length > caps.capacityPositions ? colors.negative : colors.text} />
          </View>
        </Card>

        <Card>
          <SectionTitle ornament>Rangliste · 12-Monats-Rendite</SectionTitle>
          {buildLeague(game.rivals, game.firm.name, trailingReturn(game.portfolio.returnHistory), fundNav).map((e) => (
            <View key={e.name} style={[styles.leagueRow, e.isPlayer && styles.leagueMe]}>
              <Text style={[styles.leagueRank, e.isPlayer && styles.leagueMeText]}>{e.rank}</Text>
              <Text style={[styles.leagueName, e.isPlayer && styles.leagueMeText]} numberOfLines={1}>{e.name}</Text>
              <Text style={[styles.leagueRet, { color: e.trailingReturn >= 0 ? colors.positive : colors.negative }]}>{fmtPctSigned(e.trailingReturn)}</Text>
              <Text style={styles.leagueAum}>{fmtMoney(e.aum)}</Text>
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle>Reputation</SectionTitle>
          <Text style={styles.rep}>{game.reputation.toFixed(0)}</Text>
          <ProgressBar value={game.reputation / 100} color={colors.warning} />
        </Card>

        <Card>
          <SectionTitle>Makro · {REGIME_LABEL[game.economy.regime]}</SectionTitle>
          <Text style={styles.macroDesc}>{REGIME_DESC[game.economy.regime]}</Text>
          <View style={styles.statRow}>
            <StatTile label="BIP" value={fmtPct(game.economy.gdpGrowth)} />
            <StatTile label="Leitzins" value={fmtPct(game.economy.policyRate)} />
            <StatTile label="Inflation" value={fmtPct(game.economy.inflation)} />
            <StatTile label="Vola-Index" value={game.economy.volIndex.toFixed(0)} valueColor={game.economy.volIndex > 25 ? colors.negative : colors.text} />
          </View>
        </Card>

        <Card>
          <SectionTitle>Ereignisse</SectionTitle>
          {game.events.slice(0, 12).map((e) => (
            <View key={e.id} style={styles.event}>
              <View style={[styles.dot, { backgroundColor: EVENT_COLOR[e.type] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.evTitle}>{e.title}</Text>
                <Text style={styles.evDesc}>{e.description}</Text>
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
  big: { color: colors.text, fontSize: 38, fontFamily: fonts.displayBlack },
  sub: { fontSize: 14, fontFamily: fonts.serifBold, marginTop: 2 },
  chartWrap: { marginTop: spacing.md, alignItems: 'center' },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  colVal: { color: colors.text, fontSize: 22, fontFamily: fonts.display, marginBottom: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  leagueRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.ruleSoft, gap: spacing.sm },
  leagueMe: { backgroundColor: colors.surfaceAlt },
  leagueMeText: { fontFamily: fonts.serifBold },
  leagueRank: { color: colors.textMuted, fontSize: 13, width: 18, fontFamily: fonts.display },
  leagueName: { color: colors.text, fontSize: 13, flex: 1 },
  leagueRet: { fontSize: 13, fontFamily: fonts.serifBold, width: 64, textAlign: 'right' },
  leagueAum: { color: colors.textMuted, fontSize: 12, width: 64, textAlign: 'right' },
  rep: { color: colors.text, fontSize: 30, fontFamily: fonts.displayBlack, marginBottom: spacing.sm },
  macroDesc: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm, fontStyle: 'italic' },
  event: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dot: { width: 7, height: 7, marginTop: 5 },
  evTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.serifBold },
  evDesc: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
});
