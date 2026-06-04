/** Newspaper-styled controls: segmented selector & +/- stepper (square, inked). */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, spacing } from '../utils/theme';
import { fmtMoney } from '../utils/format';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; color?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, i > 0 && styles.segmentDivider, active && { backgroundColor: opt.color ?? colors.primary }]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function AmountStepper({
  value,
  onChange,
  step,
  min = 0,
  max,
  format = fmtMoney,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const clamp = (v: number) => {
    let out = Math.max(min, v);
    if (max !== undefined) out = Math.min(max, out);
    return out;
  };
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(clamp(value - step))}>
        <Text style={styles.stepperBtnText}>−</Text>
      </TouchableOpacity>
      <View style={styles.stepperValue}>
        <Text style={styles.stepperValueText}>{format(value)}</Text>
      </View>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(clamp(value + step))}>
        <Text style={styles.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export function LeverageSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.segmented}>
      {[1, 2, 3, 4, 5].map((lev, i) => {
        const active = lev === value;
        const danger = lev >= 4;
        return (
          <TouchableOpacity
            key={lev}
            style={[styles.segment, i > 0 && styles.segmentDivider, active && { backgroundColor: danger ? colors.warning : colors.primary }]}
            onPress={() => onChange(lev)}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{lev}×</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
  segment: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  segmentText: { color: colors.textMuted, fontFamily: fonts.serifBold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  segmentTextActive: { color: colors.paperText },
  stepperRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.xs },
  stepperBtn: {
    width: 46,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  stepperValue: {
    flex: 1,
    height: 46,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: { color: colors.text, fontFamily: fonts.display, fontSize: 17 },
});
