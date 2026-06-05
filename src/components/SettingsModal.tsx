/** Newspaper-styled settings overlay with a game reset. */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Rule } from './ui';
import { colors, fonts, spacing } from '../utils/theme';

export function SettingsModal({
  visible,
  onClose,
  onReset,
  onShowAchievements,
  onReplayOnboarding,
  onOpenManual,
  ironman,
}: {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  onShowAchievements: () => void;
  onReplayOnboarding: () => void;
  onOpenManual: () => void;
  ironman?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.panel} onPress={() => {}}>
          <Rule double />
          <Text style={styles.title}>Einstellungen</Text>
          <Rule />

          <Text style={styles.sectionLabel}>Hilfe</Text>
          <Text style={styles.body}>Neu hier? Wiederhole die Einführung oder schlage Details im Leitfaden nach.</Text>
          <Button title="Leitfaden öffnen" variant="secondary" onPress={onOpenManual} style={{ marginTop: spacing.md }} />
          <View style={{ height: spacing.sm }} />
          <Button title="Einführung wiederholen" variant="secondary" onPress={onReplayOnboarding} />

          <Text style={styles.sectionLabel}>Sammlung</Text>
          <Text style={styles.body}>Sieh dir an, welche Auszeichnungen du bereits errungen hast und welche noch offen sind.</Text>
          <Button title="Auszeichnungen ansehen" variant="secondary" onPress={onShowAchievements} style={{ marginTop: spacing.md }} />

          <Text style={styles.sectionLabel}>Spielstand</Text>
          <Text style={styles.body}>
            {ironman
              ? 'Ironman-Modus: Zurücksetzen ist deaktiviert. Der Lauf endet erst mit Spielende oder Pleite.'
              : 'Setzt den aktuellen Lauf zurück und kehrt zur Titelseite zurück. Dein Fortschritt geht dabei unwiderruflich verloren.'}
          </Text>
          <Button title="Spiel zurücksetzen" variant="negative" disabled={ironman} onPress={onReset} style={{ marginTop: spacing.md }} />

          <View style={{ height: spacing.md }} />
          <Button title="Schließen" variant="secondary" onPress={onClose} />

          <Text style={styles.colophon}>Alpha &amp; Carry · Die Finanz-Chronik</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,17,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.displayBlack,
    fontSize: 28,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  sectionLabel: {
    color: colors.text,
    fontFamily: fonts.serifBold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  body: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 13, lineHeight: 19 },
  colophon: {
    color: colors.textMuted,
    fontFamily: fonts.serifItalic,
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: spacing.lg,
  },
});
