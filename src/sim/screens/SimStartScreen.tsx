/** Front page — pick a fund thesis & starting scenario, then launch. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSimStore } from '../store';
import { THESES, THESIS_ORDER } from '../thesis';
import { SCENARIOS, SCENARIO_ORDER } from '../scenarios';
import { FundThesis, Scenario } from '../types';
import { Button, Masthead, Rule } from '../../components/ui';
import { colors, fonts, spacing } from '../../utils/theme';

export function SimStartScreen() {
  const newGame = useSimStore((s) => s.newGame);
  const [thesis, setThesis] = useState<FundThesis>('multistrat');
  const [scenario, setScenario] = useState<Scenario>('normal');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Masthead title="Alpha & Carry" dateline="Die Finanz-Chronik · Gegründet im Jahr I · Preis 2 / 20" />

      <Text style={styles.headline}>Gründe deinen Fonds</Text>
      <Text style={styles.standfirst}>
        Wähle deine Strategie und das Marktumfeld, in dem du startest. Beides verändert, wie sich dein
        Haus über die nächsten zwanzig Jahre spielt.
      </Text>

      <SectionLabel text="Strategie des Hauses" />
      {THESIS_ORDER.map((key) => (
        <SelectRow
          key={key}
          label={THESES[key].label}
          blurb={THESES[key].blurb}
          selected={thesis === key}
          onPress={() => setThesis(key)}
        />
      ))}

      <View style={{ height: spacing.md }} />
      <SectionLabel text="Startszenario" />
      {SCENARIO_ORDER.map((key) => (
        <SelectRow
          key={key}
          label={SCENARIOS[key].label}
          blurb={SCENARIOS[key].blurb}
          selected={scenario === key}
          onPress={() => setScenario(key)}
        />
      ))}

      <Rule />
      <Button title="Erste Ausgabe drucken" onPress={() => newGame({ thesis, scenario })} variant="primary" style={styles.cta} />
      <Text style={styles.disclaimer}>Sämtliche Märkte sind simuliert. Keine echten Daten, keine externen Dienste.</Text>
    </ScrollView>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function SelectRow({ label, blurb, selected, onPress }: { label: string; blurb: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.row, selected && styles.rowSelected]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.marker, selected && styles.markerOn]}>{selected ? '▸' : ' '}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, selected && styles.rowLabelOn]}>{label}</Text>
        <Text style={[styles.rowBlurb, selected && styles.rowBlurbOn]}>{blurb}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl * 2 },
  headline: { color: colors.text, fontFamily: fonts.displayBlack, fontSize: 28, textAlign: 'center', marginTop: spacing.sm },
  standfirst: { color: colors.text, fontFamily: fonts.serifItalic, fontSize: 14, lineHeight: 21, textAlign: 'center', marginVertical: spacing.md },
  sectionLabel: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.xs },
  row: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  rowSelected: { backgroundColor: colors.primary },
  marker: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 16, width: 14 },
  markerOn: { color: colors.paperText },
  rowLabel: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 15 },
  rowLabelOn: { color: colors.paperText },
  rowBlurb: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 12, marginTop: 2, lineHeight: 17 },
  rowBlurbOn: { color: colors.paperText, opacity: 0.85 },
  cta: { marginTop: spacing.md },
  disclaimer: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
