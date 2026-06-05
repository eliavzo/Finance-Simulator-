/** First-run onboarding tour (newspaper carousel). Re-openable from settings. */
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../sim/store';
import { Button, Rule } from './ui';
import { colors, fonts, spacing } from '../utils/theme';

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Willkommen',
    body: 'Du führst eine Fondsgesellschaft über 20 Jahre. Jeder Monat ist eine neue „Ausgabe". Mit „Nächste Ausgabe ▸" oben rückst du die Zeit vor — danach erscheint ein Monatsbericht mit allen Veränderungen.',
  },
  {
    title: '§ Übersicht',
    body: 'Dein Cockpit: Unternehmenswert, Fonds & GP-Firma, Reputation und deine Stufe, die Rangliste gegen Konkurrenzfonds und das Ereignis-Log. Hier behältst du den Überblick.',
  },
  {
    title: '$ Markt',
    body: 'Handle Aktien, Anleihen, FX, Rohstoffe & Optionen — Long oder Short, mit Hebel. Wichtig: Aktien haben einen fairen Wert. Kaufe, was UNTERbewertet ist, und meide Teures. Die Research-Tipps deines Teams helfen.',
  },
  {
    title: '¶ Firma',
    body: 'Stelle Analysten, Trader, Quants & mehr ein und baue Infrastruktur aus. Dein Team erzeugt Alpha, senkt Kosten und verhindert Margin Calls. Bessere Reputation lockt bessere Bewerber.',
  },
  {
    title: '‡ Fonds & ◇ Startups',
    body: 'Im Fonds verwaltest du LP-Kapital (Capital Calls), Gebühren/Carry, Mandate und Liquidität — bei schwacher Performance ziehen LPs Geld ab! Bei Startups investierst du in junge Firmen, unterstützt sie und erntest IPO/M&A-Exits.',
  },
  {
    title: '† Risiko & Stufen',
    body: 'Behalte VaR, Drawdown und Stress-Szenarien im Blick und kaufe vor Krisen eine Absicherung. Deine Reputation schaltet höheren Hebel, Optionshandel und bessere LP-Typen frei. Jagd nach Auszeichnungen!',
  },
  {
    title: 'Bereit?',
    body: 'Diese Einführung und ein ausführlicher Leitfaden sind jederzeit über das Zahnrad ⚙ oben rechts erreichbar. Viel Erfolg, Allocator!',
  },
];

export function OnboardingModal() {
  const show = useSimStore((s) => s.showOnboarding);
  const game = useSimStore((s) => s.game);
  const complete = useSimStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);

  if (!show || !game) return null;
  const last = step === STEPS.length - 1;
  const s = STEPS[step];
  const close = () => { setStep(0); complete(); };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Rule double />
          <Text style={styles.kicker}>EINFÜHRUNG · {step + 1}/{STEPS.length}</Text>
          <Text style={styles.title}>{s.title}</Text>
          <Rule />
          <Text style={styles.body}>{s.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <Text key={i} style={[styles.dot, i === step && styles.dotOn]}>●</Text>
            ))}
          </View>

          <View style={styles.row}>
            {step > 0 ? <Button title="Zurück" variant="secondary" onPress={() => setStep(step - 1)} style={styles.btn} /> : <View style={styles.btn} />}
            {last ? (
              <Button title="Los geht's ▸" variant="primary" onPress={close} style={styles.btn} />
            ) : (
              <Button title="Weiter ▸" variant="primary" onPress={() => setStep(step + 1)} style={styles.btn} />
            )}
          </View>
          <Text style={styles.skip} onPress={close}>Überspringen</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,10,0.7)', justifyContent: 'center', padding: spacing.lg },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  kicker: { color: colors.accent, fontFamily: fonts.serifBold, fontSize: 11, letterSpacing: 2, textAlign: 'center', marginTop: spacing.xs },
  title: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 28, textAlign: 'center', marginBottom: spacing.xs },
  body: { color: colors.text, fontFamily: fonts.serif, fontSize: 15, lineHeight: 23, marginVertical: spacing.md, minHeight: 140 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.md },
  dot: { color: colors.ruleSoft, fontSize: 9 },
  dotOn: { color: colors.primary },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1 },
  skip: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 12, textAlign: 'center', marginTop: spacing.md, padding: spacing.xs },
});
