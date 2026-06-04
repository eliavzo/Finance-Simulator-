/**
 * "The Broadsheet" theme — a newspaper / broadsheet aesthetic.
 *
 * Warm newsprint paper, black ink, muted beige & brown tones; no bright colours,
 * hard (square) edges, hairline rules like column separators, and serif
 * typography (Playfair Display for mastheads/figures, PT Serif for body).
 */
export const colors = {
  /** Page background — warm newsprint. */
  bg: '#E7DFC9',
  /** A printed panel — slightly lighter stock. */
  surface: '#F1EBD8',
  /** Inset / pressed stock — slightly darker. */
  surfaceAlt: '#DDD2B6',
  /** Hairline rules & box outlines — warm ink. */
  border: '#2A251B',
  /** Subtle rule for minor row separators. */
  ruleSoft: '#B7A98A',
  /** Body ink. */
  text: '#211D14',
  /** Secondary ink — muted sepia. */
  textMuted: '#5C5340',
  /** Primary action / charts — brown ink. */
  primary: '#5A3E22',
  /** Up / gain — muted printer's green. */
  positive: '#33543A',
  /** Down / loss — muted oxblood. */
  negative: '#7C2B22',
  /** Caution — muted ochre. */
  warning: '#876A2E',
  /** Secondary accent — sepia brown. */
  accent: '#6B4E2E',
  long: '#33543A',
  short: '#7C2B22',
  /** Cream used for text on inked fills. */
  paperText: '#F3EEDD',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

/** Hard edges — newspapers don't have rounded corners. */
export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
};

/** Serif type families (loaded at startup via expo-font). */
export const fonts = {
  /** High-contrast display serif for mastheads & figures. */
  display: 'PlayfairDisplay_700Bold',
  displayBlack: 'PlayfairDisplay_900Black',
  displayItalic: 'PlayfairDisplay_700Bold_Italic',
  /** Readable body serif. */
  serif: 'PTSerif_400Regular',
  serifBold: 'PTSerif_700Bold',
  serifItalic: 'PTSerif_400Regular_Italic',
};

/** Pick a colour for a value that is "good when positive". */
export function pnlColor(value: number): string {
  if (value > 0) return colors.positive;
  if (value < 0) return colors.negative;
  return colors.textMuted;
}
