/** v2 Risk: parametric VaR, exposures/leverage, net beta and stress scenarios. */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { portfolioNav, exposures } from '../portfolio';
import { computeRisk, STRESS_SCENARIOS, stressPnl } from '../risk';
import { SimHeader } from './SimHeader';
import { Card, SectionTitle, StatTile } from '../../components/ui';
import { colors, spacing } from '../../utils/theme';
import { fmtMoney, fmtNum, fmtPct } from '../../utils/format';

export function RiskScreen() {
  const game = useSimStore((s) => s.game)!;
  const nav = useMemo(() => portfolioNav(game.portfolio, game.instruments), [game.portfolio, game.instruments]);
  const risk = useMemo(() => computeRisk(game.portfolio, game.instruments, game.economy), [game.portfolio, game.instruments, game.economy]);
  const exp = useMemo(() => exposures(game.portfolio, game.instruments), [game.portfolio, game.instruments]);

  const grossLeverage = nav > 0 ? exp.gross / nav : 0;
  const netLeverage = nav > 0 ? exp.net / nav : 0;

  return (
    <View style={styles.container}>
      <SimHeader title="Risiko" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <SectionTitle>Value at Risk (1 Monat)</SectionTitle>
          <View style={styles.statRow}>
            <StatTile label="VaR 95%" value={fmtMoney(risk.var95)} valueColor={colors.warning} hint={nav > 0 ? fmtPct(risk.var95 / nav) + ' des NAV' : undefined} />
            <StatTile label="VaR 99%" value={fmtMoney(risk.var99)} valueColor={colors.negative} hint={nav > 0 ? fmtPct(risk.var99 / nav) + ' des NAV' : undefined} />
          </View>
        </Card>

        <Card>
          <SectionTitle>Exposure & Hebel</SectionTitle>
          <View style={styles.statRow}>
            <StatTile label="Brutto" value={fmtMoney(exp.gross)} hint={`${fmtNum(grossLeverage)}x NAV`} />
            <StatTile label="Netto" value={fmtMoney(exp.net)} hint={`${fmtNum(netLeverage)}x NAV`} />
          </View>
          <View style={styles.statRow}>
            <StatTile label="Longs" value={fmtMoney(exp.longs)} valueColor={colors.positive} />
            <StatTile label="Shorts" value={fmtMoney(exp.shorts)} valueColor={colors.negative} />
            <StatTile label="Netto-β·$" value={fmtMoney(risk.netBeta)} />
          </View>
        </Card>

        <Card>
          <SectionTitle>Stress-Szenarien (Buch-P&L)</SectionTitle>
          {game.portfolio.positions.length === 0 ? (
            <Text style={styles.empty}>Keine Positionen — kein Risiko zu stressen.</Text>
          ) : (
            STRESS_SCENARIOS.map((sc) => {
              const pnl = stressPnl(sc, game.portfolio, game.instruments, game.economy);
              const pct = nav > 0 ? pnl / nav : 0;
              return (
                <View key={sc.id} style={styles.stressRow}>
                  <Text style={styles.stressName}>{sc.name}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.stressPnl, { color: pnl >= 0 ? colors.positive : colors.negative }]}>{fmtMoney(pnl)}</Text>
                    <Text style={[styles.stressPct, { color: pnl >= 0 ? colors.positive : colors.negative }]}>{fmtPct(pct)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Card>
          <SectionTitle>Hinweis</SectionTitle>
          <Text style={styles.note}>
            VaR ist ein 1-Faktor-Parametermodell (Markt-Beta + idiosynkratische Vola). Ein starkes Risk-Management-Team
            (Firma-Tab) senkt Margin-Call-Risiken und gibt mehr Puffer. Hoher Hebel multipliziert sowohl Alpha als auch
            Drawdowns.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  stressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  stressName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  stressPnl: { fontSize: 15, fontWeight: '800' },
  stressPct: { fontSize: 12, fontWeight: '600' },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
