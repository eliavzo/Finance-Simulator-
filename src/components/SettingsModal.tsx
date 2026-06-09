/** Newspaper-styled settings overlay with a language switch and a game reset. */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Rule } from './ui';
import { Segmented } from './controls';
import { useSimStore } from '../sim/store';
import { useLang, useTr, Lang, LANGS, LANG_LABEL } from '../i18n';
import { colors, fonts, spacing } from '../utils/theme';

export function SettingsModal({
  visible,
  onClose,
  onReset,
  onShowAchievements,
  onReplayOnboarding,
  onOpenManual,
  onOpenAnalysis,
  ironman,
}: {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  onShowAchievements: () => void;
  onReplayOnboarding: () => void;
  onOpenManual: () => void;
  onOpenAnalysis: () => void;
  ironman?: boolean;
}) {
  const t = useTr();
  const lang = useLang();
  const setLang = useSimStore((s) => s.setLang);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.panel} onPress={() => {}}>
          <Rule double />
          <Text style={styles.title}>{t({ de: 'Einstellungen', en: 'Settings' })}</Text>
          <Rule />

          <Text style={styles.sectionLabel}>{t({ de: 'Sprache', en: 'Language' })}</Text>
          <Segmented<string>
            value={lang}
            onChange={(v) => setLang(v as Lang)}
            options={LANGS.map((l) => ({ label: LANG_LABEL[l], value: l }))}
          />

          <Text style={styles.sectionLabel}>{t({ de: 'Hilfe', en: 'Help' })}</Text>
          <Text style={styles.body}>{t({ de: 'Neu hier? Wiederhole die Einführung oder schlage Details im Leitfaden nach.', en: 'New here? Replay the intro or look up details in the guide.' })}</Text>
          <Button title={t({ de: 'Leitfaden öffnen', en: 'Open Guide' })} variant="secondary" onPress={onOpenManual} style={{ marginTop: spacing.md }} />
          <View style={{ height: spacing.sm }} />
          <Button title={t({ de: 'Spielanalyse ansehen', en: 'View Run Analysis' })} variant="secondary" onPress={onOpenAnalysis} />
          <View style={{ height: spacing.sm }} />
          <Button title={t({ de: 'Einführung wiederholen', en: 'Replay Intro' })} variant="secondary" onPress={onReplayOnboarding} />

          <Text style={styles.sectionLabel}>{t({ de: 'Sammlung', en: 'Collection' })}</Text>
          <Text style={styles.body}>{t({ de: 'Sieh dir an, welche Auszeichnungen du bereits errungen hast und welche noch offen sind.', en: 'See which achievements you have earned and which are still open.' })}</Text>
          <Button title={t({ de: 'Auszeichnungen ansehen', en: 'View Achievements' })} variant="secondary" onPress={onShowAchievements} style={{ marginTop: spacing.md }} />

          <Text style={styles.sectionLabel}>{t({ de: 'Spielstand', en: 'Save Game' })}</Text>
          <Text style={styles.body}>
            {ironman
              ? t({ de: 'Ironman-Modus: Zurücksetzen ist deaktiviert. Der Lauf endet erst mit Spielende oder Pleite.', en: 'Ironman mode: reset is disabled. The run ends only at the horizon or on insolvency.' })
              : t({ de: 'Setzt den aktuellen Lauf zurück und kehrt zur Titelseite zurück. Dein Fortschritt geht dabei unwiderruflich verloren.', en: 'Resets the current run and returns to the front page. Your progress is lost irreversibly.' })}
          </Text>
          <Button title={t({ de: 'Spiel zurücksetzen', en: 'Reset Game' })} variant="negative" disabled={ironman} onPress={onReset} style={{ marginTop: spacing.md }} />

          <View style={{ height: spacing.md }} />
          <Button title={t({ de: 'Schließen', en: 'Close' })} variant="secondary" onPress={onClose} />

          <Text style={styles.colophon}>Alpha &amp; Carry · {t({ de: 'Die Finanz-Chronik', en: 'The Financial Chronicle' })}</Text>
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
