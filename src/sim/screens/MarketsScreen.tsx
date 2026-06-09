/** v2 Markets: trade equities, bonds, FX, commodities (long/short + leverage)
 *  and buy options; manage the open book. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSimStore } from '../store';
import { positionEquity, positionPnl } from '../portfolio';
import { STANCE_LABEL, researchNote } from '../research';
import { valuationGap, sectorOutlooks } from '../fundamentals';
import { tierPerks } from '../tiers';
import { KIND_LABEL_PLURAL, SECTOR_LABEL } from '../labels';
import { EquityInstrument, Instrument, InstrumentKind, ResearchSignal } from '../types';
import { SimHeader } from './SimHeader';
import { TabTip } from '../../components/TabTip';
import { notify } from '../../utils/notify';
import { useTr, useLang, Lang } from '../../i18n';
import { Button, Card, Pill, SectionTitle } from '../../components/ui';
import { Segmented, LeverageSelector, AmountStepper } from '../../components/controls';
import { LineChart } from '../../components/LineChart';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtNum, fmtPctSigned } from '../../utils/format';

export function MarketsScreen() {
  const t = useTr();
  const lang = useLang();
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
    if (!res.ok) notify(t({ de: 'Order abgelehnt', en: 'Order rejected' }), res.error ?? t({ de: 'Fehler', en: 'Error' }));
  };

  const submitOption = () => {
    if (!selected || selected.kind !== 'equity') return;
    const offset = optType === 'call' ? 0.05 : -0.05;
    const res = buyOption(selected.id, optType, offset, optExpiry, optContracts);
    if (!res.ok) notify(t({ de: 'Order abgelehnt', en: 'Order rejected' }), res.error ?? t({ de: 'Fehler', en: 'Error' }));
  };

  const cap = useMemo(() => game.portfolio.cash, [game.portfolio.cash]);
  const perks = tierPerks(game.peakReputation ?? game.reputation);

  return (
    <View style={styles.container}>
      <SimHeader title={t({ de: 'Markt', en: 'Markets' })} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TabTip tipKey="markt" text={t({ de: 'Kaufe Aktien unter ihrem fairen Wert („günstig“) und meide teure. Long/Short mit Hebel; die Research-Tipps deines Teams helfen bei der Auswahl.', en: 'Buy stocks below their fair value ("cheap") and avoid expensive ones. Long/short with leverage; your team\'s research tips help with selection.' })} />
        <Card>
          <SectionTitle>{t({ de: 'Fonds-Cash', en: 'Fund cash' })}: {fmtMoney(cap)}</SectionTitle>
          <Segmented<InstrumentKind>
            value={kind === 'option' ? 'equity' : kind}
            onChange={(k) => {
              setKind(k);
              const first = game.instruments.find((i) => i.kind === k);
              if (first) setSelectedId(first.id);
            }}
            options={(['equity', 'bond', 'fx', 'commodity'] as InstrumentKind[]).map((k) => ({ label: t(KIND_LABEL_PLURAL[k]), value: k }))}
          />
        </Card>

        <Card>
          <SectionTitle ornament>{t({ de: 'Research-Tipps des Hauses', en: 'In-house research tips' })}</SectionTitle>
          {game.signals.length === 0 ? (
            <Text style={styles.empty}>{t({ de: 'Kein Research-Team — stelle Analysten oder Quants ein (Firma), um Tipps zu erhalten.', en: 'No research team — hire analysts or quants (Firm) to receive tips.' })}</Text>
          ) : (
            game.signals.map((sig) => (
              <SignalRow
                key={sig.instrumentId}
                sig={sig}
                inst={game.instruments.find((i) => i.id === sig.instrumentId)}
                lang={lang}
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
          <SectionTitle ornament>{t({ de: 'Sektor-Ausblick (Makro)', en: 'Sector outlook (macro)' })}</SectionTitle>
          {sectorOutlooks(game.economy, (game.instruments.find((i) => i.symbol === 'OIL')?.price ?? 75) / 75).map((o) => (
            <View key={o.sector} style={styles.outlookRow}>
              <Text style={styles.outlookSector}>{t(SECTOR_LABEL[o.sector])}</Text>
              <Text style={styles.outlookDriver}>{o.driver}</Text>
              <Text style={[styles.outlookBias, { color: o.bias >= 0 ? colors.positive : colors.negative }]}>
                {o.bias >= 0.15 ? t({ de: 'Rückenwind', en: 'Tailwind' }) : o.bias <= -0.15 ? t({ de: 'Gegenwind', en: 'Headwind' }) : t({ de: 'Neutral', en: 'Neutral' })}
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

            <Text style={styles.label}>{t({ de: 'Richtung', en: 'Direction' })}</Text>
            <Segmented<'long' | 'short'>
              value={side}
              onChange={setSide}
              options={[{ label: 'LONG', value: 'long', color: colors.long }, { label: 'SHORT', value: 'short', color: colors.short }]}
            />
            <Text style={styles.label}>{t({ de: 'Hebel', en: 'Leverage' })} ({t({ de: 'bis', en: 'up to' })} {perks.maxLeverage}× · {t({ de: 'Stufe', en: 'Tier' })} {perks.label})</Text>
            <LeverageSelector value={Math.min(leverage, perks.maxLeverage)} onChange={setLeverage} max={perks.maxLeverage} />
            <Text style={styles.label}>Notional (Margin {fmtMoney(notional / leverage)})</Text>
            <AmountStepper value={notional} onChange={setNotional} step={250_000} min={50_000} max={cap * leverage} />
            <Button title={`${side.toUpperCase()} ${selected.symbol} @ ${leverage}x`} onPress={submitTrade} variant={side === 'long' ? 'positive' : 'negative'} style={{ marginTop: spacing.md }} />

            {selected.kind === 'equity' && !perks.allowOptions ? (
              <View style={styles.optBox}>
                <Text style={styles.lockNote}>{t({ de: '🔒 Optionshandel ab Stufe „Aufstrebend" (Reputation 55).', en: '🔒 Options trading unlocks at the "Rising" tier (reputation 55).' })}</Text>
              </View>
            ) : null}
            {selected.kind === 'equity' && perks.allowOptions ? (
              <View style={styles.optBox}>
                <SectionTitle>{t({ de: 'Option kaufen (5% OTM)', en: 'Buy option (5% OTM)' })}</SectionTitle>
                <Segmented<'call' | 'put'>
                  value={optType}
                  onChange={setOptType}
                  options={[{ label: 'CALL', value: 'call', color: colors.long }, { label: 'PUT', value: 'put', color: colors.short }]}
                />
                <Text style={styles.label}>{t({ de: 'Laufzeit', en: 'Maturity' })}</Text>
                <AmountStepper value={optExpiry} onChange={(v) => setOptExpiry(Math.max(1, Math.min(24, v)))} step={1} min={1} max={24} format={(v) => `${v} ${t({ de: 'Mon.', en: 'mo.' })}`} />
                <Text style={styles.label}>{t({ de: 'Kontrakte (×100 Aktien)', en: 'Contracts (×100 shares)' })}</Text>
                <AmountStepper value={optContracts} onChange={(v) => setOptContracts(Math.max(1, v))} step={5} min={1} max={500} format={(v) => `${v}`} />
                <Button title={`${optType.toUpperCase()} ${t({ de: 'kaufen', en: 'buy' })}`} onPress={submitOption} variant="secondary" style={{ marginTop: spacing.sm }} />
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <SectionTitle>{t(KIND_LABEL_PLURAL[kind === 'option' ? 'equity' : kind])}</SectionTitle>
          {tradables.map((inst) => (
            <InstrumentRow key={inst.id} inst={inst} active={inst.id === selectedId} onSelect={() => setSelectedId(inst.id)} />
          ))}
        </Card>

        <Card>
          <SectionTitle>{t({ de: 'Offene Positionen', en: 'Open positions' })} ({game.portfolio.positions.length})</SectionTitle>
          {game.portfolio.positions.length === 0 ? (
            <Text style={styles.empty}>{t({ de: 'Keine offenen Positionen.', en: 'No open positions.' })}</Text>
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
                    <Text style={styles.posMeta}>{t({ de: 'Einstieg', en: 'Entry' })} {fmtMoney(p.entryPrice)} · {t({ de: 'jetzt', en: 'now' })} {fmtMoney(price)} · Margin {fmtMoney(p.margin)}</Text>
                    <Text style={[styles.posPnl, { color: pnl >= 0 ? colors.positive : colors.negative }]}>{fmtMoney(pnl)} ({fmtPctSigned(ret)})</Text>
                  </View>
                  <Button title={t({ de: 'Schließen', en: 'Close' })} variant="secondary" onPress={() => closeTrade(p.id)} style={styles.closeBtn} />
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
  const t = useTr();
  const pe = eq.eps > 0 ? eq.price / eq.eps : 0;
  const gap = valuationGap(eq.price, eq.fairValue);
  const cheap = gap > 0.05;
  const dear = gap < -0.05;
  return (
    <View style={styles.funda}>
      <View style={styles.fundaRow}>
        <Text style={styles.fundaItem}>{t({ de: 'KGV', en: 'P/E' })} <Text style={styles.fundaVal}>{pe.toFixed(1)}</Text></Text>
        <Text style={styles.fundaItem}>{t({ de: 'Wachstum', en: 'Growth' })} <Text style={styles.fundaVal}>{(eq.epsGrowth * 100).toFixed(0)}%</Text></Text>
        <Text style={styles.fundaItem}>{t({ de: 'Fair', en: 'Fair' })} <Text style={styles.fundaVal}>{fmtMoney(eq.fairValue)}</Text></Text>
      </View>
      <Text style={[styles.fundaTag, { color: cheap ? colors.positive : dear ? colors.negative : colors.textMuted }]}>
        {cheap
          ? t({ de: `Unterbewertet um ${(gap * 100).toFixed(0)}% — günstig`, en: `Undervalued by ${(gap * 100).toFixed(0)}% — cheap` })
          : dear
            ? t({ de: `Überbewertet um ${(-gap * 100).toFixed(0)}% — teuer`, en: `Overvalued by ${(-gap * 100).toFixed(0)}% — expensive` })
            : t({ de: 'Fair bewertet', en: 'Fairly valued' })}
      </Text>
    </View>
  );
}

function SignalRow({ sig, inst, lang, onSelect }: { sig: ResearchSignal; inst?: Instrument; lang: Lang; onSelect: () => void }) {
  const t = useTr();
  const over = sig.stance === 'overweight';
  const color = over ? colors.positive : colors.negative;
  const note = inst ? researchNote(inst, sig.stance, sig.conviction, lang) : sig.note;
  return (
    <TouchableOpacity style={styles.signalRow} onPress={onSelect} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <View style={styles.signalHead}>
          <Text style={styles.signalSym}>{sig.symbol}</Text>
          <Pill text={t(STANCE_LABEL[sig.stance])} color={color} />
        </View>
        <Text style={styles.signalNote}>{note}</Text>
      </View>
      <Text style={[styles.signalConv, { color }]}>{Math.round(sig.conviction * 100)}</Text>
    </TouchableOpacity>
  );
}

function InstrumentRow({ inst, active, onSelect }: { inst: Instrument; active: boolean; onSelect: () => void }) {
  const t = useTr();
  const hist = inst.priceHistory;
  const change = hist.length >= 2 ? inst.price / hist[hist.length - 2] - 1 : 0;
  const eqGap = inst.kind === 'equity' ? valuationGap(inst.price, inst.fairValue) : 0;
  const sub =
    inst.kind === 'equity' ? `${t(SECTOR_LABEL[inst.sector])} · ${eqGap > 0.05 ? t({ de: `−${(eqGap * 100).toFixed(0)}% z. fair (günstig)`, en: `−${(eqGap * 100).toFixed(0)}% vs. fair (cheap)` }) : eqGap < -0.05 ? t({ de: `+${(-eqGap * 100).toFixed(0)}% z. fair (teuer)`, en: `+${(-eqGap * 100).toFixed(0)}% vs. fair (expensive)` }) : t({ de: 'fair', en: 'fair' })}` :
    inst.kind === 'bond' ? `${inst.rating} · ${inst.maturityYears}Y · YTM ${(inst.ytm * 100).toFixed(1)}%` :
    inst.kind === 'fx' ? 'FX' :
    inst.kind === 'commodity' ? t({ de: 'Rohstoff', en: 'Commodity' }) : t({ de: 'Option', en: 'Option' });
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
