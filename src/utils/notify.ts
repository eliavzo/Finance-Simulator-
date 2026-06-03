/**
 * Cross-platform alert helpers.
 *
 * `react-native-web` does not implement `Alert`, so calling `Alert.alert` in a
 * browser throws. These wrappers fall back to the browser's native
 * `window.alert` / `window.confirm` on web and use React Native's `Alert` on
 * native devices.
 */
import { Alert, Platform } from 'react-native';

/** Show a simple informational message. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Ask the user to confirm a destructive action. Invokes `onConfirm` if they
 * accept.
 */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
