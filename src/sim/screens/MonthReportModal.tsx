/**
 * End-of-month "edition" — a newspaper-style summary shown after each month,
 * leading with the enterprise move and the biggest market swings so the player
 * can adjust their positioning (à la Coffee Inc's period report).
 */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { REGIME_LABEL } from '../economy';
import { MarketMover } from '../types';
import { Button, Rule } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtPct, fmtPctSigned } from '../../utils/format';

const BIG_MOVE = 0.1; // 10%+ is flagged as a major swing

export function MonthReportModal() {
  const game = useSimStore((s) => s.game);
  const pending = useSimStore((s) => s.pendingReportMonth);
  const dismiss = useSimStore((s) => s.dismissReport);

  const report = game?.lastReport;
  // Let any pending decision/opportunity be resolved first, then show the edition.
  const visible = pending !== null && !!report && report.month === pending && !game?.pendingDecision && !game?.pendingOpportunity;
  if (!report) return null;

  const year = Math.floor(report.month / 12) + 1;
  const m = (report.month % 12) + 1;
  const up = report.enterpriseChangePct >= 0;
  const bigMoves = [...report.gainers, ...report.losers].filter((x) => Math.abs(x.changePct) >= BIG_MOVE);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.masthead}>Die Finanz-Chronik</Text>
            <Text style={styles.dateline}>{`${(game?.firm.name ?? '').toUpperCase()} · JAHR ${year} · MONAT ${String(m).padStart(2, '0')} · ${REGIME_LABEL[report.regime].toUpperCase()}`}</Text>
            <Rule double />

            {/* Lead story */}
            <Text style={[styles.headline, { color: up ? colors.positive : colors.negative }]}>
              {up ? 'Unternehmenswert legt zu' : 'Unternehmenswert gibt nach'}
            </Text>
            <Text style={styles.lead}>
              Das Haus schließt den Monat bei <Text style={styles.bold}>{fmtMoney(report.enterpriseEnd)}</Text> —{' '}
              <Text style={{ color: up ? colors.positive : colors.negative, fontFamily: fonts.serifBold }}>{fmtPctSigned(report.enterpriseChangePct)}</Text>{' '}
              gegenüber dem Vormonat.
            </Text>

            {report.regimeChanged ? (
              <Banner text={`KONJUNKTURWENDE: ${REGIME_LABEL[report.regime].toUpperCase()}`} />
            ) : null}
            {report.blackSwan ? <Banner text="🦢 BLACK-SWAN-SCHOCK AN DEN MÄRKTEN" danger /> : null}

            {/* Market movers */}
            <SectionRule label="Marktbewegungen" />
            {bigMoves.length > 0 ? (
              <Text style={styles.alert}>
                Große Ausschläge — prüfe deine Positionen und das Research im Markt-Tab.
              </Text>
            ) : null}
            <View style={styles.moverCols}>
              <MoverColumn title="Gewinner" movers={report.gainers} positive />
              <MoverColumn title="Verlierer" movers={report.losers} positive={false} />
            </View>

            {/* Macro */}
            <SectionRule label="Konjunktur" />
            <Row label="Phase" value={REGIME_LABEL[report.regime]} highlight={report.regimeChanged} />
            <Row label="Leitzins" value={fmtPct(report.policyRate)} />
            <Row label="Vola-Index" value={report.volIndex.toFixed(0)} highlight={report.volIndex > 25} />

            {/* Your house */}
            <SectionRule label="Dein Haus" />
            <Row label="Fonds-Rendite (Monat)" value={fmtPctSigned(report.fundReturnPct)} color={report.fundReturnPct >= 0 ? colors.positive : colors.negative} />
            <Row label="Team-Alpha" value={fmtMoney(report.contribution.alphaPnl)} color={report.contribution.alphaPnl >= 0 ? colors.positive : colors.negative} />
            <Row label="GP-Ergebnis" value={fmtMoney(report.gpNetIncome)} color={report.gpNetIncome >= 0 ? colors.positive : colors.negative} />
            {report.contribution.capitalRaised > 0 ? <Row label="Kapital geraist" value={fmtMoney(report.contribution.capitalRaised)} /> : null}
            <Row label="Reputation" value={`${report.reputationDelta >= 0 ? '+' : ''}${report.reputationDelta.toFixed(1)}`} color={report.reputationDelta >= 0 ? colors.positive : colors.negative} />

            {/* Headlines */}
            {report.headlines.length > 0 ? (
              <>
                <SectionRule label="Meldungen" />
                {report.headlines.map((h, i) => (
                  <View key={i} style={styles.headlineRow}>
                    <Text style={styles.hlTitle}>{h.title}</Text>
                    <Text style={styles.hlDesc}>{h.description}</Text>
                  </View>
                ))}
              </>
            ) : null}

            <Button title="Gelesen ▸" onPress={dismiss} variant="primary" style={{ marginTop: spacing.lg }} />
            <Text style={styles.colophon}>Alpha &amp; Carry · Die Finanz-Chronik</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Banner({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <View style={[styles.banner, { borderColor: danger ? colors.negative : colors.accent }]}>
      <Text style={[styles.bannerText, { color: danger ? colors.negative : colors.accent }]}>{text}</Text>
    </View>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <View style={styles.sectionRule}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Rule />
    </View>
  );
}

