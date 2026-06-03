/** Sticky top bar for v2: month, macro regime and the advance-month button. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { monthLabel } from '../engine';
import { REGIME_LABEL } from '../economy';
import { Regime } from '../types';
import { notify } from '../../utils/notify';
import { Button, Pill } from '../../components/ui';
import { colors, spacing } from '../../utils/theme';

const REGIME_COLOR: Record<Regime, string> = {
  expansion: colors.positive,
  peak: colors.warning,
  contraction: colors.negative,
  trough: colors.accent,
};

export function SimHeader({ title }: { title: string }) {
  const game = useSimStore((s) => s.game);
  const nextMonth = useSimStore((s) => s.nextMonth);
  if (!game) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.subRow}>
            <Text style={styles.month}>{monthLabel(game.month)}</Text>
            <Pill text={REGIME_LABEL[game.economy.regime]} color={REGIME_COLOR[game.economy.regime]} />
          </View>
        </View>
        <Button
          title={game.gameOver ? 'Ende' : 'Monat ▶'}
          onPress={() => (game.gameOver ? notify('Spielende', 'Die 20 Jahre sind vorbei.') : nextMonth())}
          variant={game.gameOver ? 'secondary' : 'primary'}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  month: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  btn: { paddingHorizontal: spacing.lg },
});
