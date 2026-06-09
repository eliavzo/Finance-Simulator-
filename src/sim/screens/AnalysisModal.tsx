/** Post-mortem / coaching report: how you played, what went right & wrong, why you failed. */
import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { analyzeRun, Finding } from '../analysis';
import { Button, Rule } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';
import { useTr, useLang } from '../../i18n';

export function AnalysisModal() {
  const t = useTr();
  const lang = useLang();
  const show = useSimStore((s) => s.showAnalysis);
  const close = useSimStore((s) => s.closeAnalysis);
  const game = useSimStore((s) => s.game);
  const report = useMemo(() => (game ? analyzeRun(game, lang) : null), [game, show, lang]);
  if (!show || !game || !report) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.title}>{t({ de: 'Spielanalyse', en: 'Game Analysis' })}</Text>
            <Text style={styles.dateline}>{t({ de: 'DIE NACHLESE', en: 'THE POST-MORTEM' })}</Text>
            <Rule double />

            <Text style={styles.profile}>{report.profile}</Text>
            <Text style={styles.profileBlurb}>{report.profileBlurb}</Text>
            <Text style={styles.summary}>{report.summary}</Text>

            {report.failure ? (
              <View style={styles.failBox}>
                <Text style={styles.failTitle}>{t({ de: 'Warum es endete', en: 'Why it ended' })}</Text>
                <Text style={styles.failText}>{report.failure}</Text>
              </View>
            ) : null}

            <SectionRule label={t({ de: 'Verhaltens-Kennzahlen', en: 'Behavioral metrics' })} />
            <View style={styles.metrics}>
              {report.metrics.map((mt) => (
                <View key={mt.label} style={styles.metric}>
                  <Text style={styles.metricLabel}>{mt.label}</Text>
                  <Text style={styles.metricValue}>{mt.value}</Text>
                </View>
              ))}
            </View>

            <SectionRule label={t({ de: 'Das lief gut', en: 'What went well' })} />
            {report.strengths.length === 0 ? (
              <Text style={styles.empty}>{t({ de: 'Wenig Positives zu vermelden — Zeit, das Ruder herumzureißen.', en: 'Little to celebrate — time to turn things around.' })}</Text>
            ) : (
              report.strengths.map((f, i) => <FindingRow key={i} f={f} />)
            )}

            <SectionRule label={t({ de: 'Verbesserungswürdig', en: 'Room for improvement' })} />
            {report.weaknesses.length === 0 ? (
              <Text style={styles.empty}>{t({ de: 'Keine groben Fehler erkennbar — stark gespielt!', en: 'No major mistakes spotted — strong play!' })}</Text>
            ) : (
              report.weaknesses.map((f, i) => <FindingRow key={i} f={f} />)
            )}

            <Button title={t({ de: 'Schließen', en: 'Close' })} variant="secondary" onPress={close} style={{ marginTop: spacing.lg }} />
            <Text style={styles.colophon}>{t({ de: 'Alpha & Carry · Die Finanz-Chronik', en: 'Alpha & Carry · The Financial Chronicle' })}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const color = f.kind === 'good' ? colors.positive : f.kind === 'bad' ? colors.negative : colors.textMuted;
  return (
    <View style={styles.finding}>
      <Text style={[styles.findMark, { color }]}>{f.kind === 'good' ? '✓' : f.kind === 'bad' ? '✗' : '•'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.findTitle, { color }]}>{f.title}</Text>
        <Text style={styles.findDetail}>{f.detail}</Text>
      </View>
    </View>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <View style={styles.sectionRule}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Rule />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,10,0.65)', justifyContent: 'center', padding: spacing.md },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxHeight: '92%' },
  scroll: { padding: spacing.lg },
  title: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 30, textAlign: 'center', paddingVertical: 2 },
  dateline: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.xs },
  profile: { color: colors.primary, fontFamily: fonts.displayBlack, fontSize: 22, textAlign: 'center', marginTop: spacing.sm },
  profileBlurb: { color: colors.text, fontFamily: fonts.serifItalic, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
  summary: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm },
  failBox: { borderWidth: 1, borderColor: colors.negative, padding: spacing.md, marginTop: spacing.md },
  failTitle: { color: colors.negative, fontFamily: fonts.serifBold, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.xs },
  failText: { color: colors.text, fontFamily: fonts.serif, fontSize: 13, lineHeight: 20 },
  sectionRule: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionLabel: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { width: '50%', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingRight: spacing.sm },
  metricLabel: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 12 },
  metricValue: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 12 },
  finding: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.ruleSoft },
  findMark: { fontFamily: fonts.serifBold, fontSize: 14, width: 14, textAlign: 'center' },
  findTitle: { fontFamily: fonts.serifBold, fontSize: 14 },
  findDetail: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 12, lineHeight: 18, marginTop: 1 },
  empty: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 13 },
  colophon: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, textAlign: 'center', letterSpacing: 1, marginTop: spacing.md },
});
