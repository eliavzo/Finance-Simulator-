/** v2 Fund: LP base, fee/carry economics, capital calls, and the GP income
 *  statement + consolidated balance sheet. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { portfolioNav } from '../portfolio';
import { fundMetrics, uncalledCapital, lpSentiment } from '../fund';
import { benchmarkTrailing } from '../engine';
import { trailingReturn } from '../rivals';
import { metricValue, objectiveProgress, formatMetric, localizedObjective } from '../objectives';
import { LP_TYPE_LABEL } from '../labels';
import { Objective } from '../types';
import { SimHeader } from './SimHeader';
import { TabTip } from '../../components/TabTip';
import { notify } from '../../utils/notify';
import { useTr, useLang, Lang } from '../../i18n';
import { Button, Card, Pill, ProgressBar, SectionTitle, StatTile } from '../../components/ui';
import { AmountStepper } from '../../components/controls';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtMultiple, fmtPct } from '../../utils/format';

export function FundScreen() {
  const t = useTr();
  const lang = useLang();
  const game = useSimStore((s) => s.game)!;
  const callLpCapital = useSimStore((s) => s.callLpCapital);

  const fundNav = useMemo(() => portfolioNav(game.portfolio, game.instruments), [game.portfolio, game.instruments]);
  const metrics = useMemo(() => fundMetrics(game.fund, fundNav, game.month), [game.fund, fundNav, game.month]);
  const uncalled = uncalledCapital(game.fund);
  const [callAmt, setCallAmt] = useState(2_000_000);

  const trailing12 = trailingReturn(game.portfolio.returnHistory, 12);
  const benchmark12 = benchmarkTrailing(game.benchmarkHistory, 12);
  const lpHwm = game.portfolio.highWaterMark || fundNav;
  const lpDrawdown = lpHwm > 0 ? Math.max(0, (lpHwm - fundNav) / lpHwm) : 0;
  const benchLevels = game.benchmarkHistory ?? [];
  const benchPeak = benchLevels.length ? Math.max(...benchLevels) : 0;
  const benchNow = benchLevels.length ? benchLevels[benchLevels.length - 1] : 0;
  const benchDrawdown = benchPeak > 0 ? Math.max(0, (benchPeak - benchNow) / benchPeak) : 0;

  const is = game.incomeStatements[0];
  const bs = game.balanceSheets[0];

  return (
    <View style={styles.container}>
      <SimHeader title={t({ de: 'Fonds', en: 'Fund' })} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TabTip tipKey="fonds" text={t({ de: 'Rufe LP-Kapital ab für Dry Powder, erfülle Mandate für Reputation & frisches Kapital, und halte einen Cash-Puffer gegen Mittelabzüge.', en: 'Call LP capital for dry powder, fulfil mandates for reputation & fresh capital, and keep a cash buffer against redemptions.' })} />
        <Card>
          <SectionTitle>{t({ de: 'Fonds-Kennzahlen', en: 'Fund metrics' })}</SectionTitle>
          <Text style={styles.big}>{fmtMoney(fundNav)}</Text>
          <View style={styles.statRow}>
            <StatTile label={t({ de: 'Netto-IRR', en: 'Net IRR' })} value={fmtPct(metrics.netIrr)} valueColor={metrics.netIrr >= 0 ? colors.positive : colors.negative} />
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
              <SectionTitle>{t({ de: 'Liquidität & Abzugsrisiko', en: 'Liquidity & redemption risk' })}</SectionTitle>
              <View style={styles.statRow}>
                <StatTile label={t({ de: 'Fonds-Cash', en: 'Fund cash' })} value={fmtMoney(game.portfolio.cash)} />
                <StatTile label={t({ de: 'Cash-Quote', en: 'Cash ratio' })} value={fmtPct(cashQuote, 0)} valueColor={cashQuote < 0.1 ? colors.negative : colors.text} />
                <StatTile label="Drawdown" value={fmtPct(drawdown)} valueColor={drawdown > 0.1 ? colors.negative : colors.text} />
              </View>
              <Text style={[styles.hint, { color: elevated ? colors.negative : colors.textMuted }]}>
                {lockup
                  ? t({ de: 'Lockup aktiv — vorerst keine Mittelabzüge.', en: 'Lockup active — no redemptions for now.' })
                  : elevated
                    ? t({ de: '⚠ Erhöhtes Abzugsrisiko: schwache Performance/Drawdown. Halte Cash-Puffer, sonst drohen Notverkäufe.', en: '⚠ Elevated redemption risk: weak performance/drawdown. Keep a cash buffer or face forced sales.' })
                    : t({ de: 'Abzugsrisiko gering. Ein Cash-Puffer schützt vor Zwangsverkäufen in Krisen.', en: 'Redemption risk low. A cash buffer protects against forced sales in crises.' })}
              </Text>
            </Card>
          );
        })()}

        {(game.specialHoldings ?? []).length > 0 ? (
          <Card>
            <SectionTitle ornament>{t({ de: 'Sondersituationen', en: 'Special situations' })}</SectionTitle>
            {(game.specialHoldings ?? []).map((h) => (
              <View key={h.id} style={styles.lpRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lpName}>{h.title}</Text>
                  <Text style={styles.lpMeta}>{t({ de: 'Investiert', en: 'Invested' })} {fmtMoney(h.invested)} · {t({ de: 'löst sich in', en: 'resolves in' })} {Math.max(0, h.resolveMonth - game.month)} {t({ de: 'Mon. auf', en: 'mo.' })}</Text>
                </View>
                <Pill text={t({ de: 'gebunden', en: 'locked' })} color={colors.warning} />
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <SectionTitle ornament>{t({ de: 'Mandate & Ziele der LPs', en: 'Mandates & LP objectives' })}</SectionTitle>
          {game.objectives.filter((o) => o.status === 'active').length === 0 ? (
            <Text style={styles.empty}>{t({ de: 'Derzeit keine offenen Mandate.', en: 'No open mandates right now.' })}</Text>
          ) : (
            game.objectives
              .filter((o) => o.status === 'active')
              .map((obj) => <ObjectiveRow key={obj.id} obj={obj} value={metricValue(game, obj.metric)} monthsLeft={obj.deadlineMonth - game.month} lang={lang} />)
          )}
        </Card>

        <Card>
          <SectionTitle>{t({ de: 'Kapital abrufen (Dry Powder)', en: 'Call capital (dry powder)' })}</SectionTitle>
          <Text style={styles.hint}>{t({ de: 'Abrufbar', en: 'Available' })}: {fmtMoney(uncalled)} · {t({ de: 'Konditionen', en: 'Terms' })}: {fmtPct(game.fund.mgmtFeeRate, 0)} Fee / {fmtPct(game.fund.carryRate, 0)} Carry {t({ de: 'über', en: 'over' })} {fmtPct(game.fund.hurdleRate, 0)} Hurdle</Text>
          {uncalled <= 0 ? (
            <Text style={styles.empty}>{t({ de: 'Kein abrufbares Kapital. Raise mehr LP-Commitments über Track-Record & IR.', en: 'No callable capital. Raise more LP commitments via track record & IR.' })}</Text>
          ) : (
            <>
              <AmountStepper value={callAmt} onChange={setCallAmt} step={1_000_000} min={500_000} max={uncalled} />
              <Button title="Capital Call" onPress={() => { const r = callLpCapital(callAmt); if (!r.ok) notify(t({ de: 'Nicht möglich', en: 'Not possible' }), r.error ?? ''); }} style={{ marginTop: spacing.md }} />
            </>
          )}
        </Card>

        {is ? (
          <Card>
            <SectionTitle>{t({ de: 'GP-Erfolgsrechnung (Monat)', en: 'GP income statement (month)' })}</SectionTitle>
            <Line label="Management Fees" value={is.mgmtFeeRevenue} />
            <Line label="Carried Interest" value={is.carryRevenue} />
            <Line label={t({ de: 'Gehälter', en: 'Salaries' })} value={-is.salaries} />
            <Line label={t({ de: 'Infrastruktur', en: 'Infrastructure' })} value={-is.infraOpex} />
            <Line label={t({ de: 'Steuern', en: 'Taxes' })} value={-is.tax} />
            <View style={styles.divider} />
            <Line label={t({ de: 'Nettoergebnis', en: 'Net income' })} value={is.netIncome} bold />
          </Card>
        ) : null}

        {bs ? (
          <Card>
            <SectionTitle>{t({ de: 'Bilanz (konsolidiert)', en: 'Balance sheet (consolidated)' })}</SectionTitle>
            <Line label={t({ de: 'Fonds-Cash', en: 'Fund cash' })} value={bs.fundCash} plain />
            <Line label={t({ de: 'GP-Cash', en: 'GP cash' })} value={bs.firmCash} plain />
            <Line label={t({ de: 'Positionen (Equity)', en: 'Positions (equity)' })} value={bs.positionsValue} plain />
            <View style={styles.divider} />
            <Line label={t({ de: 'Summe Aktiva', en: 'Total assets' })} value={bs.totalAssets} bold plain />
            <Line label={t({ de: 'Carry-Verbindlichkeit', en: 'Carry liability' })} value={-bs.accruedCarry} plain />
            <View style={styles.divider} />
            <Line label={t({ de: 'LP-Kapital', en: 'LP capital' })} value={bs.lpCapital} plain />
            <Line label={t({ de: 'GP-Eigenkapital', en: 'GP equity' })} value={bs.gpEquity} plain />
            <Line label={t({ de: 'Eigenkapital gesamt', en: 'Total equity' })} value={bs.totalEquity} bold plain />
          </Card>
        ) : null}

        <Card>
          <SectionTitle>Limited Partners ({game.fund.lps.length})</SectionTitle>
          <Text style={styles.lpSummary}>{t({ de: 'LPs messen dich am Markt: Ziel ≈ min(eigenes Ziel, Benchmark+2 Pkt.)', en: 'LPs judge you against the market: target ≈ min(own goal, benchmark+2pts)' })}</Text>
          {game.fund.lps.map((lp) => {
            const sent = lp.redeemed ? null : lpSentiment(lp, trailing12, benchmark12, lpDrawdown, benchDrawdown);
            const moodColor = sent ? (sent.mood === 'happy' ? colors.positive : sent.mood === 'neutral' ? colors.warning : colors.negative) : colors.textMuted;
            const moodLabel = sent
              ? sent.mood === 'happy'
                ? t({ de: 'zufrieden', en: 'content' })
                : sent.mood === 'neutral'
                  ? t({ de: 'wachsam', en: 'wary' })
                  : t({ de: 'kritisch', en: 'critical' })
              : '';
            return (
              <View key={lp.id} style={styles.lpRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lpName}>{lp.name}</Text>
                  <Text style={styles.lpMeta}>{t(LP_TYPE_LABEL[lp.type])} · committed {fmtMoney(lp.committed)} · called {fmtMoney(lp.called)}</Text>
                  {sent ? (
                    <Text style={styles.lpMood}>
                      <Text style={{ color: moodColor }}>{sent.mood === 'happy' ? '●' : sent.mood === 'neutral' ? '◐' : '○'} {moodLabel}</Text>
                      {sent.mood === 'critical' ? ` · ${t({ de: 'Abzugswahrsch.', en: 'redemption prob.' })} ${(sent.pressure * 100).toFixed(0)}%/${t({ de: 'Monat', en: 'mo' })}` : ''}
                    </Text>
                  ) : null}
                </View>
                {lp.redeemed ? <Pill text="Redeemed" color={colors.negative} /> : <Pill text={fmtPct(lp.expectedReturn, 0)} color={colors.textMuted} />}
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

function ObjectiveRow({ obj, value, monthsLeft, lang }: { obj: Objective; value: number; monthsLeft: number; lang: Lang }) {
  const t = useTr();
  const progress = objectiveProgress(obj, value);
  const onTrack = progress >= 1;
  const loc = localizedObjective(obj, lang);
  return (
    <View style={styles.objRow}>
      <View style={styles.objHead}>
        <Text style={styles.objTitle}>{loc.title} · {loc.description}</Text>
        <Pill text={onTrack ? t({ de: 'Im Plan', en: 'On track' }) : t({ de: 'Offen', en: 'Open' })} color={onTrack ? colors.positive : colors.warning} />
      </View>
      <ProgressBar value={progress} color={onTrack ? colors.positive : colors.primary} />
      <Text style={styles.objMeta}>
        {t({ de: 'Aktuell', en: 'Current' })} {formatMetric(obj.metric, value)} · {t({ de: 'noch', en: 'in' })} {Math.max(0, monthsLeft)} {t({ de: 'Mon.', en: 'mo.' })} · {t({ de: 'Belohnung', en: 'Reward' })} +{obj.rewardReputation} Rep
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
  lpSummary: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic', marginBottom: spacing.xs },
  lpMood: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  objRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.ruleSoft, gap: spacing.xs },
  objHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  objTitle: { color: colors.text, fontSize: 12, flex: 1 },
  objMeta: { color: colors.textMuted, fontSize: 11 },
});
