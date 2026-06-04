/** v2 Firm: capabilities, payroll, the team, hiring and infrastructure upgrades. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore, useCapabilities } from '../store';
import { Employee, Infrastructure, Role } from '../types';
import { ROLE_LABEL, monthlyPayroll, infraMonthlyOpex, upgradeCost, MAX_TIER } from '../firm';
import { THESES } from '../thesis';
import { SimHeader } from './SimHeader';
import { notify } from '../../utils/notify';
import { Button, Card, Pill, ProgressBar, SectionTitle, StatTile } from '../../components/ui';
import { Segmented } from '../../components/controls';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtPct } from '../../utils/format';

const ROLES: Role[] = ['Analyst', 'Trader', 'PortfolioManager', 'Quant', 'RiskManager', 'InvestorRelations', 'COO'];
const INFRA_LABEL: Record<keyof Infrastructure, string> = {
  dataTier: 'Daten & Research', primeBrokerTier: 'Prime Broker', quantTier: 'Quant/Tech', officeTier: 'Office & Ops',
};

function moraleColor(m: number) {
  return m >= 66 ? colors.positive : m >= 40 ? colors.warning : colors.negative;
}

export function FirmScreen() {
  const game = useSimStore((s) => s.game)!;
  const caps = useCapabilities()!;
  const refreshCandidates = useSimStore((s) => s.refreshCandidates);
  const hire = useSimStore((s) => s.hire);
  const fire = useSimStore((s) => s.fire);
  const upgrade = useSimStore((s) => s.upgrade);
  const candidates = useSimStore((s) => s.candidates);
  const candidateSearchMonth = useSimStore((s) => s.candidateSearchMonth);

  const [role, setRole] = useState<Role>('Analyst');
  const searchedThisMonth = candidateSearchMonth[role] === game.month;
  const firm = game.firm;
  const payroll = monthlyPayroll(firm);
  const opex = infraMonthlyOpex(firm.infrastructure);

  return (
    <View style={styles.container}>
      <SimHeader title="Firma" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <SectionTitle>GP-Cash & Kosten · {THESES[game.thesis].label}</SectionTitle>
          <Text style={styles.big}>{fmtMoney(firm.cash)}</Text>
          <View style={styles.statRow}>
            <StatTile label="Gehälter/M" value={fmtMoney(payroll)} valueColor={colors.negative} />
            <StatTile label="Infra/M" value={fmtMoney(opex)} valueColor={colors.negative} />
            <StatTile label="Burn/M" value={fmtMoney(payroll + opex)} valueColor={colors.negative} />
          </View>
        </Card>

        <Card>
          <SectionTitle>Fähigkeiten (Team + Infrastruktur)</SectionTitle>
          <CapBar label="Research-Edge" value={caps.research} />
          <CapBar label="Execution" value={caps.execution} />
          <CapBar label="Risk Control" value={caps.risk} />
          <CapBar label="Fundraising" value={caps.fundraising} />
          <Text style={styles.hint}>Monatliches Alpha: {fmtPct(caps.monthlyAlpha, 2)} · Kapazität: {caps.capacityPositions} Positionen</Text>
        </Card>

        <Card>
          <SectionTitle ornament>Team-Beitrag · Letzter Monat</SectionTitle>
          <View style={styles.statRow}>
            <StatTile label="Alpha (P&L)" value={fmtMoney(game.lastContribution.alphaPnl)} valueColor={game.lastContribution.alphaPnl >= 0 ? colors.positive : colors.negative} />
            <StatTile label="Finanz. gespart" value={fmtMoney(game.lastContribution.financingSaved)} valueColor={colors.positive} />
          </View>
          <View style={styles.statRow}>
            <StatTile label="MC vermieden" value={`${game.lastContribution.marginCallsPrevented}`} />
            <StatTile label="Kapital geraist" value={fmtMoney(game.lastContribution.capitalRaised)} />
          </View>
          <Text style={styles.hint}>
            Die Wirkung des Teams entsteht am offenen Buch: mehr Positionen & Hebel ⇒ mehr Alpha und mehr gesparte Finanzierung.
          </Text>
        </Card>

        <Card>
          <SectionTitle>Team ({firm.employees.length})</SectionTitle>
          {firm.employees.length === 0 ? <Text style={styles.empty}>Kein Personal. Stelle jemanden ein.</Text> : null}
          {firm.employees.map((e) => (
            <View key={e.id} style={styles.empRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{e.name}</Text>
                <Text style={styles.empMeta}>{ROLE_LABEL[e.role]} · Skill {e.skill} · {fmtMoney(e.salary)}/J</Text>
                <View style={styles.moraleRow}>
                  <Text style={styles.moraleLabel}>Moral</Text>
                  <View style={{ flex: 1 }}><ProgressBar value={e.morale / 100} color={moraleColor(e.morale)} /></View>
                </View>
              </View>
              <Button title="Entlassen" variant="secondary" onPress={() => fire(e.id)} style={styles.smallBtn} />
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle>Einstellen</SectionTitle>
          <Segmented<Role>
            value={role}
            onChange={setRole}
            options={ROLES.slice(0, 4).map((r) => ({ label: r === 'PortfolioManager' ? 'PM' : r, value: r }))}
          />
          <Segmented<Role>
            value={role}
            onChange={setRole}
            options={ROLES.slice(4).map((r) => ({ label: r === 'InvestorRelations' ? 'IR' : r, value: r }))}
          />
          <Button
            title={searchedThisMonth ? 'Diesen Monat bereits gesucht' : 'Kandidaten suchen'}
            variant="secondary"
            disabled={searchedThisMonth}
            onPress={() => refreshCandidates(role)}
            style={{ marginTop: spacing.sm }}
          />
          <Text style={styles.hint}>Niveau der Kandidaten steigt mit deiner Reputation. Eine Suche pro Rolle und Monat.</Text>
          {(candidates[role] ?? []).map((c: Employee) => (
            <View key={c.id} style={styles.candRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{c.name}</Text>
                <Text style={styles.empMeta}>{ROLE_LABEL[c.role]} · Skill {c.skill} · {fmtMoney(c.salary)}/J</Text>
                <Text style={styles.hint}>Einstellungsgebühr {fmtMoney(c.salary * 0.2)}</Text>
              </View>
              <Button title="Einstellen" variant="positive" onPress={() => { const r = hire(c); if (!r.ok) notify('Nicht möglich', r.error ?? ''); }} style={styles.smallBtn} />
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle>Infrastruktur</SectionTitle>
          {(Object.keys(INFRA_LABEL) as (keyof Infrastructure)[]).map((track) => {
            const tier = firm.infrastructure[track];
            const maxed = tier >= MAX_TIER;
            const cost = maxed ? 0 : upgradeCost(track, tier);
            return (
              <View key={track} style={styles.infraRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName}>{INFRA_LABEL[track]}</Text>
                  <Text style={styles.empMeta}>Stufe {tier}/{MAX_TIER}</Text>
                </View>
                {maxed ? (
                  <Pill text="MAX" color={colors.positive} />
                ) : (
                  <Button title={`Upgrade ${fmtMoney(cost)}`} variant="secondary" onPress={() => { const r = upgrade(track); if (!r.ok) notify('Nicht möglich', r.error ?? ''); }} style={styles.smallBtn} />
                )}
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

function CapBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.capRow}>
      <Text style={styles.capLabel}>{label}</Text>
      <View style={{ flex: 1 }}><ProgressBar value={value} color={colors.primary} /></View>
      <Text style={styles.capVal}>{(value * 100).toFixed(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  big: { color: colors.text, fontSize: 30, fontFamily: fonts.displayBlack, marginBottom: spacing.sm },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  empRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  candRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  infraRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  empName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  empMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  moraleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  moraleLabel: { color: colors.textMuted, fontSize: 10, width: 36 },
  smallBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  capLabel: { color: colors.text, fontSize: 12, width: 96 },
  capVal: { color: colors.textMuted, fontSize: 12, width: 24, textAlign: 'right' },
});
