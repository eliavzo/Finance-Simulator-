/** Übersichts-Chart: combined equity trajectory, per-book breakdown, and the
 *  synergy levers — moving cash between the two books and drawing LP capital. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { confirmDestructive, notify } from '../utils/notify';
import { useGameStore } from '../store/gameStore';
import { GameHeader } from '../components/GameHeader';
import { Button, Card, SectionTitle, StatTile } from '../components/ui';
import { Segmented, AmountStepper } from '../components/controls';
import { LineChart } from '../components/LineChart';
import { computeMetrics } from '../engine/metrics';
import { colors, spacing } from '../utils/theme';
import { fmtMoney, fmtMultiple, fmtNum, fmtPct } from '../utils/format';
import { STARTING_CAPITAL } from '../models/types';

export function ChartScreen() {
  const game = useGameStore((s) => s.game)!;
  const transfer = useGameStore((s) => s.transferCash);
  const drawLp = useGameStore((s) => s.drawLpCapital);
  const newGame = useGameStore((s) => s.newGame);
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => computeMetrics(game), [game]);

  const chartWidth = width - spacing.lg * 4;
  const [transferFrom, setTransferFrom] = useState<'hedge' | 'vc'>('hedge');
  const [transferAmt, setTransferAmt] = useState(500_000);
  const [lpTo, setLpTo] = useState<'hedge' | 'vc'>('vc');
  const [lpAmt, setLpAmt] = useState(1_000_000);

  return (
    <View style={styles.container}>
      <GameHeader title="Übersicht" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Combined equity */}
        <Card>
          <SectionTitle>Gesamtvermögen über Zeit</SectionTitle>
          <Text style={styles.big}>{fmtMoney(metrics.totalEquity)}</Text>
          <View style={styles.chartWrap}>
            <LineChart
              data={game.totalEquityHistory}
              width={chartWidth}
              height={160}
              baseline={STARTING_CAPITAL}
              color={metrics.totalEquity >= STARTING_CAPITAL ? colors.positive : colors.negative}
            />
          </View>
          <View style={styles.legendRow}>
            <Legend color={colors.border} label={`Start ${fmtMoney(STARTING_CAPITAL)}`} dashed />
          </View>
        </Card>

        {/* Hedge fund NAV */}
        <Card>
          <SectionTitle>Hedge Fund NAV</SectionTitle>
          <View style={styles.chartWrap}>
            <LineChart data={game.hedgeFund.navHistory} width={chartWidth} height={110} color={colors.primary} />
          </View>
          <View style={styles.statRow}>
            <StatTile label="NAV" value={fmtMoney(metrics.hedgeFundNav)} />
            <StatTile label="Sharpe" value={fmtNum(metrics.sharpe)} />
            <StatTile label="Max DD" value={fmtPct(metrics.maxDrawdown)} valueColor={colors.negative} />
            <StatTile label="VaR₉₅" value={fmtMoney(metrics.var95)} valueColor={colors.warning} />
          </View>
        </Card>

        {/* VC metrics */}
        <Card>
          <SectionTitle>VC Fonds</SectionTitle>
          <View style={styles.statRow}>
            <StatTile label="NAV" value={fmtMoney(metrics.vcNav)} />
            <StatTile label="IRR" value={fmtPct(metrics.vcIrr)} valueColor={metrics.vcIrr >= 0 ? colors.positive : colors.negative} />
            <StatTile label="TVPI" value={fmtMultiple(metrics.tvpi)} />
            <StatTile label="MOIC" value={fmtMultiple(metrics.moic)} />
          </View>
        </Card>

        {/* Synergy: transfer cash between books */}
        <Card>
          <SectionTitle>Synergie · Kapital umschichten</SectionTitle>
          <Text style={styles.hint}>HF-Gewinne finanzieren neue VC-Deals — und umgekehrt.</Text>
          <Segmented<'hedge' | 'vc'>
            value={transferFrom}
            onChange={setTransferFrom}
            options={[
              { label: 'HF → VC', value: 'hedge' },
              { label: 'VC → HF', value: 'vc' },
            ]}
          />
          <View style={{ height: spacing.md }} />
          <AmountStepper
            value={transferAmt}
            onChange={setTransferAmt}
            step={250_000}
            min={100_000}
            max={transferFrom === 'hedge' ? game.hedgeFund.cash : game.vc.cash}
          />
          <Button
            title="Umschichten"
            variant="secondary"
            onPress={() => {
              const res = transfer(transferFrom, transferAmt);
              if (!res.ok) notify('Nicht möglich', res.error ?? 'Fehler');
            }}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* LP capital draw */}
        <Card>
          <SectionTitle>LP-Kapital abrufen</SectionTitle>
          <Text style={styles.hint}>Verfügbar dank Reputation: {fmtMoney(game.lpCapitalAvailable)}</Text>
          {game.lpCapitalAvailable <= 0 ? (
            <Text style={styles.empty}>Steigere deine Reputation über 50, um LP-Kapital freizuschalten.</Text>
          ) : (
            <>
              <Segmented<'hedge' | 'vc'>
                value={lpTo}
                onChange={setLpTo}
                options={[
                  { label: 'in VC', value: 'vc' },
                  { label: 'in HF', value: 'hedge' },
                ]}
              />
              <View style={{ height: spacing.md }} />
              <AmountStepper value={lpAmt} onChange={setLpAmt} step={500_000} min={500_000} max={game.lpCapitalAvailable} />
              <Button
                title="Kapital abrufen"
                onPress={() => {
                  const res = drawLp(lpAmt, lpTo);
                  if (!res.ok) notify('Nicht möglich', res.error ?? 'Fehler');
                }}
                style={{ marginTop: spacing.md }}
              />
            </>
          )}
        </Card>

        {/* New game */}
        {game.gameOver ? (
          <Card>
            <SectionTitle>Spiel beendet</SectionTitle>
            <Text style={styles.hint}>
              Endvermögen {fmtMoney(metrics.totalEquity)} ·{' '}
              {fmtPct(metrics.totalEquity / STARTING_CAPITAL - 1)} über 20 Jahre.
            </Text>
            <Button title="Neues Spiel" onPress={() => newGame()} variant="primary" style={{ marginTop: spacing.md }} />
          </Card>
        ) : (
          <Button
            title="Neues Spiel starten"
            variant="ghost"
            onPress={() =>
              confirmDestructive(
                'Neues Spiel?',
                'Der aktuelle Spielstand geht verloren.',
                'Neu starten',
                () => newGame(),
              )
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendDash, { backgroundColor: dashed ? 'transparent' : color, borderColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  big: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: spacing.sm },
  chartWrap: { alignItems: 'center', marginVertical: spacing.sm },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  legendRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDash: { width: 16, height: 2, borderWidth: 1, borderStyle: 'dashed' },
  legendLabel: { color: colors.textMuted, fontSize: 11 },
});
