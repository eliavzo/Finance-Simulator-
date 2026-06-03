/** Interactive controls: segmented selector and a +/- amount stepper. */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../utils/theme';
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
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.segment,
              active && { backgroundColor: opt.color ?? colors.primary },
            ]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Stepper that adjusts a dollar amount by a multiplicative/additive step. */
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
  /** How to render the value (defaults to compact money). */
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

/** A discrete leverage selector 1x..5x. */
export function LeverageSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.segmented}>
      {[1, 2, 3, 4, 5].map((lev) => {
        const active = lev === value;
        const danger = lev >= 4;
        return (
          <TouchableOpacity
            key={lev}
            style={[
              styles.segment,
              active && { backgroundColor: danger ? colors.warning : colors.primary },
            ]}
            onPress={() => onChange(lev)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{lev}x</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  segmentText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: '#06121F' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  stepperValue: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
