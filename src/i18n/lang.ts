/**
 * Framework-free i18n core (no React / no store imports) so the engine and the
 * store can use it without an import cycle. See ./index.ts for the React hooks.
 */
export type Lang = 'de' | 'en';

/** A bilingual string. */
export interface Loc {
  de: string;
  en: string;
}

export const LANGS: Lang[] = ['en', 'de'];

export const LANG_LABEL: Record<Lang, string> = {
  en: 'English',
  de: 'Deutsch',
};

/** Resolve a bilingual literal for a language (falls back to English). */
export function tr(lang: Lang, l: Loc): string {
  return l[lang] ?? l.en;
}

/* Module-level mirror of the active language, kept in sync by the store, so
 * non-React engine code can localise the text it generates each tick. */
let CURRENT: Lang = 'en';
export function getLang(): Lang {
  return CURRENT;
}
export function setCurrentLang(lang: Lang): void {
  CURRENT = lang;
}

/** Convenience for engine code: resolve against the active language. */
export function g(l: Loc): string {
  return tr(CURRENT, l);
}
