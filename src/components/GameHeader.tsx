/** Sticky top bar: shows the current quarter, macro phase and the "advance
 *  quarter" action that drives the whole simulation forward. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { notify } from '../utils/notify';
import { quarterLabel } from '../engine/gameEngine';
import { PHASE_LABEL } from '../engine/macro';
import { colors, spacing } from '../utils/theme';
import { Button, Pill } from './ui';
import { MacroPhase } from '../models/types';

const PHASE_COLOR: Record<MacroPhase, string> = {
  expansion: colors.positive,
  peak: colors.warning,
  contraction: colors.negative,
  trough: colors.accent,
};

export function GameHeader({ title }: { title: string }) {
  const game = useGameStore((s) => s.game);
  const nextQuarter = useGameStore((s) => s.nextQuarter);
  if (!game) return null;

  const onNext = () => {
    if (game.gameOver) {
      notify('Spielende', 'Die 20 Jahre sind vorbei. Starte ein neues Spiel über die Übersicht.');
      return;
    }
    nextQuarter();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.subRow}>
            <Text style={styles.quarter}>{quarterLabel(game.quarter)}</Text>
            <Pill text={PHASE_LABEL[game.macro.phase]} color={PHASE_COLOR[game.macro.phase]} />
          </View>
        </View>
        <Button
          title={game.gameOver ? 'Ende' : 'Quartal ▶'}
          onPress={onNext}
          variant={game.gameOver ? 'secondary' : 'primary'}
          style={styles.nextBtn}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  quarter: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  nextBtn: { paddingHorizontal: spacing.lg },
});
