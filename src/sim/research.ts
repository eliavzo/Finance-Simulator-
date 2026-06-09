/**
 * Research desk: turns the analyst/quant team's "research" capability into
 * concrete, visible calls on individual instruments.
 *
 * Each instrument has a true expected return (see {@link expectedAnnualReturn}).
 * The team perceives it with noise that *shrinks* as research quality rises — so
 * a strong desk's calls are well aligned with reality (real edge), while a weak
 * or absent desk produces few, near-random calls. Following high-conviction
 * calls therefore has positive expected value, but never a guarantee.
 */
import { EconomyState, Instrument, ResearchSignal } from './types';
import { expectedAnnualReturn } from './market';
import { FirmCapabilities } from './firm';
import { Lang, Loc, tr, getLang } from '../i18n/lang';
import { SECTOR_LABEL } from './labels';
import { Rng } from '../engine/rng';

export function generateSignals(
  instruments: Instrument[],
  econ: EconomyState,
  caps: FirmCapabilities,
  rng: Rng,
  noiseMult = 1,
): ResearchSignal[] {
  // Without any research capability there is no view to publish.
  if (caps.research < 0.12) return [];

  const research = caps.research;
  const noiseSd = (1 - research) * 0.16 * noiseMult; // strong team / quant desk → little noise

  const candidates = instruments
    .filter((i) => i.kind === 'equity' || i.kind === 'commodity' || i.kind === 'fx')
    .map((inst) => {
      const truth = expectedAnnualReturn(inst, econ) ?? 0;
      const perceived = truth + rng.normal(0, noiseSd);
      // Magnitude of the view, dampened by how good the desk is — a weak team is
      // never very confident, a strong team can be when the edge is large.
      const conviction = Math.min(1, Math.abs(perceived) / 0.3) * (0.3 + 0.7 * research);
      return { inst, perceived, conviction };
    })
    // Only publish views the team actually has an opinion on.
    .filter((c) => c.conviction > 0.18)
    .sort((a, b) => b.conviction - a.conviction);

  // A better desk publishes more calls (up to ~6).
  const count = Math.max(1, Math.min(6, Math.round(research * 6)));

  return candidates.slice(0, count).map(({ inst, perceived, conviction }) => {
    const stance = perceived >= 0 ? 'overweight' : 'underweight';
    return {
      instrumentId: inst.id,
      symbol: inst.symbol,
      stance,
      conviction,
      note: researchNote(inst, stance, conviction, getLang()),
    } as ResearchSignal;
  });
}

/** Build a localised research note (re-derivable at render for live language). */
export function researchNote(inst: Instrument, stance: 'overweight' | 'underweight', conviction: number, lang: Lang): string {
  const strength = tr(
    lang,
    conviction > 0.66
      ? { de: 'Hohe Überzeugung', en: 'High conviction' }
      : conviction > 0.4
        ? { de: 'Mittlere Überzeugung', en: 'Medium conviction' }
        : { de: 'Vorsichtig', en: 'Cautious' },
  );
  const dir = tr(
    lang,
    stance === 'overweight'
      ? { de: 'attraktives Aufwärtspotenzial', en: 'attractive upside potential' }
      : { de: 'erhöhtes Abwärtsrisiko', en: 'elevated downside risk' },
  );
  const ctx =
    inst.kind === 'equity'
      ? tr(lang, SECTOR_LABEL[inst.sector])
      : inst.kind === 'commodity'
        ? tr(lang, { de: 'Rohstoff', en: 'Commodity' })
        : tr(lang, { de: 'Devisen', en: 'FX' });
  return `${strength} · ${ctx}: ${dir}.`;
}

export const STANCE_LABEL: Record<ResearchSignal['stance'], Loc> = {
  overweight: { de: 'Übergewichten', en: 'Overweight' },
  underweight: { de: 'Untergewichten', en: 'Underweight' },
};
