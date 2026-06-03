/** Hedge Fund desk: market watchlist, position opener (long/short + leverage)
 *  and the live book with mark-to-market P/L and margin-call risk. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { notify } from '../utils/notify';
import { useGameStore } from '../store/gameStore';
import { GameHeader } from '../components/GameHeader';
import { Button, Card, Pill, SectionTitle, StatTile } from '../components/ui';
import { Segmented, LeverageSelector, AmountStepper } from '../components/controls';
import { LineChart } from '../components/LineChart';
import { hedgeFundNav, hedgeFundRiskMetrics, positionEquity, positionPnl } from '../engine/hedgefund';
import { colors, spacing } from '../utils/theme';
import { fmtMoney, fmtNum, fmtPct, fmtPctSigned } from '../utils/format';
import { MarketAsset, PositionSide } from '../models/types';

export function HedgeFundScreen() {
  const game = useGameStore((s) => s.game)!;
  const open = useGameStore((s) => s.openHedgePosition);
  const close = useGameStore((s) => s.closeHedgePosition);
  const { width } = useWindowDimensions();

  const hf = game.hedgeFund;
  const nav = useMemo(() => hedgeFundNav(hf, game.assets), [hf, game.assets]);
  const risk = useMemo(() => hedgeFundRiskMetrics(hf, game.macro.interestRate), [hf, game.macro.interestRate]);

  const [selectedId, setSelectedId] = useState<string>(game.assets[0].id);
  const [side, setSide] = useState<PositionSide>('long');
  const [leverage, setLeverage] = useState(1);
  const [notional, setNotional] = useState(1_000_000);

  const selected = game.assets.find((a) => a.id === selectedId)!;
  const priceOf = (id: string) => game.assets.find((a) => a.id === id)?.price ?? 0;

  const submit = () => {
    const res = open(selectedId, side, notional, leverage);
    if (!res.ok) {
      notify('Order abgelehnt', res.error ?? 'Unbekannter Fehler');
    }
  };

  return (
    <View style={styles.container}>
      <GameHeader title="Hedge Fund" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Book summary */}
        <Card>
          <SectionTitle>Book NAV</SectionTitle>
          <Text style={styles.nav}>{fmtMoney(nav)}</Text>
          <View style={styles.statRow}>
            <StatTile label="Cash" value={fmtMoney(hf.cash)} />
            <StatTile label="Sharpe" value={fmtNum(risk.sharpe)} />
            <StatTile label="Max DD" value={fmtPct(risk.maxDrawdown)} valueColor={colors.negative} />
            <StatTile label="VaR₉₅" value={fmtMoney(risk.var95)} valueColor={colors.warning} />
          </View>
          <Text style={styles.marginCalls}>Margin Calls insgesamt: {hf.marginCalls}</Text>
        </Card>

        {/* Order ticket */}
        <Card>
          <SectionTitle>Order eröffnen · {selected.ticker}</SectionTitle>
          <View style={styles.chartWrap}>
            <LineChart data={selected.priceHistory} width={width - spacing.lg * 4} height={90} color={colors.primary} />
          </View>
          <Text style={styles.price}>
            {selected.name} · {fmtMoney(selected.price)}{' '}
            <Text style={styles.vol}>σ {fmtPct(selected.volatility, 0)}</Text>
          </Text>

          <Text style={styles.label}>Richtung</Text>
          <Segmented<PositionSide>
            value={side}
            onChange={setSide}
            options={[
              { label: 'LONG', value: 'long', color: colors.long },
              { label: 'SHORT', value: 'short', color: colors.short },
            ]}
          />

          <Text style={styles.label}>Hebel</Text>
          <LeverageSelector value={leverage} onChange={setLeverage} />

          <Text style={styles.label}>Notional (Margin: {fmtMoney(notional / leverage)})</Text>
          <AmountStepper value={notional} onChange={setNotional} step={500_000} min={100_000} max={hf.cash * leverage} />

          <Button title={`${side.toUpperCase()} ${selected.ticker} @ ${leverage}x`} onPress={submit} variant={side === 'long' ? 'positive' : 'negative'} style={{ marginTop: spacing.md }} />
        </Card>

        {/* Watchlist */}
        <Card>
          <SectionTitle>Watchlist</SectionTitle>
          {game.assets.map((a) => (
            <AssetRow key={a.id} asset={a} active={a.id === selectedId} onSelect={() => setSelectedId(a.id)} />
          ))}
        </Card>

        {/* Open positions */}
        <Card>
          <SectionTitle>Offene Positionen ({hf.positions.length})</SectionTitle>
          {hf.positions.length === 0 ? (
            <Text style={styles.empty}>Keine offenen Positionen. Eröffne eine Order oben.</Text>
          ) : (
            hf.positions.map((p) => {
              const price = priceOf(p.assetId);
              const pnl = positionPnl(p, price);
              const equity = positionEquity(p, price);
              const retOnMargin = p.margin > 0 ? pnl / p.margin : 0;
              const atRisk = equity <= p.margin * 0.4;
              return (
                <View key={p.id} style={styles.position}>
                  <View style={styles.posLeft}>
                    <View style={styles.posTitleRow}>
                      <Text style={styles.posTicker}>{p.ticker}</Text>
                      <Pill text={`${p.side.toUpperCase()} ${p.leverage}x`} color={p.side === 'long' ? colors.long : colors.short} />
                      {atRisk ? <Pill text="MARGIN-RISIKO" color={colors.negative} /> : null}
                    </View>
                    <Text style={styles.posMeta}>
                      Einstieg {fmtMoney(p.entryPrice)} · jetzt {fmtMoney(price)} · Margin {fmtMoney(p.margin)}
                    </Text>
                    <Text style={[styles.posPnl, { color: pnl >= 0 ? colors.positive : colors.negative }]}>
                      {fmtMoney(pnl)} ({fmtPctSigned(retOnMargin)} auf Margin)
                    </Text>
                  </View>
                  <Button title="Schließen" variant="secondary" onPress={() => close(p.id)} style={styles.closeBtn} />
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function AssetRow({ asset, active, onSelect }: { asset: MarketAsset; active: boolean; onSelect: () => void }) {
  const hist = asset.priceHistory;
  const change = hist.length >= 2 ? asset.price / hist[hist.length - 2] - 1 : 0;
  return (
    <TouchableOpacity style={[styles.assetRow, active && styles.assetRowActive]} onPress={onSelect} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.assetTicker}>{asset.ticker}</Text>
        <Text style={styles.assetSector}>{asset.sector}</Text>
      </View>
      <View style={styles.assetSpark}>
        <LineChart data={hist.slice(-12)} width={64} height={28} fill={false} color={change >= 0 ? colors.positive : colors.negative} />
      </View>
      <View style={styles.assetPriceCol}>
        <Text style={styles.assetPrice}>{fmtMoney(asset.price)}</Text>
        <Text style={[styles.assetChange, { color: change >= 0 ? colors.positive : colors.negative }]}>{fmtPctSigned(change)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  nav: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: spacing.sm },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  marginCalls: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  chartWrap: { alignItems: 'center', marginBottom: spacing.sm },
  price: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  vol: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
  label: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '700' },
  assetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderRadius: 8, paddingHorizontal: spacing.sm },
  assetRowActive: { backgroundColor: colors.surfaceAlt },
  assetTicker: { color: colors.text, fontSize: 15, fontWeight: '700' },
  assetSector: { color: colors.textMuted, fontSize: 11 },
  assetSpark: { width: 64, marginHorizontal: spacing.sm },
  assetPriceCol: { alignItems: 'flex-end', minWidth: 76 },
  assetPrice: { color: colors.text, fontSize: 14, fontWeight: '700' },
  assetChange: { fontSize: 12, fontWeight: '600' },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  position: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  posLeft: { flex: 1, paddingRight: spacing.sm },
  posTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  posTicker: { color: colors.text, fontSize: 16, fontWeight: '800' },
  posMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  posPnl: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  closeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
