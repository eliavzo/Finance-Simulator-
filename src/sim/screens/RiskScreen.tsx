/** v2 Risk: VaR, exposures/leverage, stress scenarios, crisis status & hedging. */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSimStore } from '../store';
import { portfolioNav, exposures } from '../portfolio';
import { computeRisk, STRESS_SCENARIOS, stressPnl } from '../risk';
import { benchmarkTrailing } from '../engine';
import { trailingReturn } from '../rivals';
import { CRISIS_DESC, CRISIS_LABEL, HEDGE_MONTHLY_PREMIUM } from '../crises';
import { SimHeader } from './SimHeader';
import { TabTip } from '../../components/TabTip';
import { notify } from '../../utils/notify';
import { useTr } from '../../i18n';
import { Button, Card, Pill, SectionTitle, StatTile } from '../../components/ui';
import { AmountStepper, Segmented } from '../../components/controls';
import { colors, fonts, spacing } from '../../utils/theme';
import { fmtMoney, fmtNum, fmtPct, fmtPctSigned } from '../../utils/format';

export function RiskScreen() {
  const t = useTr();
  const game = useSimStore((s) => s.game)!;
  const buyHedge = useSimStore((s) => s.buyHedge);
  const [hedgeNotional, setHedgeNotional] = useState(5_000_000);
  const [hedgeMonths, setHedgeMonths] = useState(6);
  const nav = useMemo(() => portfolioNav(game.portfolio, game.instruments), [game.portfolio, game.instruments]);
  const risk = useMemo(() => computeRisk(game.portfolio, game.instruments, game.economy), [game.portfolio, game.instruments, game.economy]);
  const exp = useMemo(() => exposures(game.portfolio, game.instruments), [game.portfolio, game.instruments]);

  const grossLeverage = nav > 0 ? exp.gross / nav : 0;
  const netLeverage = nav > 0 ? exp.net / nav : 0;

  const player12 = trailingReturn(game.portfolio.returnHistory, 12);
  const bench12 = benchmarkTrailing(game.benchmarkHistory, 12);
  const has12 = game.portfolio.returnHistory.length >= 12 && Number.isFinite(player12) && Number.isFinite(bench12);
  const alpha12 = player12 - bench12;

  return (
    <View style={styles.container}>
      <SimHeader title={t({ de: 'Risiko', en: 'Risk' })} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TabTip tipKey="risiko" text={t({ de: 'Prüfe VaR, Drawdown & Stress-Szenarien — und kaufe vor Krisen eine Absicherung, die in Crashs und Krisen auszahlt.', en: 'Check VaR, drawdown & stress scenarios — and buy a hedge before crises that pays out in crashes and crises.' })} />
        {game.crisis ? (
          <View style={styles.crisisBanner}>
            <Text style={styles.crisisTitle}>⚠ {t(CRISIS_LABEL[game.crisis.type])} · {t({ de: 'noch', en: 'still' })} {game.crisis.monthsRemaining} {t({ de: 'Monate', en: 'months' })}</Text>
            <Text style={styles.crisisDesc}>{t(CRISIS_DESC[game.crisis.type])}</Text>
          </View>
        ) : null}

        <Card>
          <SectionTitle>{t({ de: 'Absicherung (Tail-Hedge)', en: 'Hedge (tail hedge)' })}</SectionTitle>
          {game.hedge ? (
            <>
              <View style={styles.statRow}>
                <StatTile label={t({ de: 'Gedeckt', en: 'Covered' })} value={fmtMoney(game.hedge.notional)} />
                <StatTile label={t({ de: 'Läuft noch', en: 'Remaining' })} value={`${game.hedge.monthsRemaining} ${t({ de: 'Mon.', en: 'mo.' })}`} />
                <StatTile label={t({ de: 'Prämie/M', en: 'Premium/mo' })} value={fmtMoney(game.hedge.notional * HEDGE_MONTHLY_PREMIUM)} valueColor={colors.negative} />
              </View>
              <Text style={styles.note}>{t({ de: 'Zahlt bei Black Swans & Krisen aus. Du kannst sie durch einen neuen Kauf ersetzen.', en: 'Pays out on black swans & crises. You can replace it with a new purchase.' })}</Text>
            </>
          ) : (
            <Text style={styles.note}>{t({ de: 'Kein aktiver Hedge. Versicherung kostet Rendite, rettet aber in Crashs.', en: 'No active hedge. Insurance costs return but saves you in crashes.' })}</Text>
          )}
          <Text style={styles.label}>{t({ de: 'Deckungssumme', en: 'Coverage' })} ({t({ de: 'Prämie', en: 'premium' })} {fmtMoney(hedgeNotional * HEDGE_MONTHLY_PREMIUM)}/{t({ de: 'Monat', en: 'month' })})</Text>
          <AmountStepper value={hedgeNotional} onChange={setHedgeNotional} step={1_000_000} min={1_000_000} max={200_000_000} />
          <Text style={styles.label}>{t({ de: 'Laufzeit', en: 'Maturity' })}</Text>
          <Segmented<string>
            value={String(hedgeMonths)}
            onChange={(v) => setHedgeMonths(parseInt(v, 10))}
            options={[{ label: '3 M', value: '3' }, { label: '6 M', value: '6' }, { label: '12 M', value: '12' }]}
          />
          <Button
            title={t({ de: 'Absicherung kaufen', en: 'Buy hedge' })}
            variant="secondary"
            onPress={() => { const r = buyHedge(hedgeNotional, hedgeMonths); if (!r.ok) notify(t({ de: 'Nicht möglich', en: 'Not possible' }), r.error ?? ''); }}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Card>
          <SectionTitle>{t({ de: 'Value at Risk (1 Monat)', en: 'Value at Risk (1 month)' })}</SectionTitle>
          <View style={styles.statRow}>
            <StatTile label="VaR 95%" value={fmtMoney(risk.var95)} valueColor={colors.warning} hint={nav > 0 ? fmtPct(risk.var95 / nav) + t({ de: ' des NAV', en: ' of NAV' }) : undefined} />
            <StatTile label="VaR 99%" value={fmtMoney(risk.var99)} valueColor={colors.negative} hint={nav > 0 ? fmtPct(risk.var99 / nav) + t({ de: ' des NAV', en: ' of NAV' }) : undefined} />
            <StatTile
              label="Alpha (12M)"
              value={has12 ? fmtPctSigned(alpha12) : '—'}
              valueColor={has12 ? (alpha12 >= 0 ? colors.positive : colors.negative) : colors.textMuted}
              hint={t({ de: 'vs. Marktindex', en: 'vs. market index' })}
            />
          </View>
        </Card>

        <Card>
          <SectionTitle>{t({ de: 'Exposure & Hebel', en: 'Exposure & Leverage' })}</SectionTitle>
          <View style={styles.statRow}>
            <StatTile label={t({ de: 'Brutto', en: 'Gross' })} value={fmtMoney(exp.gross)} hint={`${fmtNum(grossLeverage)}x NAV`} />
            <StatTile label={t({ de: 'Netto', en: 'Net' })} value={fmtMoney(exp.net)} hint={`${fmtNum(netLeverage)}x NAV`} />
          </View>
          <View style={styles.statRow}>
            <StatTile label="Longs" value={fmtMoney(exp.longs)} valueColor={colors.positive} />
            <StatTile label="Shorts" value={fmtMoney(exp.shorts)} valueColor={colors.negative} />
            <StatTile label="Netto-β·$" value={fmtMoney(risk.netBeta)} />
          </View>
        </Card>

        <Card>
          <SectionTitle>{t({ de: 'Stress-Szenarien (Buch-P&L)', en: 'Stress scenarios (book P&L)' })}</SectionTitle>
          {game.portfolio.positions.length === 0 ? (
            <Text style={styles.empty}>{t({ de: 'Keine Positionen — kein Risiko zu stressen.', en: 'No positions — no risk to stress.' })}</Text>
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
          <SectionTitle>{t({ de: 'Hinweis', en: 'Note' })}</SectionTitle>
          <Text style={styles.note}>
            {t({
              de: 'VaR ist ein 1-Faktor-Parametermodell (Markt-Beta + idiosynkratische Vola). Ein starkes Risk-Management-Team (Firma-Tab) senkt Margin-Call-Risiken und gibt mehr Puffer. Hoher Hebel multipliziert sowohl Alpha als auch Drawdowns.',
              en: 'VaR is a single-factor parametric model (market beta + idiosyncratic vol). A strong risk-management team (Firm tab) lowers margin-call risk and gives more buffer. High leverage multiplies both alpha and drawdowns.',
            })}
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
  crisisBanner: { borderWidth: 1, borderColor: colors.negative, padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.surface },
  crisisTitle: { color: colors.negative, fontFamily: fonts.serifBold, fontSize: 14, letterSpacing: 0.5 },
  crisisDesc: { color: colors.textMuted, fontFamily: fonts.serif, fontSize: 12, marginTop: 3 },
  label: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs, fontFamily: fonts.serifBold },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  stressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  stressName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  stressPnl: { fontSize: 15, fontWeight: '800' },
  stressPct: { fontSize: 12, fontWeight: '600' },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
