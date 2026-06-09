/**
 * Lightweight inline i18n for Alpha & Carry.
 *
 * Rather than a central key dictionary, translations live co-located with the
 * code that uses them as `{ de, en }` literals, resolved against the active
 * language. This keeps the bilingual text next to its context and lets the
 * language toggle apply live across the whole app.
 *
 * - React components: `const t = useTr(); t({ de: '…', en: '…' })`.
 * - Engine / non-React modules: `g({ de: '…', en: '…' })` (active language).
 */
import { useSimStore } from '../sim/store';
import { Lang, Loc, tr } from './lang';

export type { Lang, Loc } from './lang';
export { LANGS, LANG_LABEL, tr, getLang, setCurrentLang, g } from './lang';

/** The active language, reactive. */
export function useLang(): Lang {
  return useSimStore((s) => s.lang);
}

/** A reactive translator bound to the active language. */
export function useTr(): (l: Loc) => string {
  const lang = useLang();
  return (l: Loc) => tr(lang, l);
}
