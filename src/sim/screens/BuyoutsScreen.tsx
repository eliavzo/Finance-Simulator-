/** v2 Buyouts: acquire companies via LBO, improve them, exit for a profit. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import {
  ebitdaOf,
  enterpriseValue,
  equityValue,
  exitMultiple,
  exitProceeds,
  companyMoic,
  debtRate,
} from '../buyouts';
import { BuyoutTarget, PortfolioCompany } from '../types';
import { SimHeader } from './SimHeader';
import { notify } from '../../utils/notify';
import { Button, Card, Pill, SectionTitle, StatTile } from '../../components/ui';
import { Segmented, AmountStepper } from '../../components/controls';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtMultiple, fmtPct } from '../../utils/format';

export function BuyoutsScreen() {
  const game = useSimStore((s) => s.game)!;
  const econ = game.economy;
  const companies = game.buyouts.companies;
  const totalEquity = companies.reduce((s, c) => s + equityValue(c, econ), 0);

  return (
    <View style={styles.container}>
      <SimHeader title="Buyouts" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <SectionTitle>Beteiligungs-Portfolio</SectionTitle>
          <View style={styles.statRow}>
            <StatTile label="Eigenkapitalwert" value={fmtMoney(totalEquity)} />
            <StatTile label="Beteiligungen" value={`${companies.length}`} />
            <StatTile label="Fonds-Cash" value={fmtMoney(game.portfolio.cash)} />
          </View>
        </Card>

        <Card>
          <SectionTitle ornament>Deine Beteiligungen</SectionTitle>
          {companies.length === 0 ? (
            <Text style={styles.empty}>Noch keine Firmen im Besitz. Kaufe unten ein Übernahmeziel.</Text>
          ) : (
            companies.map((c) => <CompanyCard key={c.id} c={c} />)
          )}
        </Card>

        <Card>
          <SectionTitle ornament>Übernahmeziele</SectionTitle>
          {game.buyouts.targets.map((t) => (
            <TargetRow key={t.id} t={t} cash={game.portfolio.cash} />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function CompanyCard({ c }: { c: PortfolioCompany }) {
  const game = useSimStore((s) => s.game)!;
  const improve = useSimStore((s) => s.improveCompany);
  const payDebt = useSimStore((s) => s.payCompanyDebt);
  const sell = useSimStore((s) => s.sellCompany);
  const econ = game.economy;
  const [payAmt, setPayAmt] = useState(1_000_000);

  const ebitda = ebitdaOf(c);
  const ev = enterpriseValue(c, econ);
  const eq = equityValue(c, econ);
  const moic = companyMoic(c, econ);
  const interest = c.debt * debtRate(econ);
  const distress = c.distressMonths > 0 || ebitda < interest;
  const act = (lever: 'cut' | 'grow' | 'addon') => {
    const r = improve(c.id, lever);
    if (!r.ok) notify('Nicht möglich', r.error ?? '');
  };

  return (
    <View style={styles.company}>
      <View style={styles.coHead}>
        <Text style={styles.coName}>{c.name}</Text>
        {distress ? <Pill text="DISTRESS" color={colors.negative} /> : <Pill text={c.sector} color={colors.textMuted} />}
      </View>
      <View style={styles.statRow}>
        <StatTile label="Umsatz" value={fmtMoney(c.revenue)} />
        <StatTile label="EBITDA" value={fmtMoney(ebitda)} hint={fmtPct(c.ebitdaMargin, 0) + ' Marge'} />
        <StatTile label="Wachstum" value={fmtPct(c.growthRate)} />
      </View>
      <View style={styles.statRow}>
        <StatTile label="Unternehmenswert" value={fmtMoney(ev)} hint={`${exitMultiple(c.sector, c.quality, econ).toFixed(1)}× EBITDA`} />
        <StatTile label="Schulden" value={fmtMoney(c.debt)} valueColor={distress ? colors.negative : colors.text} />
        <StatTile label="MOIC" value={fmtMultiple(moic)} valueColor={moic >= 1 ? colors.positive : colors.negative} />
      </View>
      <Text style={styles.coMeta}>Eigenkapitalwert {fmtMoney(eq)} · eingesetzt {fmtMoney(c.equityInvested)} · Zinslast {fmtMoney(interest)}/J</Text>

      <View style={styles.btnRow}>
        <Button title="Kosten −" variant="secondary" onPress={() => act('cut')} style={styles.smallBtn} />
        <Button title="Wachstum +" variant="secondary" onPress={() => act('grow')} style={styles.smallBtn} />
        <Button title="Add-on" variant="secondary" onPress={() => act('addon')} style={styles.smallBtn} />
      </View>
      <Text style={styles.label}>Schulden tilgen</Text>
      <AmountStepper value={payAmt} onChange={setPayAmt} step={500_000} min={500_000} max={Math.max(500_000, c.debt)} />
      <View style={styles.btnRow}>
        <Button title="Tilgen" variant="secondary" onPress={() => { const r = payDebt(c.id, payAmt); if (!r.ok) notify('Nicht möglich', r.error ?? ''); }} style={styles.smallBtn} />
        <Button title={`Exit · ${fmtMoney(exitProceeds(c, econ))}`} variant="positive" onPress={() => sell(c.id)} style={styles.smallBtn} />
      </View>
    </View>
  );
}

function TargetRow({ t, cash }: { t: BuyoutTarget; cash: number }) {
  const game = useSimStore((s) => s.game)!;
  const acquire = useSimStore((s) => s.acquireCompany);
  const [lev, setLev] = useState('0.5');
  const ebitda = ebitdaOf(t);
  const ev = ebitda * t.askingMultiple;
  const leverage = parseFloat(lev);
  const equityNeeded = ev * (1 - leverage);
  const affordable = equityNeeded <= cash;

  return (
    <View style={styles.target}>
      <View style={styles.coHead}>
        <Text style={styles.coName}>{t.name}</Text>
        <Pill text={t.sector} color={colors.textMuted} />
      </View>
      <Text style={styles.coMeta}>
        Umsatz {fmtMoney(t.revenue)} · EBITDA {fmtMoney(ebitda)} ({fmtPct(t.ebitdaMargin, 0)}) · Wachstum {fmtPct(t.growthRate)} · Qualität {(t.quality * 100).toFixed(0)}
      </Text>
      <Text style={styles.coMeta}>Preis {t.askingMultiple.toFixed(1)}× EBITDA = {fmtMoney(ev)} Unternehmenswert</Text>
      <Text style={styles.label}>Fremdkapital-Anteil</Text>
      <Segmented<string>
        value={lev}
        onChange={setLev}
        options={[{ label: '0%', value: '0' }, { label: '30%', value: '0.3' }, { label: '50%', value: '0.5' }, { label: '70%', value: '0.7' }]}
      />
      <Button
        title={`Kaufen · EK ${fmtMoney(equityNeeded)}`}
        variant={affordable ? 'primary' : 'secondary'}
        disabled={!affordable}
        onPress={() => { const r = acquire(t.id, leverage); if (!r.ok) notify('Nicht möglich', r.error ?? ''); }}
        style={{ marginTop: spacing.sm }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  company: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  target: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  coHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  coName: { color: colors.text, fontFamily: fonts.serifBold, fontSize: 16, flex: 1 },
  coMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  label: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs, fontFamily: fonts.serifBold },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  smallBtn: { flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
});
