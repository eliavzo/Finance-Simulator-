/** Full achievements list — unlocked & still-locked — opened from settings. */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../sim/store';
import { ACHIEVEMENTS } from '../sim/achievements';
import { Button, Rule } from './ui';
import { colors, fonts, spacing } from '../utils/theme';
import { useTr, Loc } from '../i18n';

function earnedLabel(month: number, t: (l: Loc) => string): string {
  const year = Math.floor(month / 12) + 1;
  const m = (month % 12) + 1;
  return `${t({ de: 'Jahr', en: 'Year' })} ${year}, ${t({ de: 'Monat', en: 'Month' })} ${String(m).padStart(2, '0')}`;
}

export function AchievementsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTr();
  const game = useSimStore((s) => s.game);
  const unlocked = new Map((game?.achievements ?? []).map((a) => [a.id, a.month]));
  const count = unlocked.size;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.title}>{t({ de: 'Auszeichnungen', en: 'Achievements' })}</Text>
            <Text style={styles.dateline}>{`${count} ${t({ de: 'VON', en: 'OF' })} ${ACHIEVEMENTS.length} ${t({ de: 'ERRUNGEN', en: 'EARNED' })}`}</Text>
            <Rule double />

            {ACHIEVEMENTS.map((a) => {
              const has = unlocked.has(a.id);
              return (
                <View key={a.id} style={styles.row}>
                  <Text style={[styles.mark, { color: has ? colors.warning : colors.ruleSoft }]}>{has ? '🏅' : '○'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, !has && styles.locked]}>{t(a.title)}</Text>
                    <Text style={styles.rowDesc}>{t(a.description)}</Text>
                    {has ? <Text style={styles.earned}>{t({ de: 'Errungen', en: 'Earned' })}: {earnedLabel(unlocked.get(a.id)!, t)}</Text> : null}
                  </View>
                </View>
              );
            })}

            <Button title={t({ de: 'Schließen', en: 'Close' })} variant="secondary" onPress={onClose} style={{ marginTop: spacing.lg }} />
            <Text style={styles.colophon}>{t({ de: 'Alpha & Carry · Die Finanz-Chronik', en: 'Alpha & Carry · The Financial Chronicle' })}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,10,0.6)', justifyContent: 'center', padding: spacing.md },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxHeight: '90%' },
  scroll: { padding: spacing.lg },
  title: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 28, textAlign: 'center', paddingVertical: 2 },
  dateline: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.ruleSoft },
  mark: { fontSize: 16, width: 24, textAlign: 'center' },
  rowTitle: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 15 },
  locked: { color: colors.textMuted },
  rowDesc: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 12, marginTop: 1 },
  earned: { color: colors.accent, fontFamily: fonts.serifItalic, fontSize: 11, marginTop: 2 },
  colophon: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, textAlign: 'center', letterSpacing: 1, marginTop: spacing.md },
});
