/** VC desk: live deal flow you can write cheques into, plus the portfolio with
 *  per-company health, ownership, MOIC and exit status. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { notify } from '../utils/notify';
import { useGameStore } from '../store/gameStore';
import { GameHeader } from '../components/GameHeader';
import { Button, Card, Pill, ProgressBar, SectionTitle, StatTile } from '../components/ui';
import { AmountStepper } from '../components/controls';
import { startupHoldingValue, vcMetrics } from '../engine/vc';
import { colors, spacing } from '../utils/theme';
import { fmtMoney, fmtMultiple, fmtPct } from '../utils/format';
import { Startup } from '../models/types';

function healthColor(h: number): string {
  if (h >= 0.66) return colors.positive;
  if (h >= 0.4) return colors.warning;
  return colors.negative;
}

export function VCPortfolioScreen() {
  const game = useGameStore((s) => s.game)!;
  const invest = useGameStore((s) => s.investVC);
  const vc = game.vc;
  const metrics = useMemo(() => vcMetrics(vc, game.quarter), [vc, game.quarter]);

  const active = vc.portfolio.filter((s) => s.status === 'active');
  const closed = vc.portfolio.filter((s) => s.status !== 'active');

  return (
    <View style={styles.container}>
      <GameHeader title="VC Portfolio" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Fund summary */}
        <Card>
          <SectionTitle>Fonds-Kennzahlen</SectionTitle>
          <Text style={styles.nav}>{fmtMoney(metrics.nav)}</Text>
          <View style={styles.statRow}>
            <StatTile label="Dry Powder" value={fmtMoney(vc.cash)} />
            <StatTile label="IRR" value={fmtPct(metrics.irr)} valueColor={metrics.irr >= 0 ? colors.positive : colors.negative} />
            <StatTile label="TVPI" value={fmtMultiple(metrics.tvpi)} />
            <StatTile label="MOIC" value={fmtMultiple(metrics.moic)} />
          </View>
          <Text style={styles.summaryHint}>
            Investiert {fmtMoney(vc.totalInvested)} · Realisiert {fmtMoney(vc.totalReturned)}
          </Text>
        </Card>

        {/* Deal flow */}
        <Card>
          <SectionTitle>Deal Flow · {vc.dealFlow.length} verfügbar</SectionTitle>
          {vc.dealFlow.length === 0 ? (
            <Text style={styles.empty}>Diese Runde kein neuer Deal-Flow. Nächstes Quartal kommen neue Deals.</Text>
          ) : (
            vc.dealFlow.map((deal) => (
              <DealRow key={deal.id} deal={deal} cash={vc.cash} onInvest={(amt) => {
                const res = invest(deal.id, amt);
                if (!res.ok) notify('Investment abgelehnt', res.error ?? 'Fehler');
              }} />
            ))
          )}
        </Card>

        {/* Active portfolio */}
        <Card>
          <SectionTitle>Portfolio ({active.length} aktiv)</SectionTitle>
          {active.length === 0 ? (
            <Text style={styles.empty}>Noch keine Beteiligungen. Investiere in einen Deal oben.</Text>
          ) : (
            active.map((s) => <PortfolioRow key={s.id} startup={s} />)
          )}
        </Card>

        {/* Exits / write-offs */}
        {closed.length > 0 ? (
          <Card>
            <SectionTitle>Realisiert ({closed.length})</SectionTitle>
            {closed.map((s) => (
              <View key={s.id} style={styles.closedRow}>
                <Text style={styles.closedName}>{s.name}</Text>
                <Pill
                  text={s.exit ? `${s.exit.type} · ${fmtMoney(s.exit.proceeds)}` : s.status}
                  color={s.status === 'exited' ? colors.positive : colors.negative}
                />
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DealRow({ deal, cash, onInvest }: { deal: Startup; cash: number; onInvest: (amt: number) => void }) {
  // Default cheque ~ a reasonable seed ticket, capped by dry powder.
  const suggested = Math.min(cash, Math.max(500_000, deal.valuation * 0.15));
  const [amount, setAmount] = useState(Math.round(suggested / 100_000) * 100_000 || 500_000);
  return (
    <View style={styles.deal}>
      <View style={styles.dealHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dealName}>{deal.name}</Text>
          <Text style={styles.dealMeta}>
            {deal.sector} · {deal.stage} · Pre-Money {fmtMoney(deal.valuation)}
          </Text>
        </View>
        <View style={styles.healthCol}>
          <Text style={styles.healthLabel}>Health</Text>
          <Text style={[styles.healthValue, { color: healthColor(deal.health) }]}>{fmtPct(deal.health, 0)}</Text>
        </View>
      </View>
      <Text style={styles.dealHint}>
        Erwartet ~{fmtPct(deal.growthRate)} Wachstum/Q · Burn {fmtMoney(deal.burnRate)}/Q
      </Text>
      <AmountStepper value={amount} onChange={setAmount} step={250_000} min={100_000} max={cash} />
      <Button title={`Investieren · ${fmtPct(amount / (deal.valuation + amount), 1)} Anteil`} onPress={() => onInvest(amount)} variant="positive" style={{ marginTop: spacing.sm }} />
    </View>
  );
}

function PortfolioRow({ startup }: { startup: Startup }) {
  const holding = startupHoldingValue(startup);
  const moic = startup.totalInvested > 0 ? holding / startup.totalInvested : 0;
  return (
    <View style={styles.portfolioRow}>
      <View style={styles.portfolioHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.portfolioName}>{startup.name}</Text>
          <Text style={styles.portfolioMeta}>
            {startup.stage} · {fmtPct(startup.ownership, 1)} Anteil · Bewertung {fmtMoney(startup.valuation)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.holdingValue}>{fmtMoney(holding)}</Text>
          <Text style={[styles.moic, { color: moic >= 1 ? colors.positive : colors.negative }]}>{fmtMultiple(moic)}</Text>
        </View>
      </View>
      <View style={styles.healthBarRow}>
        <Text style={styles.healthBarLabel}>Health</Text>
        <View style={{ flex: 1 }}>
          <ProgressBar value={startup.health} color={healthColor(startup.health)} />
        </View>
      </View>
      <Text style={styles.portfolioHint}>
        Eingesetzt {fmtMoney(startup.totalInvested)} · Runway {(startup.runwayCash / Math.max(1, startup.burnRate)).toFixed(1)} Q
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  nav: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: spacing.sm },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  deal: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  dealHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  dealName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  dealMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  dealHint: { color: colors.textMuted, fontSize: 11, marginVertical: spacing.sm },
  healthCol: { alignItems: 'flex-end' },
  healthLabel: { color: colors.textMuted, fontSize: 10 },
  healthValue: { fontSize: 16, fontWeight: '800' },
  portfolioRow: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  portfolioHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  portfolioName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  portfolioMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  holdingValue: { color: colors.text, fontSize: 15, fontWeight: '800' },
  moic: { fontSize: 13, fontWeight: '700' },
  healthBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  healthBarLabel: { color: colors.textMuted, fontSize: 11, width: 48 },
  portfolioHint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm },
  closedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  closedName: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
