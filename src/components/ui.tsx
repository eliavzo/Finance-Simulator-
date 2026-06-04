/** Newspaper UI primitives — boxed columns, hairline rules, serif type. */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fonts, spacing } from '../utils/theme';

/** A bordered "column" box. */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A thin horizontal rule; `double` draws the classic newspaper double rule. */
export function Rule({ double, style }: { double?: boolean; style?: ViewStyle }) {
  if (double) {
    return (
      <View style={style}>
        <View style={styles.ruleThick} />
        <View style={styles.ruleGap} />
        <View style={styles.ruleThin} />
      </View>
    );
  }
  return <View style={[styles.ruleThin, style]} />;
}

/** Section header in the style of a newspaper kicker. */
export function SectionTitle({ children, ornament }: { children: React.ReactNode; ornament?: boolean }) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionRow}>
        {ornament ? <Text style={styles.ornament}>❧ </Text> : null}
        <Text style={styles.sectionTitle}>{children}</Text>
      </View>
      <View style={styles.ruleThin} />
    </View>
  );
}

/** A masthead — large Playfair title between double rules with a dateline. */
export function Masthead({ title, dateline }: { title: string; dateline?: string }) {
  return (
    <View style={styles.masthead}>
      <Rule double />
      <Text style={styles.mastheadTitle}>{title}</Text>
      {dateline ? <Text style={styles.dateline}>{dateline}</Text> : null}
      <Rule double />
    </View>
  );
}

export function StatTile({
  label,
  value,
  valueColor,
  hint,
}: {
  label: string;
  value: string;
  valueColor?: string;
  hint?: string;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'positive' | 'negative' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const fill: Record<string, string> = {
    primary: colors.primary,
    secondary: colors.surface,
    positive: colors.positive,
    negative: colors.negative,
    ghost: 'transparent',
  };
  const inked = variant === 'primary' || variant === 'positive' || variant === 'negative';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.button, { backgroundColor: fill[variant] }, disabled ? styles.buttonDisabled : null, style]}
    >
      <Text style={[styles.buttonText, { color: inked ? colors.paperText : colors.text }]}>{title}</Text>
    </TouchableOpacity>
  );
}

/** A bracketed boxed label, e.g. a regime or status tag. */
export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingTitle}>Alpha &amp; Carry</Text>
      <View style={styles.loadingRule} />
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{label ?? 'Die Ausgabe wird gesetzt …'}</Text>
    </View>
  );
}

const serifBold: TextStyle = { fontFamily: fonts.serifBold };

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  ruleThin: { height: 1, backgroundColor: colors.border },
  ruleThick: { height: 2, backgroundColor: colors.border },
  ruleGap: { height: 2 },
  sectionWrap: { marginBottom: spacing.md },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.xs },
  ornament: { color: colors.accent, fontSize: 13 },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.serifBold,
    fontSize: 12,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  masthead: { marginBottom: spacing.md },
  mastheadTitle: {
    color: colors.text,
    fontFamily: fonts.displayBlack,
    fontSize: 40,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  dateline: {
    color: colors.textMuted,
    fontFamily: fonts.serifItalic,
    fontSize: 11,
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  statTile: { flex: 1, minWidth: 90, paddingVertical: spacing.sm, paddingRight: spacing.sm },
  statLabel: {
    color: colors.textMuted,
    fontFamily: fonts.serif,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
  statHint: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 10, marginTop: 2 },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...serifBold, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' },
  pill: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: { fontFamily: fonts.serifBold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  progressTrack: {
    height: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressFill: { height: '100%' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  loadingTitle: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 34 },
  loadingRule: { height: 1, backgroundColor: colors.border, alignSelf: 'stretch', marginVertical: spacing.md },
  loadingText: { color: colors.textMuted, fontFamily: fonts.serifItalic, marginTop: spacing.md },
});
