/** A special one-off deal offered to the fund: invest a chosen amount or pass. */
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { Button, Rule } from '../../components/ui';
import { AmountStepper } from '../../components/controls';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney } from '../../utils/format';

export function OpportunityModal() {
  const game = useSimStore((s) => s.game);
  const accept = useSimStore((s) => s.acceptOpportunity);
  const decline = useSimStore((s) => s.declineOpportunity);
  const opp = game?.pendingOpportunity;
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (opp) setAmount(opp.minInvest);
  }, [opp?.id]);

  if (!opp) return null;
  const cash = game?.portfolio.cash ?? 0;
  const maxAffordable = Math.min(opp.maxInvest, Math.floor(cash / 100_000) * 100_000);

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Rule double />
            <Text style={styles.kicker}>GELEGENHEIT</Text>
            <Text style={styles.title}>{opp.title}</Text>
            <Rule />
            <Text style={styles.body}>{opp.body}</Text>
            <Text style={styles.meta}>Profil: {opp.expected} · Bindung ~{opp.resolveMonths} Monate</Text>

            <Text style={styles.label}>Investitionsbetrag (max {fmtMoney(opp.maxInvest)})</Text>
            <AmountStepper value={amount} onChange={setAmount} step={500_000} min={opp.minInvest} max={Math.max(opp.minInvest, maxAffordable)} />
            <Text style={styles.cash}>Fonds-Cash: {fmtMoney(cash)}</Text>

            <Button title="Investieren" variant="positive" onPress={() => accept(amount)} style={{ marginTop: spacing.md }} />
            <Button title="Ablehnen" variant="secondary" onPress={decline} style={{ marginTop: spacing.sm }} />
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
  kicker: { color: colors.accent, fontFamily: fonts.serifBold, fontSize: 11, letterSpacing: 3, textAlign: 'center', marginTop: spacing.xs },
  title: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 26, lineHeight: 30, textAlign: 'center', marginBottom: spacing.xs },
  body: { color: colors.text, fontFamily: fonts.serif, fontSize: 15, lineHeight: 22, marginVertical: spacing.md },
  meta: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 12, marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontFamily: fonts.serifBold, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs },
  cash: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 12, marginTop: spacing.xs },
});
