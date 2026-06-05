/** v2 Fund: LP base, fee/carry economics, capital calls, and the GP income
 *  statement + consolidated balance sheet. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { portfolioNav } from '../portfolio';
import { fundMetrics, uncalledCapital } from '../fund';
import { trailingReturn } from '../rivals';
import { metricValue, objectiveProgress, formatMetric } from '../objectives';
import { Objective } from '../types';
import { SimHeader } from './SimHeader';
import { TabTip } from '../../components/TabTip';
import { notify } from '../../utils/notify';
import { Button, Card, Pill, ProgressBar, SectionTitle, StatTile } from '../../components/ui';
import { AmountStepper } from '../../components/controls';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtMultiple, fmtPct } from '../../utils/format';

export function FundScreen() {
  const game = useSimStore((s) => s.game)!;
  const callLpCapital = useSimStore((s) => s.callLpCapital);

  const fundNav = useMemo(() => portfolioNav(game.portfolio, game.instruments), [game.portfolio, game.instruments]);
  const metrics = useMemo(() => fundMetrics(game.fund, fundNav, game.month), [game.fund, fundNav, game.month]);
  const uncalled = uncalledCapital(game.fund);
  const [callAmt, setCallAmt] = useState(2_000_000);

  const is = game.incomeStatements[0];
  const bs = game.balanceSheets[0];

  return (
    <View style={styles.container}>
      <SimHeader title="Fonds" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TabTip tipKey="fonds" text="Rufe LP-Kapital ab für Dry Powder, erfülle Mandate für Reputation & frisches Kapital, und halte einen Cash-Puffer gegen Mittelabzüge." />
        <Card>
          <SectionTitle>Fonds-Kennzahlen</SectionTitle>
          <Text style={styles.big}>{fmtMoney(fundNav)}</Text>
          <View style={styles.statRow}>
            <StatTile label="Netto-IRR" value={fmtPct(metrics.netIrr)} valueColor={metrics.netIrr >= 0 ? colors.positive : colors.negative} />
            <StatTile label="TVPI" value={fmtMultiple(metrics.tvpi)} />
            <StatTile label="DPI" value={fmtMultiple(metrics.dpi)} />
            <StatTile label="RVPI" value={fmtMultiple(metrics.rvpi)} />
          </View>
          <View style={styles.statRow}>
            <StatTile label="Committed" value={fmtMoney(game.fund.committed)} />
            <StatTile label="Called" value={fmtMoney(game.fund.called)} />
            <StatTile label="Distrib." value={fmtMoney(game.fund.distributed)} />
            <StatTile label="Uncalled" value={fmtMoney(uncalled)} />
          </View>
        </Card>

        {(() => {
          const cashQuote = fundNav > 0 ? game.portfolio.cash / fundNav : 0;
          const hwm = game.portfolio.highWaterMark || fundNav;
          const drawdown = hwm > 0 ? Math.max(0, (hwm - fundNav) / hwm) : 0;
          const trailing = trailingReturn(game.portfolio.returnHistory);
          const lockup = game.month - game.fund.vintageMonth <= 18;
          const elevated = !lockup && (drawdown > 0.1 || (Number.isFinite(trailing) && trailing < 0.05));
          return (
            <Card>
              <SectionTitle>Liquidität & Abzugsrisiko</SectionTitle>
              <View style={styles.statRow}>
                <StatTile label="Fonds-Cash" value={fmtMoney(game.portfolio.cash)} />
                <StatTile label="Cash-Quote" value={fmtPct(cashQuote, 0)} valueColor={cashQuote < 0.1 ? colors.negative : colors.text} />
                <StatTile label="Drawdown" value={fmtPct(drawdown)} valueColor={drawdown > 0.1 ? colors.negative : colors.text} />
              </View>
              <Text style={[styles.hint, { color: elevated ? colors.negative : colors.textMuted }]}>
                {lockup
                  ? 'Lockup aktiv — vorerst keine Mittelabzüge.'
                  : elevated
                    ? '⚠ Erhöhtes Abzugsrisiko: schwache Performance/Drawdown. Halte Cash-Puffer, sonst drohen Notverkäufe.'
                    : 'Abzugsrisiko gering. Ein Cash-Puffer schützt vor Zwangsverkäufen in Krisen.'}
              </Text>
            </Card>
          );
        })()}

        {(game.specialHoldings ?? []).length > 0 ? (
          <Card>
            <SectionTitle ornament>Sondersituationen</SectionTitle>
            {(game.specialHoldings ?? []).map((h) => (
              <View key={h.id} style={styles.lpRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lpName}>{h.title}</Text>
                  <Text style={styles.lpMeta}>Investiert {fmtMoney(h.invested)} · löst sich in {Math.max(0, h.resolveMonth - game.month)} Mon. auf</Text>
                </View>
                <Pill text="gebunden" color={colors.warning} />
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <SectionTitle ornament>Mandate & Ziele der LPs</SectionTitle>
          {game.objectives.filter((o) => o.status === 'active').length === 0 ? (
            <Text style={styles.empty}>Derzeit keine offenen Mandate.</Text>
          ) : (
            game.objectives
              .filter((o) => o.status === 'active')
              .map((obj) => <ObjectiveRow key={obj.id} obj={obj} value={metricValue(game, obj.metric)} monthsLeft={obj.deadlineMonth - game.month} />)
          )}
        </Card>

        <Card>
          <SectionTitle>Kapital abrufen (Dry Powder)</SectionTitle>
          <Text style={styles.hint}>Abrufbar: {fmtMoney(uncalled)} · Konditionen: {fmtPct(game.fund.mgmtFeeRate, 0)} Fee / {fmtPct(game.fund.carryRate, 0)} Carry über {fmtPct(game.fund.hurdleRate, 0)} Hurdle</Text>
          {uncalled <= 0 ? (
            <Text style={styles.empty}>Kein abrufbares Kapital. Raise mehr LP-Commitments über Track-Record & IR.</Text>
          ) : (
            <>
              <AmountStepper value={callAmt} onChange={setCallAmt} step={1_000_000} min={500_000} max={uncalled} />
              <Button title="Capital Call" onPress={() => { const r = callLpCapital(callAmt); if (!r.ok) notify('Nicht möglich', r.error ?? ''); }} style={{ marginTop: spacing.md }} />
            </>
          )}
        </Card>

        {is ? (
          <Card>
            <SectionTitle>GP-Erfolgsrechnung (Monat)</SectionTitle>
            <Line label="Management Fees" value={is.mgmtFeeRevenue} />
            <Line label="Carried Interest" value={is.carryRevenue} />
            <Line label="Gehälter" value={-is.salaries} />
            <Line label="Infrastruktur" value={-is.infraOpex} />
            <Line label="Steuern" value={-is.tax} />
            <View style={styles.divider} />
            <Line label="Nettoergebnis" value={is.netIncome} bold />
          </Card>
        ) : null}

        {bs ? (
          <Card>
            <SectionTitle>Bilanz (konsolidiert)</SectionTitle>
            <Line label="Fonds-Cash" value={bs.fundCash} plain />
            <Line label="GP-Cash" value={bs.firmCash} plain />
            <Line label="Positionen (Equity)" value={bs.positionsValue} plain />
            <View style={styles.divider} />
            <Line label="Summe Aktiva" value={bs.totalAssets} bold plain />
            <Line label="Carry-Verbindlichkeit" value={-bs.accruedCarry} plain />
            <View style={styles.divider} />
            <Line label="LP-Kapital" value={bs.lpCapital} plain />
            <Line label="GP-Eigenkapital" value={bs.gpEquity} plain />
            <Line label="Eigenkapital gesamt" value={bs.totalEquity} bold plain />
          </Card>
        ) : null}

        <Card>
          <SectionTitle>Limited Partners ({game.fund.lps.length})</SectionTitle>
          {game.fund.lps.map((lp) => (
            <View key={lp.id} style={styles.lpRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lpName}>{lp.name}</Text>
                <Text style={styles.lpMeta}>{lp.type} · committed {fmtMoney(lp.committed)} · called {fmtMoney(lp.called)}</Text>
              </View>
              {lp.redeemed ? <Pill text="Redeemed" color={colors.negative} /> : <Pill text={fmtPct(lp.expectedReturn, 0)} color={colors.textMuted} />}
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function ObjectiveRow({ obj, value, monthsLeft }: { obj: Objective; value: number; monthsLeft: number }) {
  const progress = objectiveProgress(obj, value);
  const onTrack = progress >= 1;
  return (
    <View style={styles.objRow}>
      <View style={styles.objHead}>
        <Text style={styles.objTitle}>{obj.title} · {obj.description}</Text>
        <Pill text={onTrack ? 'Im Plan' : 'Offen'} color={onTrack ? colors.positive : colors.warning} />
      </View>
      <ProgressBar value={progress} color={onTrack ? colors.positive : colors.primary} />
      <Text style={styles.objMeta}>
        Aktuell {formatMetric(obj.metric, value)} · noch {Math.max(0, monthsLeft)} Mon. · Belohnung +{obj.rewardReputation} Rep
        {obj.rewardCapital > 0 ? ` / +$${(obj.rewardCapital / 1e6).toFixed(0)}M` : ''}
      </Text>
    </View>
  );
}

function Line({ label, value, bold, plain }: { label: string; value: number; bold?: boolean; plain?: boolean }) {
  const color = plain ? colors.text : value >= 0 ? colors.positive : colors.negative;
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.lineVal, bold && styles.bold, { color }]}>{fmtMoney(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  big: { color: colors.text, fontSize: 32, fontFamily: fonts.displayBlack, marginBottom: spacing.sm },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lineLabel: { color: colors.textMuted, fontSize: 13 },
  lineVal: { color: colors.text, fontSize: 13, fontWeight: '600' },
  bold: { fontWeight: '800', color: colors.text, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  lpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  lpName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  lpMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  objRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.ruleSoft, gap: spacing.xs },
  objHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  objTitle: { color: colors.text, fontSize: 12, flex: 1 },
  objMeta: { color: colors.textMuted, fontSize: 11 },
});
