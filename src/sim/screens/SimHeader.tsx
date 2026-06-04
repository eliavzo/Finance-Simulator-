/** Broadsheet masthead shown atop every section: title, dateline, advance button. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { monthLabel } from '../engine';
import { REGIME_LABEL } from '../economy';
import { notify } from '../../utils/notify';
import { Button, Rule } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';

export function SimHeader({ title }: { title: string }) {
  const game = useSimStore((s) => s.game);
  const nextMonth = useSimStore((s) => s.nextMonth);
  if (!game) return null;

  const year = Math.floor(game.month / 12) + 1;
  const m = (game.month % 12) + 1;
  const dateline = `Alpha & Carry · Jahr ${year}, Monat ${String(m).padStart(2, '0')} · ${REGIME_LABEL[game.economy.regime]}`;

  return (
    <View style={styles.wrap}>
      <Rule double />
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <Button
          title={game.gameOver ? 'Ende' : 'Nächste Ausgabe ▸'}
          onPress={() => (game.gameOver ? notify('Spielende', 'Die 20 Jahre sind vorbei.') : nextMonth())}
          variant={game.gameOver ? 'secondary' : 'primary'}
          style={styles.btn}
        />
      </View>
      <Text style={styles.dateline}>{dateline.toUpperCase()}</Text>
      <Rule />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, paddingTop: spacing.sm, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs },
  title: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 30, flex: 1 },
  btn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dateline: {
    color: colors.textMuted,
    fontFamily: fonts.serifItalic,
    fontSize: 10,
    letterSpacing: 1.2,
    marginVertical: spacing.xs,
  },
});
