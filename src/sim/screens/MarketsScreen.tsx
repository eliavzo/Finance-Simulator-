/** v2 Markets: trade equities, bonds, FX, commodities (long/short + leverage)
 *  and buy options; manage the open book. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSimStore } from '../store';
import { positionEquity, positionPnl } from '../portfolio';
import { STANCE_LABEL } from '../research';
import { valuationGap, sectorOutlooks } from '../fundamentals';
import { tierPerks } from '../tiers';
import { EquityInstrument, Instrument, InstrumentKind, ResearchSignal } from '../types';
import { SimHeader } from './SimHeader';
import { TabTip } from '../../components/TabTip';
import { notify } from '../../utils/notify';
import { Button, Card, Pill, SectionTitle } from '../../components/ui';
import { Segmented, LeverageSelector, AmountStepper } from '../../components/controls';
import { LineChart } from '../../components/LineChart';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtNum, fmtPctSigned } from '../../utils/format';

const KIND_LABEL: Record<InstrumentKind, string> = {
  equity: 'Aktien', bond: 'Anleihen', fx: 'FX', commodity: 'Rohstoffe', option: 'Optionen',
};

export function MarketsScreen() {
  const game = useSimStore((s) => s.game)!;
  const trade = useSimStore((s) => s.trade);
  const closeTrade = useSimStore((s) => s.closeTrade);
  const buyOption = useSimStore((s) => s.buyOption);
  const { width } = useWindowDimensions();

  const [kind, setKind] = useState<InstrumentKind>('equity');
  const tradables = game.instruments.filter((i) => i.kind === kind);
  const [selectedId, setSelectedId] = useState<string>(tradables[0]?.id ?? game.instruments[0].id);
  const selected = game.instruments.find((i) => i.id === selectedId) ?? tradables[0];

  const [side, setSide] = useState<'long' | 'short'>('long');
  const [leverage, setLeverage] = useState(1);
  const [notional, setNotional] = useState(500_000);

  // Option ticket
  const [optType, setOptType] = useState<'call' | 'put'>('call');
  const [optExpiry, setOptExpiry] = useState(3);
  const [optContracts, setOptContracts] = useState(20);

  const priceOf = (id: string) => game.instruments.find((i) => i.id === id)?.price ?? 0;

  const submitTrade = () => {
    if (!selected) return;
    const qty = (notional / selected.price) * (side === 'short' ? -1 : 1);
    const res = trade(selected.id, qty, leverage);
    if (!res.ok) notify('Order abgelehnt', res.error ?? 'Fehler');
  };

  const submitOption = () => {
    if (!selected || selected.kind !== 'equity') return;
    const offset = optType === 'call' ? 0.05 : -0.05;
    const res = buyOption(selected.id, optType, offset, optExpiry, optContracts);
    if (!res.ok) notify('Order abgelehnt', res.error ?? 'Fehler');
  };

  const cap = useMemo(() => game.portfolio.cash, [game.portfolio.cash]);
  const perks = tierPerks(game.peakReputation ?? game.reputation);

  return (
    <View style={styles.container}>
      <SimHeader title="Markt" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TabTip tipKey="markt" text="Kaufe Aktien unter ihrem fairen Wert („günstig“) und meide teure. Long/Short mit Hebel; die Research-Tipps deines Teams helfen bei der Auswahl." />
        <Card>
          <SectionTitle>Fonds-Cash: {fmtMoney(cap)}</SectionTitle>
          <Segmented<InstrumentKind>
            value={kind === 'option' ? 'equity' : kind}
            onChange={(k) => {
              setKind(k);
              const first = game.instruments.find((i) => i.kind === k);
              if (first) setSelectedId(first.id);
            }}
            options={(['equity', 'bond', 'fx', 'commodity'] as InstrumentKind[]).map((k) => ({ label: KIND_LABEL[k], value: k }))}
          />
        </Card>

        <Card>
          <SectionTitle ornament>Research-Tipps des Hauses</SectionTitle>
          {game.signals.length === 0 ? (
            <Text style={styles.empty}>Kein Research-Team — stelle Analysten oder Quants ein (Firma), um Tipps zu erhalten.</Text>
          ) : (
            game.signals.map((sig) => (
              <SignalRow
                key={sig.instrumentId}
                sig={sig}
                onSelect={() => {
                  const inst = game.instruments.find((i) => i.id === sig.instrumentId);
                  if (inst) {
                    setKind(inst.kind);
                    setSelectedId(inst.id);
                  }
                }}
              />
            ))
          )}
        </Card>

        <Card>
          <SectionTitle ornament>Sektor-Ausblick (Makro)</SectionTitle>
          {sectorOutlooks(game.economy, (game.instruments.find((i) => i.symbol === 'OIL')?.price ?? 75) / 75).map((o) => (
            <View key={o.sector} style={styles.outlookRow}>
              <Text style={styles.outlookSector}>{o.sector}</Text>
              <Text style={styles.outlookDriver}>{o.driver}</Text>
              <Text style={[styles.outlookBias, { color: o.bias >= 0 ? colors.positive : colors.negative }]}>
                {o.bias >= 0.15 ? 'Rückenwind' : o.bias <= -0.15 ? 'Gegenwind' : 'Neutral'}
              </Text>
            </View>
          ))}
        </Card>

        {selected ? (
          <Card>
            <SectionTitle>{selected.symbol} · {fmtMoney(selected.price)}</SectionTitle>
            <View style={styles.chartWrap}>
              <LineChart
                data={selected.priceHistory.slice(-36)}
                width={width - spacing.lg * 4}
                height={80}
                color={colors.primary}
                baseline={selected.kind === 'equity' ? (selected as EquityInstrument).fairValue : undefined}
              />
            </View>
            {selected.kind === 'equity' ? <Fundamentals eq={selected as EquityInstrument} /> : null}

            <Text style={styles.label}>Richtung</Text>
            <Segmented<'long' | 'short'>
              value={side}
              onChange={setSide}
              options={[{ label: 'LONG', value: 'long', color: colors.long }, { label: 'SHORT', value: 'short', color: colors.short }]}
            />
            <Text style={styles.label}>Hebel (bis {perks.maxLeverage}× · Stufe {perks.label})</Text>
            <LeverageSelector value={Math.min(leverage, perks.maxLeverage)} onChange={setLeverage} max={perks.maxLeverage} />
            <Text style={styles.label}>Notional (Margin {fmtMoney(notional / leverage)})</Text>
            <AmountStepper value={notional} onChange={setNotional} step={250_000} min={50_000} max={cap * leverage} />
            <Button title={`${side.toUpperCase()} ${selected.symbol} @ ${leverage}x`} onPress={submitTrade} variant={side === 'long' ? 'positive' : 'negative'} style={{ marginTop: spacing.md }} />

            {selected.kind === 'equity' && !perks.allowOptions ? (
              <View style={styles.optBox}>
                <Text style={styles.lockNote}>🔒 Optionshandel ab Stufe „Aufstrebend" (Reputation 55).</Text>
              </View>
            ) : null}
            {selected.kind === 'equity' && perks.allowOptions ? (
              <View style={styles.optBox}>
                <SectionTitle>Option kaufen (5% OTM)</SectionTitle>
                <Segmented<'call' | 'put'>
                  value={optType}
                  onChange={setOptType}
                  options={[{ label: 'CALL', value: 'call', color: colors.long }, { label: 'PUT', value: 'put', color: colors.short }]}
                />
                <Text style={styles.label}>Laufzeit</Text>
                <AmountStepper value={optExpiry} onChange={(v) => setOptExpiry(Math.max(1, Math.min(24, v)))} step={1} min={1} max={24} format={(v) => `${v} Mon.`} />
                <Text style={styles.label}>Kontrakte (×100 Aktien)</Text>
                <AmountStepper value={optContracts} onChange={(v) => setOptContracts(Math.max(1, v))} step={5} min={1} max={500} format={(v) => `${v}`} />
                <Button title={`${optType.toUpperCase()} kaufen`} onPress={submitOption} variant="secondary" style={{ marginTop: spacing.sm }} />
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <SectionTitle>{KIND_LABEL[kind === 'option' ? 'equity' : kind]}</SectionTitle>
          {tradables.map((inst) => (
            <InstrumentRow key={inst.id} inst={inst} active={inst.id === selectedId} onSelect={() => setSelectedId(inst.id)} />
          ))}
        </Card>

        <Card>
          <SectionTitle>Offene Positionen ({game.portfolio.positions.length})</SectionTitle>
          {game.portfolio.positions.length === 0 ? (
            <Text style={styles.empty}>Keine offenen Positionen.</Text>
          ) : (
            game.portfolio.positions.map((p) => {
              const price = priceOf(p.instrumentId);
              const pnl = positionPnl(p, price);
              const ret = p.margin > 0 ? pnl / p.margin : 0;
              return (
                <View key={p.id} style={styles.pos}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.posHead}>
                      <Text style={styles.posSym}>{p.symbol}</Text>
                      <Pill text={`${p.quantity >= 0 ? 'LONG' : 'SHORT'} ${p.leverage}x`} color={p.quantity >= 0 ? colors.long : colors.short} />
                    </View>
                    <Text style={styles.posMeta}>Einstieg {fmtMoney(p.entryPrice)} · jetzt {fmtMoney(price)} · Margin {fmtMoney(p.margin)}</Text>
                    <Text style={[styles.posPnl, { color: pnl >= 0 ? colors.positive : colors.negative }]}>{fmtMoney(pnl)} ({fmtPctSigned(ret)})</Text>
                  </View>
                  <Button title="Schließen" variant="secondary" onPress={() => closeTrade(p.id)} style={styles.closeBtn} />
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function Fundamentals({ eq }: { eq: EquityInstrument }) {
  const pe = eq.eps > 0 ? eq.price / eq.eps : 0;
  const gap = valuationGap(eq.price, eq.fairValue);
  const cheap = gap > 0.05;
  const dear = gap < -0.05;
  return (
    <View style={styles.funda}>
      <View style={styles.fundaRow}>
        <Text style={styles.fundaItem}>KGV <Text style={styles.fundaVal}>{pe.toFixed(1)}</Text></Text>
        <Text style={styles.fundaItem}>Wachstum <Text style={styles.fundaVal}>{(eq.epsGrowth * 100).toFixed(0)}%</Text></Text>
        <Text style={styles.fundaItem}>Fair <Text style={styles.fundaVal}>{fmtMoney(eq.fairValue)}</Text></Text>
      </View>
      <Text style={[styles.fundaTag, { color: cheap ? colors.positive : dear ? colors.negative : colors.textMuted }]}>
        {cheap ? `Unterbewertet um ${(gap * 100).toFixed(0)}% — günstig` : dear ? `Überbewertet um ${(-gap * 100).toFixed(0)}% — teuer` : 'Fair bewertet'}
      </Text>
    </View>
  );
}

function SignalRow({ sig, onSelect }: { sig: ResearchSignal; onSelect: () => void }) {
  const over = sig.stance === 'overweight';
  const color = over ? colors.positive : colors.negative;
  return (
    <TouchableOpacity style={styles.signalRow} onPress={onSelect} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <View style={styles.signalHead}>
          <Text style={styles.signalSym}>{sig.symbol}</Text>
          <Pill text={STANCE_LABEL[sig.stance]} color={color} />
        </View>
        <Text style={styles.signalNote}>{sig.note}</Text>
      </View>
      <Text style={[styles.signalConv, { color }]}>{Math.round(sig.conviction * 100)}</Text>
    </TouchableOpacity>
  );
}

function InstrumentRow({ inst, active, onSelect }: { inst: Instrument; active: boolean; onSelect: () => void }) {
  const hist = inst.priceHistory;
  const change = hist.length >= 2 ? inst.price / hist[hist.length - 2] - 1 : 0;
  const eqGap = inst.kind === 'equity' ? valuationGap(inst.price, inst.fairValue) : 0;
  const sub =
    inst.kind === 'equity' ? `${inst.sector} · ${eqGap > 0.05 ? `−${(eqGap * 100).toFixed(0)}% z. fair (günstig)` : eqGap < -0.05 ? `+${(-eqGap * 100).toFixed(0)}% z. fair (teuer)` : 'fair'}` :
    inst.kind === 'bond' ? `${inst.rating} · ${inst.maturityYears}Y · YTM ${(inst.ytm * 100).toFixed(1)}%` :
    inst.kind === 'fx' ? 'FX' :
    inst.kind === 'commodity' ? 'Rohstoff' : 'Option';
  return (
    <TouchableOpacity style={[styles.row, active && styles.rowActive]} onPress={onSelect} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowSym}>{inst.symbol}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <LineChart data={hist.slice(-12)} width={56} height={24} fill={false} color={change >= 0 ? colors.positive : colors.negative} />
      <View style={styles.rowPriceCol}>
        <Text style={styles.rowPrice}>{fmtMoney(inst.price)}</Text>
        <Text style={[styles.rowChange, { color: change >= 0 ? colors.positive : colors.negative }]}>{fmtPctSigned(change)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  chartWrap: { alignItems: 'center', marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '700' },
  optBox: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  lockNote: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 8, gap: spacing.sm },
  rowActive: { backgroundColor: colors.surfaceAlt },
  rowSym: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 11 },
  rowPriceCol: { alignItems: 'flex-end', minWidth: 78 },
  rowPrice: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowChange: { fontSize: 12, fontWeight: '600' },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  funda: { marginTop: spacing.xs, marginBottom: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.ruleSoft },
  fundaRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  fundaItem: { color: colors.textMuted, fontSize: 12 },
  fundaVal: { color: colors.text, fontFamily: fonts.serifBold },
  fundaTag: { fontFamily: fonts.serifBold, fontSize: 13, marginTop: spacing.xs },
  outlookRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.ruleSoft, gap: spacing.sm },
  outlookSector: { color: colors.text, fontSize: 13, fontFamily: fonts.serifBold, width: 96 },
  outlookDriver: { color: colors.textMuted, fontSize: 11, flex: 1 },
  outlookBias: { fontSize: 12, fontFamily: fonts.serifBold },
  signalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  signalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  signalSym: { color: colors.text, fontSize: 14, fontWeight: '700' },
  signalNote: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  signalConv: { fontSize: 18, fontFamily: fonts.display, minWidth: 30, textAlign: 'right' },
  pos: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  posHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posSym: { color: colors.text, fontSize: 15, fontWeight: '800' },
  posMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  posPnl: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  closeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
