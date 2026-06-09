/** Broadsheet masthead: title, gear/settings, dateline and advance button. */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSimStore } from '../store';
import { REGIME_LABEL } from '../economy';
import { notify, confirmDestructive } from '../../utils/notify';
import { useTr } from '../../i18n';
import { Button, Rule } from '../../components/ui';
import { GearIcon } from '../../components/GearIcon';
import { SettingsModal } from '../../components/SettingsModal';
import { AchievementsModal } from '../../components/AchievementsModal';
import { colors, fonts, spacing } from '../../utils/theme';

export function SimHeader({ title }: { title: string }) {
  const t = useTr();
  const game = useSimStore((s) => s.game);
  const nextMonth = useSimStore((s) => s.nextMonth);
  const resetGame = useSimStore((s) => s.resetGame);
  const replayOnboarding = useSimStore((s) => s.replayOnboarding);
  const openManual = useSimStore((s) => s.openManual);
  const openAnalysis = useSimStore((s) => s.openAnalysis);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  if (!game) return null;

  const year = Math.floor(game.month / 12) + 1;
  const m = (game.month % 12) + 1;
  const dateline = `${game.firm.name} · ${t({ de: 'Jahr', en: 'Year' })} ${year}, ${t({ de: 'Monat', en: 'Month' })} ${String(m).padStart(2, '0')} · ${t(REGIME_LABEL[game.economy.regime])}`;

  const onReset = () =>
    confirmDestructive(
      t({ de: 'Spiel zurücksetzen?', en: 'Reset game?' }),
      t({ de: 'Der aktuelle Lauf geht unwiderruflich verloren.', en: 'The current run will be permanently lost.' }),
      t({ de: 'Zurücksetzen', en: 'Reset' }),
      () => {
        setSettingsOpen(false);
        resetGame();
      },
    );

  return (
    <View style={styles.wrap}>
      <Rule double />
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={styles.gear} onPress={() => setSettingsOpen(true)} accessibilityLabel={t({ de: 'Einstellungen', en: 'Settings' })} activeOpacity={0.7}>
          <GearIcon size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <Text style={styles.dateline} numberOfLines={1}>{dateline.toUpperCase()}</Text>
        <Button
          title={game.gameOver ? t({ de: 'Ende', en: 'End' }) : t({ de: 'Nächste Ausgabe ▸', en: 'Next edition ▸' })}
          onPress={() => (game.gameOver ? notify(t({ de: 'Spielende', en: 'Game over' }), t({ de: 'Die 20 Jahre sind vorbei.', en: 'The 20 years are over.' })) : nextMonth())}
          variant={game.gameOver ? 'secondary' : 'primary'}
          style={styles.btn}
        />
      </View>
      <Rule />

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onReset={onReset}
        onShowAchievements={() => {
          setSettingsOpen(false);
          setAchievementsOpen(true);
        }}
        onReplayOnboarding={() => {
          setSettingsOpen(false);
          replayOnboarding();
        }}
        onOpenManual={() => {
          setSettingsOpen(false);
          openManual();
        }}
        onOpenAnalysis={() => {
          setSettingsOpen(false);
          openAnalysis();
        }}
        ironman={game.difficulty?.ironman}
      />
      <AchievementsModal visible={achievementsOpen} onClose={() => setAchievementsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, paddingTop: spacing.sm, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs },
  title: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 30, flex: 1 },
  gear: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dateline: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, letterSpacing: 1, flex: 1, marginRight: spacing.sm },
  btn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
