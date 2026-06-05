/** v2 Venture: back startups, support them, follow on, ride exits. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { vcMetrics, holdingValue } from '../vc';
import { Startup, StartupDeal } from '../types';
import { SimHeader } from './SimHeader';
import { TabTip } from '../../components/TabTip';
import { notify } from '../../utils/notify';
import { Button, Card, Pill, ProgressBar, SectionTitle, StatTile } from '../../components/ui';
import { AmountStepper } from '../../components/controls';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtMultiple, fmtPct } from '../../utils/format';

function healthColor(h: number) {
  return h >= 0.66 ? colors.positive : h >= 0.4 ? colors.warning : colors.negative;
}

export function StartupsScreen() {
  const game = useSimStore((s) => s.game)!;
  const metrics = useMemo(() => vcMetrics(game.vc, game.month), [game.vc, game.month]);
  const active = game.vc.portfolio.filter((s) => s.status === 'active');
  const closed = game.vc.portfolio.filter((s) => s.status !== 'active');

  return (
    <View style={styles.container}>
      <SimHeader title="Startups" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TabTip tipKey="startups" text="Investiere in junge Firmen, unterstütze sie operativ und zieh bei neuen Runden pro-rata mit. Wenige werden Raketen (IPO/M&A), viele scheitern." />
        <Card>
          <SectionTitle>VC-Portfolio</SectionTitle>
          <Text style={styles.big}>{fmtMoney(metrics.residual)}</Text>
          <View style={styles.statRow}>
            <StatTile label="IRR" value={fmtPct(metrics.irr)} valueColor={metrics.irr >= 0 ? colors.positive : colors.negative} />
            <StatTile label="TVPI" value={fmtMultiple(metrics.tvpi)} />
            <StatTile label="Investiert" value={fmtMoney(metrics.paidIn)} />
            <StatTile label="Realisiert" value={fmtMoney(metrics.distributions)} />
          </View>
          <Text style={styles.hint}>Fonds-Cash für neue Deals: {fmtMoney(game.portfolio.cash)}</Text>
        </Card>

        <Card>
          <SectionTitle ornament>Dein Portfolio ({active.length} aktiv)</SectionTitle>
          {active.length === 0 ? (
            <Text style={styles.empty}>Noch keine Beteiligungen. Investiere unten in einen Deal.</Text>
          ) : (
            active.map((s) => <StartupCard key={s.id} s={s} />)
          )}
        </Card>

        {closed.length > 0 ? (
          <Card>
            <SectionTitle>Realisiert ({closed.length})</SectionTitle>
            {closed.map((s) => (
              <View key={s.id} style={styles.closedRow}>
                <Text style={styles.closedName}>{s.name}</Text>
                <Pill
                  text={s.exit ? `${s.exit.type} · ${fmtMoney(s.exit.proceeds)}` : 'gescheitert'}
                  color={s.status === 'exited' ? colors.positive : colors.negative}
                />
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <SectionTitle ornament>Deal-Flow</SectionTitle>
          {game.vc.deals.map((d) => (
            <DealRow key={d.id} d={d} cash={game.portfolio.cash} />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function StartupCard({ s }: { s: Startup }) {
  const support = useSimStore((st) => st.supportStartup);
  const followOn = useSimStore((st) => st.followOnStartup);
  const value = holdingValue(s);
  const moic = s.totalInvested > 0 ? value / s.totalInvested : 0;
  const runwayMonths = s.burnRate > 0 ? s.runwayCash / s.burnRate : 0;

  return (
    <View style={styles.su}>
      <View style={styles.suHead}>
        <Text style={styles.suName}>{s.name}</Text>
        {s.raising ? <Pill text="RAISING" color={colors.warning} /> : <Pill text={s.stage} color={colors.textMuted} />}
      </View>
      <View style={styles.statRow}>
        <StatTile label="Anteil" value={fmtPct(s.ownership, 1)} />
        <StatTile label="Bewertung" value={fmtMoney(s.postMoney)} />
        <StatTile label="Wert" value={fmtMoney(value)} hint={`${fmtMultiple(moic)} MOIC`} />
      </View>
      <View style={styles.statRow}>
        <StatTile label="Umsatz" value={fmtMoney(s.revenue)} />
        <StatTile label="Wachstum" value={fmtPct(s.growthRate)} />
        <StatTile label="Runway" value={`${runwayMonths.toFixed(0)} Mon.`} valueColor={runwayMonths < 4 ? colors.negative : colors.text} />
      </View>
      <View style={styles.healthRow}>
        <Text style={styles.healthLabel}>Health</Text>
        <View style={{ flex: 1 }}><ProgressBar value={s.health} color={healthColor(s.health)} /></View>
        <Text style={styles.supportLabel}>Support {(s.support * 100).toFixed(0)}%</Text>
      </View>
      <View style={styles.btnRow}>
        <Button title="Unterstützen" variant="secondary" onPress={() => { const r = support(s.id); if (!r.ok) notify('Nicht möglich', r.error ?? ''); }} style={styles.smallBtn} />
        {s.raising ? (
          <Button title={`Folge-Inv. ${fmtMoney(s.raising.proRata)}`} variant="positive" onPress={() => { const r = followOn(s.id); if (!r.ok) notify('Nicht möglich', r.error ?? ''); }} style={styles.smallBtn} />
        ) : null}
      </View>
    </View>
  );
}

function DealRow({ d, cash }: { d: StartupDeal; cash: number }) {
  const invest = useSimStore((s) => s.investStartup);
  const postMoney = d.preMoney + d.roundSize;
  const maxInvest = Math.min(d.roundSize, Math.floor(cash / 100_000) * 100_000);
  const [amount, setAmount] = useState(Math.min(Math.max(500_000, Math.round(d.roundSize * 0.3 / 100_000) * 100_000), Math.max(500_000, maxInvest)));
  const ownership = amount / postMoney;

  return (
    <View style={styles.deal}>
      <View style={styles.suHead}>
        <Text style={styles.suName}>{d.name}</Text>
        <Pill text={`${d.stage} · ${d.sector}`} color={colors.textMuted} />
      </View>
      <Text style={styles.dealMeta}>
        Pre-Money {fmtMoney(d.preMoney)} · Runde {fmtMoney(d.roundSize)} · Umsatz {fmtMoney(d.revenue)} · Wachstum {fmtPct(d.growthRate)} · Team {(d.quality * 100).toFixed(0)}
      </Text>
      <AmountStepper value={amount} onChange={setAmount} step={250_000} min={250_000} max={Math.max(250_000, maxInvest)} />
      <Button
        title={`Investieren · ${fmtPct(ownership, 1)} Anteil`}
        variant="positive"
        onPress={() => { const r = invest(d.id, amount); if (!r.ok) notify('Nicht möglich', r.error ?? ''); }}
        style={{ marginTop: spacing.sm }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  big: { color: colors.text, fontSize: 28, fontFamily: fonts.displayBlack, marginBottom: spacing.sm },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  su: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  deal: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  suHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  suName: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 16, flex: 1 },
  dealMeta: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  healthLabel: { color: colors.textMuted, fontSize: 11, width: 44 },
  supportLabel: { color: colors.textMuted, fontSize: 11, width: 84, textAlign: 'right' },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  smallBtn: { flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  closedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.ruleSoft },
  closedName: { color: colors.text, fontSize: 14, fontFamily: fonts.serifBold },
});
