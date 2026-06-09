/** First-run onboarding tour (newspaper carousel). Re-openable from settings. */
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../sim/store';
import { useTr, Loc } from '../i18n';
import { Button, Rule } from './ui';
import { colors, fonts, spacing } from '../utils/theme';

const STEPS: { title: Loc; body: Loc }[] = [
  {
    title: { de: 'Willkommen', en: 'Welcome' },
    body: {
      de: 'Du führst eine Fondsgesellschaft über 20 Jahre. Jeder Monat ist eine neue „Ausgabe". Mit „Nächste Ausgabe ▸" oben rückst du die Zeit vor — danach erscheint ein Monatsbericht mit allen Veränderungen.',
      en: 'You run a fund management firm over 20 years. Each month is a new "edition". Use "Next edition ▸" at the top to advance time — after that, a monthly report appears with all the changes.',
    },
  },
  {
    title: { de: '§ Übersicht', en: '§ Overview' },
    body: {
      de: 'Dein Cockpit: Unternehmenswert, Fonds & GP-Firma, Reputation und deine Stufe, die Rangliste gegen Konkurrenzfonds und das Ereignis-Log. Hier behältst du den Überblick.',
      en: 'Your cockpit: enterprise value, fund & GP firm, reputation and your tier, the leaderboard against rival funds, and the event log. This is where you keep the big picture.',
    },
  },
  {
    title: { de: '$ Markt', en: '$ Markets' },
    body: {
      de: 'Handle Aktien, Anleihen, FX, Rohstoffe & Optionen — Long oder Short, mit Hebel. Wichtig: Aktien haben einen fairen Wert. Kaufe, was UNTERbewertet ist, und meide Teures. Die Research-Tipps deines Teams helfen.',
      en: 'Trade equities, bonds, FX, commodities & options — long or short, with leverage. Important: stocks have a fair value. Buy what is UNDERvalued, and avoid expensive names. Your team’s research tips will help.',
    },
  },
  {
    title: { de: '¶ Firma', en: '¶ Firm' },
    body: {
      de: 'Stelle Analysten, Trader, Quants & mehr ein und baue Infrastruktur aus. Dein Team erzeugt Alpha, senkt Kosten und verhindert Margin Calls. Bessere Reputation lockt bessere Bewerber.',
      en: 'Hire analysts, traders, quants & more, and build out your infrastructure. Your team generates alpha, lowers costs and prevents margin calls. Better reputation attracts better candidates.',
    },
  },
  {
    title: { de: '‡ Fonds & ◇ Startups', en: '‡ Fund & ◇ Startups' },
    body: {
      de: 'Im Fonds verwaltest du LP-Kapital (Capital Calls), Gebühren/Carry, Mandate und Liquidität — bei schwacher Performance ziehen LPs Geld ab! Bei Startups investierst du in junge Firmen, unterstützt sie und erntest IPO/M&A-Exits.',
      en: 'In the fund you manage LP capital (capital calls), fees/carry, mandates and liquidity — when performance is weak, LPs pull their money! In Startups you invest in young companies, support them, and reap IPO/M&A exits.',
    },
  },
  {
    title: { de: '† Risiko & Stufen', en: '† Risk & Tiers' },
    body: {
      de: 'Behalte VaR, Drawdown und Stress-Szenarien im Blick und kaufe vor Krisen eine Absicherung. Deine Reputation schaltet höheren Hebel, Optionshandel und bessere LP-Typen frei. Jagd nach Auszeichnungen!',
      en: 'Keep an eye on VaR, drawdown and stress scenarios, and buy a hedge before crises hit. Your reputation unlocks higher leverage, options trading and better LP types. Go hunt for awards!',
    },
  },
  {
    title: { de: 'Bereit?', en: 'Ready?' },
    body: {
      de: 'Diese Einführung und ein ausführlicher Leitfaden sind jederzeit über das Zahnrad ⚙ oben rechts erreichbar. Viel Erfolg, Allocator!',
      en: 'This onboarding and a detailed guide are always available via the gear ⚙ in the top right. Good luck, allocator!',
    },
  },
];

export function OnboardingModal() {
  const t = useTr();
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
          <Text style={styles.kicker}>{t({ de: 'EINFÜHRUNG', en: 'ONBOARDING' })} · {step + 1}/{STEPS.length}</Text>
          <Text style={styles.title}>{t(s.title)}</Text>
          <Rule />
          <Text style={styles.body}>{t(s.body)}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <Text key={i} style={[styles.dot, i === step && styles.dotOn]}>●</Text>
            ))}
          </View>

          <View style={styles.row}>
            {step > 0 ? <Button title={t({ de: 'Zurück', en: 'Back' })} variant="secondary" onPress={() => setStep(step - 1)} style={styles.btn} /> : <View style={styles.btn} />}
            {last ? (
              <Button title={t({ de: "Los geht's ▸", en: "Let's go ▸" })} variant="primary" onPress={close} style={styles.btn} />
            ) : (
              <Button title={t({ de: 'Weiter ▸', en: 'Next ▸' })} variant="primary" onPress={() => setStep(step + 1)} style={styles.btn} />
            )}
          </View>
          <Text style={styles.skip} onPress={close}>{t({ de: 'Überspringen', en: 'Skip' })}</Text>
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
