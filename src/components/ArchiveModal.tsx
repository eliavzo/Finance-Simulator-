/**
 * Newspaper archive — every published monthly edition of the run in one place,
 * most recent first. On web the archive can be exported as a text file.
 */
import React from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../sim/store';
import { REGIME_LABEL } from '../sim/economy';
import { Button, Rule } from './ui';
import { useTr } from '../i18n';
import { colors, fonts, spacing } from '../utils/theme';
import { fmtMoney, fmtPctSigned } from '../utils/format';

export function ArchiveModal() {
  const t = useTr();
  const game = useSimStore((s) => s.game);
  const visible = useSimStore((s) => s.showArchive);
  const close = useSimStore((s) => s.closeArchive);
  if (!game) return null;

  const entries = [...(game.chronicle ?? [])].reverse();

  const exportText = () => {
    const lines = entries.map((e) => {
      const year = Math.floor(e.month / 12) + 1;
      const m = (e.month % 12) + 1;
      return `J${year} M${String(m).padStart(2, '0')} · ${t(REGIME_LABEL[e.regime])} · ${fmtMoney(e.enterprise)} (${fmtPctSigned(e.changePct)})${e.headline ? ` — ${e.headline}` : ''}`;
    });
    const text = `${game.firm.name} · ${t({ de: 'Die Finanz-Chronik — Archiv', en: 'The Financial Chronicle — Archive' })}\n\n${lines.join('\n')}\n`;
    try {
      const doc = (globalThis as { document?: Document }).document;
      if (!doc) return;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = 'alpha-and-carry-archiv.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      /* export is best-effort */
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.masthead}>{t({ de: 'Zeitungsarchiv', en: 'Newspaper Archive' })}</Text>
            <Text style={styles.dateline}>{`${game.firm.name.toUpperCase()} · ${entries.length} ${t({ de: 'AUSGABEN', en: 'EDITIONS' })}`}</Text>
            <Rule double />

            {entries.length === 0 ? (
              <Text style={styles.empty}>{t({ de: 'Noch keine Ausgaben — rücke einen Monat vor.', en: 'No editions yet — advance a month.' })}</Text>
            ) : (
              entries.map((e) => {
                const year = Math.floor(e.month / 12) + 1;
                const m = (e.month % 12) + 1;
                const up = e.changePct >= 0;
                return (
                  <View key={e.month} style={styles.row}>
                    <View style={styles.rowTop}>
                      <Text style={styles.stamp}>{`J${year} M${String(m).padStart(2, '0')} · ${t(REGIME_LABEL[e.regime]).toUpperCase()}`}</Text>
                      <Text style={[styles.delta, { color: up ? colors.positive : colors.negative }]}>
                        {fmtMoney(e.enterprise)} ({fmtPctSigned(e.changePct)})
                      </Text>
                    </View>
                    {e.headline ? <Text style={styles.headline} numberOfLines={2}>{e.headline}</Text> : null}
                  </View>
                );
              })
            )}
            <Text style={styles.colophon}>{t({ de: 'Alpha & Carry · Die Finanz-Chronik', en: 'Alpha & Carry · The Financial Chronicle' })}</Text>
          </ScrollView>
          <View style={styles.footer}>
            {Platform.OS === 'web' && entries.length > 0 ? (
              <Button title={t({ de: 'Als Text exportieren', en: 'Export as text' })} onPress={exportText} variant="secondary" style={{ marginBottom: spacing.sm }} />
            ) : null}
            <Button title={t({ de: 'Schließen', en: 'Close' })} onPress={close} variant="primary" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,10,0.6)', justifyContent: 'center', padding: spacing.md },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxHeight: '90%' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.sm },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, backgroundColor: colors.surface },
  masthead: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 28, textAlign: 'center', paddingVertical: 2 },
  dateline: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, letterSpacing: 1.2, textAlign: 'center', marginBottom: spacing.xs },
  empty: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 13, textAlign: 'center', marginVertical: spacing.lg },
  row: { borderTopWidth: 1, borderTopColor: colors.ruleSoft, paddingVertical: spacing.sm },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  stamp: { color: colors.textMuted, fontFamily: fonts.serifBold, fontSize: 11, letterSpacing: 0.5 },
  delta: { fontFamily: fonts.serifBold, fontSize: 11 },
  headline: { color: colors.text, fontFamily: fonts.serif, fontSize: 13, marginTop: 2 },
  colophon: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, textAlign: 'center', letterSpacing: 1, marginTop: spacing.md },
});
