/** v2 Real estate: acquire property, collect rent, lever with mortgages, sell. */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { reMetrics } from '../realestate';
import { Property, PropertyDeal } from '../types';
import { PROPERTY_TYPE_LABEL } from '../labels';
import { SimHeader } from './SimHeader';
import { TabTip } from '../../components/TabTip';
import { notify } from '../../utils/notify';
import { useTr } from '../../i18n';
import { Button, Card, Pill, ProgressBar, SectionTitle, StatTile } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtMultiple, fmtPct } from '../../utils/format';

function occColor(o: number) {
  return o >= 0.9 ? colors.positive : o >= 0.75 ? colors.warning : colors.negative;
}

export function RealEstateScreen() {
  const t = useTr();
  const game = useSimStore((s) => s.game)!;
  const re = game.realEstate ?? { deals: [], portfolio: [], totalInvested: 0, totalReturned: 0, cashflows: [] };
  const metrics = useMemo(() => reMetrics(re, game.month), [re, game.month]);
  const active = re.portfolio.filter((p) => p.status === 'active');
  const sold = re.portfolio.filter((p) => p.status !== 'active');

  return (
    <View style={styles.container}>
      <SimHeader title={t({ de: 'Immobilien', en: 'Real Estate' })} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TabTip tipKey="realestate" text={t({ de: 'Kaufe Objekte für laufende Mieterträge. Werte steigen im Aufschwung und fallen bei steigenden Zinsen. Eine Hypothek hebelt die Rendite — und das Risiko. Verkaufen ist illiquide (Abschlag, in Krisen mehr).', en: 'Buy property for ongoing rental income. Values rise in upswings and fall as rates rise. A mortgage levers returns — and risk. Selling is illiquid (a discount, more in a crisis).' })} />

        <Card>
          <SectionTitle>{t({ de: 'Immobilien-Portfolio', en: 'Property portfolio' })}</SectionTitle>
          <Text style={styles.big}>{fmtMoney(metrics.equity)}</Text>
          <View style={styles.statRow}>
            <StatTile label={t({ de: 'Mietertrag/Mon.', en: 'Rent/mo.' })} value={fmtMoney(metrics.monthlyIncome)} valueColor={metrics.monthlyIncome >= 0 ? colors.positive : colors.negative} />
            <StatTile label="IRR" value={fmtPct(metrics.irr)} valueColor={metrics.irr >= 0 ? colors.positive : colors.negative} />
            <StatTile label="MOIC" value={fmtMultiple(metrics.moic)} />
            <StatTile label={t({ de: 'Objekte', en: 'Assets' })} value={`${metrics.activeCount}`} />
          </View>
          <Text style={styles.hint}>{t({ de: 'Fonds-Cash für Käufe', en: 'Fund cash for purchases' })}: {fmtMoney(game.portfolio.cash)}</Text>
        </Card>

        <Card>
          <SectionTitle ornament>{t({ de: 'Dein Bestand', en: 'Your holdings' })} ({active.length})</SectionTitle>
          {active.length === 0 ? (
            <Text style={styles.empty}>{t({ de: 'Noch kein Objekt. Kaufe unten am Markt.', en: 'No property yet. Buy from the market below.' })}</Text>
          ) : (
            active.map((p) => <HoldingCard key={p.id} p={p} />)
          )}
        </Card>

        {sold.length > 0 ? (
          <Card>
            <SectionTitle>{t({ de: 'Verkauft', en: 'Sold' })} ({sold.length})</SectionTitle>
            {sold.map((p) => (
              <View key={p.id} style={styles.closedRow}>
                <Text style={styles.closedName}>{p.name}</Text>
                <Pill text={t(PROPERTY_TYPE_LABEL[p.type])} color={colors.textMuted} />
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <SectionTitle ornament>{t({ de: 'Markt', en: 'Market' })}</SectionTitle>
          {re.deals.map((d) => (
            <DealRow key={d.id} d={d} cash={game.portfolio.cash} />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function HoldingCard({ p }: { p: Property }) {
  const t = useTr();
  const sell = useSimStore((s) => s.sellProperty);
  const equity = Math.max(0, p.value - p.debt);
  const moic = p.invested > 0 ? equity / p.invested : 0;

  return (
    <View style={styles.su}>
      <View style={styles.suHead}>
        <Text style={styles.suName}>{p.name}</Text>
        <Pill text={t(PROPERTY_TYPE_LABEL[p.type])} color={colors.textMuted} />
      </View>
      <View style={styles.statRow}>
        <StatTile label={t({ de: 'Wert', en: 'Value' })} value={fmtMoney(p.value)} />
        <StatTile label={t({ de: 'Eigenkapital', en: 'Equity' })} value={fmtMoney(equity)} hint={`${fmtMultiple(moic)} MOIC`} />
        <StatTile label={t({ de: 'Hypothek', en: 'Mortgage' })} value={p.debt > 0 ? fmtMoney(p.debt) : '—'} />
      </View>
      <View style={styles.healthRow}>
        <Text style={styles.healthLabel}>{t({ de: 'Belegung', en: 'Occupancy' })}</Text>
        <View style={{ flex: 1 }}><ProgressBar value={p.occupancy} color={occColor(p.occupancy)} /></View>
        <Text style={styles.supportLabel}>{(p.occupancy * 100).toFixed(0)}% · {fmtPct(p.capRate)}</Text>
      </View>
      <Button
        title={t({ de: 'Verkaufen', en: 'Sell' })}
        variant="secondary"
        onPress={() => { const r = sell(p.id); if (!r.ok) notify(t({ de: 'Nicht möglich', en: 'Not possible' }), r.error ?? ''); }}
        style={{ marginTop: spacing.sm }}
      />
      <Text style={styles.secondaryHint}>{t({ de: 'Verkauf: 3% Kosten, in Krisen +5% Abschlag, abzügl. Hypothek.', en: 'Sale: 3% costs, +5% discount in a crisis, net of mortgage.' })}</Text>
    </View>
  );
}

function DealRow({ d, cash }: { d: PropertyDeal; cash: number }) {
  const t = useTr();
  const buy = useSimStore((s) => s.buyProperty);
  const down = d.price * 0.5;
  const canCash = cash >= d.price;
  const canMortgage = cash >= down;

  return (
    <View style={styles.deal}>
      <View style={styles.suHead}>
        <Text style={styles.suName}>{d.name}</Text>
        <Pill text={t(PROPERTY_TYPE_LABEL[d.type])} color={colors.textMuted} />
      </View>
      <Text style={styles.dealMeta}>
        {t({ de: 'Preis', en: 'Price' })} {fmtMoney(d.price)} · {t({ de: 'Cap-Rate', en: 'Cap rate' })} {fmtPct(d.capRate)} · {t({ de: 'Qualität', en: 'Quality' })} {(d.quality * 100).toFixed(0)}
      </Text>
      <View style={styles.btnRow}>
        <Button
          title={`${t({ de: 'Bar kaufen', en: 'Buy cash' })} ${fmtMoney(d.price)}`}
          variant="positive"
          disabled={!canCash}
          onPress={() => { const r = buy(d.id, false); if (!r.ok) notify(t({ de: 'Nicht möglich', en: 'Not possible' }), r.error ?? ''); }}
          style={styles.smallBtn}
        />
        <Button
          title={`${t({ de: 'Mit Hypothek', en: 'Mortgage' })} ${fmtMoney(down)}`}
          variant="secondary"
          disabled={!canMortgage}
          onPress={() => { const r = buy(d.id, true); if (!r.ok) notify(t({ de: 'Nicht möglich', en: 'Not possible' }), r.error ?? ''); }}
          style={styles.smallBtn}
        />
      </View>
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
  healthLabel: { color: colors.textMuted, fontSize: 11, width: 64 },
  supportLabel: { color: colors.textMuted, fontSize: 11, width: 96, textAlign: 'right' },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryHint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  smallBtn: { flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  closedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.ruleSoft },
  closedName: { color: colors.text, fontSize: 14, fontFamily: fonts.serifBold },
});
