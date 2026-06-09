/** Front page — pick a fund thesis & starting scenario, then launch. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSimStore } from '../store';
import { THESES, THESIS_ORDER } from '../thesis';
import { SCENARIOS, SCENARIO_ORDER } from '../scenarios';
import { PRESETS, DEFAULT_DIFFICULTY, UNLOCK_AT, difficultyParams, presetLabel, heatLabel, MODIFIER_LABEL, LEVEL_LABEL, ModifierKey, computeUnlocks, levelUnlocked, presetUnlocked, nextUnlockHint, Unlocks } from '../difficulty';
import { DifficultyConfig, DifficultyLevel, FundThesis, Scenario } from '../types';
import { Button, Masthead, Rule } from '../../components/ui';
import { Segmented } from '../../components/controls';
import { useLang, useTr, Lang, tr, LANGS, LANG_LABEL } from '../../i18n';
import { colors, fonts, spacing } from '../../utils/theme';

const MOD_KEYS: ModifierKey[] = ['market', 'capital', 'fees', 'rivals'];

function presetRequirement(cfg: DifficultyConfig, u: Unlocks, lang: Lang): string {
  const parts: string[] = [];
  const needsBrutal = MOD_KEYS.some((k) => cfg[k] === 2);
  const needsHard = MOD_KEYS.some((k) => cfg[k] >= 1);
  if (needsBrutal && !u.brutal) parts.push(tr(lang, { de: `„Brutal" (${UNLOCK_AT.brutal} Renommee)`, en: `“Brutal” (${UNLOCK_AT.brutal} renown)` }));
  else if (needsHard && !u.hard) parts.push(tr(lang, { de: `„Hart" (${UNLOCK_AT.hard} Renommee)`, en: `“Hard” (${UNLOCK_AT.hard} renown)` }));
  if (cfg.ironman && !u.ironman) parts.push(tr(lang, { de: `Ironman (${UNLOCK_AT.ironman} Renommee + 1 Lauf)`, en: `Ironman (${UNLOCK_AT.ironman} renown + 1 run)` }));
  return tr(lang, { de: `🔒 Benötigt ${parts.join(' + ')}`, en: `🔒 Requires ${parts.join(' + ')}` });
}

export function SimStartScreen() {
  const newGame = useSimStore((s) => s.newGame);
  const meta = useSimStore((s) => s.meta);
  const lang = useLang();
  const setLang = useSimStore((s) => s.setLang);
  const t = useTr();
  const unlocks = computeUnlocks(meta);
  const [officeName, setOfficeName] = useState('');
  const [thesis, setThesis] = useState<FundThesis>('multistrat');
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [difficulty, setDifficulty] = useState<DifficultyConfig>(DEFAULT_DIFFICULTY);
  const dp = difficultyParams(difficulty);
  const trimmedName = officeName.trim();
  const canStart = trimmedName.length >= 2;
  const setLevel = (key: ModifierKey, level: DifficultyLevel) => {
    if (!levelUnlocked(level, unlocks)) return;
    setDifficulty({ ...difficulty, [key]: level });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Masthead title="Alpha & Carry" dateline={t({ de: 'Die Finanz-Chronik · Gegründet im Jahr I · Preis 2 / 20', en: 'The Financial Chronicle · Founded in Year I · Price 2 / 20' })} />

      <View style={styles.langRow}>
        <Segmented<string>
          value={lang}
          onChange={(v) => setLang(v as Lang)}
          options={LANGS.map((l) => ({ label: LANG_LABEL[l], value: l }))}
        />
      </View>

      <Text style={styles.headline}>{t({ de: 'Gründe deinen Fonds', en: 'Found Your Fund' })}</Text>
      <Text style={styles.standfirst}>
        {t({
          de: 'Gib deinem Haus einen Namen, wähle Strategie und Marktumfeld. Alles prägt, wie sich die nächsten zwanzig Jahre spielen.',
          en: 'Give your house a name, pick a strategy and market backdrop. Everything shapes how the next twenty years play out.',
        })}
      </Text>

      <SectionLabel text={t({ de: 'Name des Hauses', en: 'Name of the House' })} />
      <TextInput
        style={styles.nameInput}
        value={officeName}
        onChangeText={setOfficeName}
        placeholder={t({ de: 'z. B. Nordstern Capital', en: 'e.g. Nordstern Capital' })}
        placeholderTextColor={colors.textMuted}
        maxLength={32}
        returnKeyType="done"
      />

      <SectionLabel text={t({ de: 'Strategie des Hauses', en: 'House Strategy' })} />
      {THESIS_ORDER.map((key) => (
        <SelectRow
          key={key}
          label={t(THESES[key].label)}
          blurb={t(THESES[key].blurb)}
          selected={thesis === key}
          onPress={() => setThesis(key)}
        />
      ))}

      <View style={{ height: spacing.md }} />
      <SectionLabel text={t({ de: 'Startszenario', en: 'Starting Scenario' })} />
      {SCENARIO_ORDER.map((key) => (
        <SelectRow
          key={key}
          label={t(SCENARIOS[key].label)}
          blurb={t(SCENARIOS[key].blurb)}
          selected={scenario === key}
          onPress={() => setScenario(key)}
        />
      ))}

      <View style={{ height: spacing.md }} />
      <SectionLabel text={`${t({ de: 'Schwierigkeit', en: 'Difficulty' })} · ${presetLabel(difficulty, lang)}`} />
      <Text style={styles.renommee}>{t({ de: 'Renommee', en: 'Renown' })}: {meta.renommee} · {nextUnlockHint(meta, lang)}</Text>
      {PRESETS.map((p) => {
        const locked = !presetUnlocked(p.config, unlocks);
        return (
          <SelectRow
            key={p.id}
            label={t(p.label)}
            blurb={locked ? presetRequirement(p.config, unlocks, lang) : t(p.blurb)}
            selected={presetLabel(difficulty, lang) === t(p.label)}
            locked={locked}
            onPress={() => !locked && setDifficulty(p.config)}
          />
        );
      })}

      <Text style={styles.tuneLabel}>{t({ de: 'Feinjustierung', en: 'Fine-Tuning' })}</Text>
      {MOD_KEYS.map((key) => (
        <View key={key} style={styles.modRow}>
          <Text style={styles.modName}>{t(MODIFIER_LABEL[key])}</Text>
          <Segmented<string>
            value={String(difficulty[key])}
            onChange={(v) => setLevel(key, parseInt(v, 10) as DifficultyLevel)}
            options={([-1, 0, 1, 2] as DifficultyLevel[]).map((lv) => ({ label: t(LEVEL_LABEL[key][lv + 1]), value: String(lv), disabled: !levelUnlocked(lv, unlocks) }))}
          />
        </View>
      ))}
      <View style={styles.modRow}>
        <Text style={styles.modName}>{t({ de: 'Ironman (kein Reset)', en: 'Ironman (no reset)' })}</Text>
        <Segmented<string>
          value={difficulty.ironman ? '1' : '0'}
          onChange={(v) => { if (v === '0' || unlocks.ironman) setDifficulty({ ...difficulty, ironman: v === '1' }); }}
          options={[{ label: t({ de: 'Aus', en: 'Off' }), value: '0' }, { label: t({ de: 'An', en: 'On' }), value: '1', disabled: !unlocks.ironman }]}
        />
      </View>
      <Text style={styles.heatLine}>
        {t({ de: 'Härtegrad', en: 'Heat' })}: {heatLabel(dp.heat, lang)} ({dp.heat >= 0 ? '+' : ''}{dp.heat}) · Score ×{dp.scoreMult.toFixed(2)}
      </Text>

      <Rule />
      <Button
        title={canStart ? t({ de: 'Erste Ausgabe drucken', en: 'Print the First Edition' }) : t({ de: 'Erst dem Haus einen Namen geben', en: 'First give the house a name' })}
        onPress={() => newGame({ thesis, scenario, officeName: trimmedName, difficulty })}
        variant="primary"
        disabled={!canStart}
        style={styles.cta}
      />
      <Text style={styles.disclaimer}>{t({ de: 'Sämtliche Märkte sind simuliert. Keine echten Daten, keine externen Dienste.', en: 'All markets are simulated. No real data, no external services.' })}</Text>
    </ScrollView>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function SelectRow({ label, blurb, selected, onPress, locked }: { label: string; blurb: string; selected: boolean; onPress: () => void; locked?: boolean }) {
  return (
    <TouchableOpacity style={[styles.row, selected && styles.rowSelected, locked && styles.rowLocked]} onPress={onPress} disabled={locked} activeOpacity={0.7}>
      <Text style={[styles.marker, selected && styles.markerOn]}>{locked ? '🔒' : selected ? '▸' : ' '}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, selected && styles.rowLabelOn, locked && styles.rowLockedText]}>{label}</Text>
        <Text style={[styles.rowBlurb, selected && styles.rowBlurbOn, locked && styles.rowLockedText]}>{blurb}</Text>
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
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  rowSelected: { backgroundColor: colors.primary },
  marker: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 16, width: 14 },
  markerOn: { color: colors.paperText },
  rowLabel: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 15 },
  rowLabelOn: { color: colors.paperText },
  rowBlurb: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 12, marginTop: 2, lineHeight: 17 },
  rowBlurbOn: { color: colors.paperText, opacity: 0.85 },
  langRow: { marginTop: spacing.sm, marginBottom: spacing.xs },
  renommee: { color: colors.accent, fontFamily: fonts.serifBold, fontSize: 12, marginBottom: spacing.sm },
  rowLocked: { opacity: 0.55 },
  rowLockedText: { color: colors.textMuted },
  tuneLabel: { color: colors.textMuted, fontFamily: fonts.serifBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.sm, marginBottom: spacing.xs },
  modRow: { marginBottom: spacing.sm },
  modName: { color: colors.text, fontFamily: fonts.serif, fontSize: 13, marginBottom: 2 },
  heatLine: { color: colors.accent, fontFamily: fonts.serifBold, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xs },
  cta: { marginTop: spacing.md },
  disclaimer: { color: colors.textMuted, fontFamily: fonts.serifItalic, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