function MoverColumn({ title, movers, positive }: { title: string; movers: MarketMover[]; positive: boolean }) {
  const color = positive ? colors.positive : colors.negative;
  return (
    <View style={styles.moverCol}>
      <Text style={[styles.moverTitle, { color }]}>{title}</Text>
      {movers.length === 0 ? <Text style={styles.moverEmpty}>—</Text> : null}
      {movers.map((mv) => {
        const big = Math.abs(mv.changePct) >= BIG_MOVE;
        return (
          <View key={mv.symbol} style={styles.moverRow}>
            <Text style={[styles.moverSym, big && styles.bold]}>{big ? '● ' : ''}{mv.symbol}</Text>
            <Text style={[styles.moverPct, { color }, big && styles.bold]}>{fmtPctSigned(mv.changePct)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Row({ label, value, color, highlight }: { label: string; value: string; color?: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, highlight && { color: colors.warning, fontFamily: fonts.serifBold }]}>{label}</Text>
      <Text style={[styles.rowValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,10,0.6)', justifyContent: 'center', padding: spacing.md },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxHeight: '90%' },
  scroll: { padding: spacing.lg },
  masthead: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 30, textAlign: 'center', paddingVertical: 2 },
  dateline: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, letterSpacing: 1.2, textAlign: 'center', marginBottom: spacing.xs },
  headline: { fontFamily: fonts.displayBlack, fontSize: 24, lineHeight: 28, marginTop: spacing.md },
  lead: { color: colors.text, fontFamily: fonts.serif, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  bold: { fontFamily: fonts.serifBold },
  banner: { borderWidth: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
  bannerText: { fontFamily: fonts.serifBold, fontSize: 12, letterSpacing: 1, textAlign: 'center' },
  alert: { color: colors.warning, fontFamily: fonts.serifItalic, fontSize: 12, marginBottom: spacing.sm },
  sectionRule: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionLabel: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.xs },
  moverCols: { flexDirection: 'row', gap: spacing.lg },
  moverCol: { flex: 1 },
  moverTitle: { fontFamily: fonts.serifBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.xs },
  moverEmpty: { color: colors.textMuted, fontSize: 12 },
  moverRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  moverSym: { color: colors.text, fontFamily: fonts.serif, fontSize: 13 },
  moverPct: { fontFamily: fonts.serif, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.ruleSoft },
  rowLabel: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 13 },
  rowValue: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 13 },
  headlineRow: { paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.ruleSoft },
  hlTitle: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 13 },
  hlDesc: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 12, marginTop: 1 },
  colophon: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, textAlign: 'center', letterSpacing: 1, marginTop: spacing.md },
});
