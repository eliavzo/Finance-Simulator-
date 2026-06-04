/** "Extrablatt" — a decision card that requires the player to choose. */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSimStore } from '../store';
import { DecisionEffect } from '../types';
import { Rule } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney } from '../../utils/format';

function effectSummary(e: DecisionEffect): string {
  const parts: string[] = [];
  if (e.cash) parts.push(`GP-Cash ${e.cash >= 0 ? '+' : ''}${fmtMoney(e.cash)}`);
  if (e.fundCash) parts.push(`Fonds ${e.fundCash >= 0 ? '+' : ''}${fmtMoney(e.fundCash)}`);
  if (e.committed) parts.push(`Commitment +${fmtMoney(e.committed)}`);
  if (e.reputation) parts.push(`Reputation ${e.reputation >= 0 ? '+' : ''}${e.reputation}`);
  if (e.morale) parts.push(`Moral ${e.morale >= 0 ? '+' : ''}${e.morale}`);
  return parts.join(' · ') || 'Keine direkten Folgen';
}

export function DecisionModal() {
  const game = useSimStore((s) => s.game);
  const resolve = useSimStore((s) => s.resolveDecision);
  const card = game?.pendingDecision;
  if (!card) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.kicker}>EXTRABLATT</Text>
            <Text style={styles.title}>{card.title}</Text>
            <Rule />
            <Text style={styles.body}>{card.body}</Text>

            {card.choices.map((choice, i) => (
              <TouchableOpacity key={i} style={styles.choice} onPress={() => resolve(i)} activeOpacity={0.7}>
                <Text style={styles.choiceLabel}>{choice.label}</Text>
                <Text style={styles.choiceDesc}>{choice.description}</Text>
                <Text style={styles.choiceEffect}>{effectSummary(choice.effect)}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.colophon}>Eine Entscheidung ist zu treffen.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,10,0.7)', justifyContent: 'center', padding: spacing.md },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxHeight: '90%' },
  scroll: { padding: spacing.lg },
  kicker: { color: colors.negative, fontFamily: fonts.serifBold, fontSize: 11, letterSpacing: 3, textAlign: 'center', marginTop: spacing.xs },
  title: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 26, lineHeight: 30, textAlign: 'center', marginBottom: spacing.xs },
  body: { color: colors.text, fontFamily: fonts.serif, fontSize: 15, lineHeight: 22, marginVertical: spacing.md },
  choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, padding: spacing.md, marginBottom: spacing.sm },
  choiceLabel: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 15 },
  choiceDesc: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 13, marginTop: 2 },
  choiceEffect: { color: colors.accent, fontFamily: fonts.serif, fontSize: 12, marginTop: spacing.xs },
  colophon: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 10, textAlign: 'center', letterSpacing: 1, marginTop: spacing.sm },
});
