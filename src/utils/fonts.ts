/**
 * Newspaper font loading.
 *
 * Loads the serif families used across the app and installs PT Serif as the
 * default family for every <Text> / <TextInput> so the whole UI reads like
 * print without each style having to opt in.
 */
import { Platform, Text, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  PlayfairDisplay_900Black,
} from '@expo-google-fonts/playfair-display';
import {
  PTSerif_400Regular,
  PTSerif_400Regular_Italic,
  PTSerif_700Bold,
} from '@expo-google-fonts/pt-serif';
import { fonts } from './theme';

let defaultsInstalled = false;

/** Set PT Serif as the global default font for Text & TextInput (once). */
function installDefaultFont() {
  if (defaultsInstalled) return;
  defaultsInstalled = true;
  const apply = (Component: typeof Text | typeof TextInput) => {
    const c = Component as unknown as { defaultProps?: { style?: unknown } };
    c.defaultProps = c.defaultProps || {};
    c.defaultProps.style = [{ fontFamily: fonts.serif }, c.defaultProps.style];
  };
  apply(Text);
  apply(TextInput);
}

/** Hook: returns true once the newspaper fonts are ready. */
export function useNewspaperFonts(): boolean {
  // On web the faces come from injected @font-face CSS (or the system serif),
  // so don't hand expo-font any assets to fetch — that only produces 404 noise
  // and can hang the splash. On native, load the bundled TTFs normally.
  const [loaded] = useFonts(
    Platform.OS === 'web'
      ? {}
      : {
          PlayfairDisplay_700Bold,
          PlayfairDisplay_700Bold_Italic,
          PlayfairDisplay_900Black,
          PTSerif_400Regular,
          PTSerif_400Regular_Italic,
          PTSerif_700Bold,
        },
  );
  // On web the serif faces are supplied by injected @font-face rules (see the
  // single-file build) or fall back to the system serif, so never block the
  // render on expo-font there — otherwise a failed asset fetch hangs the app.
  const ready = Platform.OS === 'web' ? true : loaded;
  if (ready) installDefaultFont();
  return ready;
}
