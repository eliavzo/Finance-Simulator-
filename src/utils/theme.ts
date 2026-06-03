/** Centralised dark "terminal" theme for the whole app. */
export const colors = {
  bg: '#0B0E14',
  surface: '#141A24',
  surfaceAlt: '#1C2533',
  border: '#26303F',
  text: '#E6EDF3',
  textMuted: '#8B97A7',
  primary: '#4F8CFF',
  positive: '#2ECC71',
  negative: '#FF5A5A',
  warning: '#F5A623',
  accent: '#9B6CFF',
  long: '#2ECC71',
  short: '#FF5A5A',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
};

/** Pick a colour for a value that is "good when positive". */
export function pnlColor(value: number): string {
  if (value > 0) return colors.positive;
  if (value < 0) return colors.negative;
  return colors.textMuted;
}
