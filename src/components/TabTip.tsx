/** A small, dismissible contextual hint shown on first visit to a tab. */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSimStore } from '../sim/store';
import { colors, fonts, spacing } from '../utils/theme';

export function TabTip({ tipKey, text }: { tipKey: string; text: string }) {
  const dismissed = useSimStore((s) => s.dismissedTips[tipKey]);
  const dismiss = useSimStore((s) => s.dismissTip);
  if (dismissed) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>❦</Text>
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity onPress={() => dismiss(tipKey)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.close}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  icon: { color: colors.accent, fontSize: 14, marginTop: 1 },
  text: { flex: 1, color: colors.text, fontFamily: fonts.serif, fontSize: 13, lineHeight: 19 },
  close: { color: colors.textMuted, fontSize: 14, paddingHorizontal: 2 },
});
