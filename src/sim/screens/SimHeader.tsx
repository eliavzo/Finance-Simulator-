/** Broadsheet masthead: title, gear/settings, dateline and advance button. */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSimStore } from '../store';
import { REGIME_LABEL } from '../economy';
import { notify, confirmDestructive } from '../../utils/notify';
import { Button, Rule } from '../../components/ui';
import { GearIcon } from '../../components/GearIcon';
import { SettingsModal } from '../../components/SettingsModal';
import { AchievementsModal } from '../../components/AchievementsModal';
import { colors, fonts, spacing } from '../../utils/theme';

export function SimHeader({ title }: { title: string }) {
  const game = useSimStore((s) => s.game);
  const nextMonth = useSimStore((s) => s.nextMonth);
  const resetGame = useSimStore((s) => s.resetGame);
  const replayOnboarding = useSimStore((s) => s.replayOnboarding);
  const openManual = useSimStore((s) => s.openManual);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  if (!game) return null;

  const year = Math.floor(game.month / 12) + 1;
  const m = (game.month % 12) + 1;
  const dateline = `${game.firm.name} · Jahr ${year}, Monat ${String(m).padStart(2, '0')} · ${REGIME_LABEL[game.economy.regime]}`;

  const onReset = () =>
    confirmDestructive('Spiel zurücksetzen?', 'Der aktuelle Lauf geht unwiderruflich verloren.', 'Zurücksetzen', () => {
      setSettingsOpen(false);
      resetGame();
    });

  return (
    <View style={styles.wrap}>
      <Rule double />
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={styles.gear} onPress={() => setSettingsOpen(true)} accessibilityLabel="Einstellungen" activeOpacity={0.7}>
          <GearIcon size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <Text style={styles.dateline} numberOfLines={1}>{dateline.toUpperCase()}</Text>
        <Button
          title={game.gameOver ? 'Ende' : 'Nächste Ausgabe ▸'}
          onPress={() => (game.gameOver ? notify('Spielende', 'Die 20 Jahre sind vorbei.') : nextMonth())}
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
