/**
 * Tiny audio/haptic accents — no assets, no dependencies.
 *
 * Web: short WebAudio blips (lazily created AudioContext).
 * Native: a soft Vibration pulse where the platform supports it.
 * Everything is fire-and-forget and silently no-ops when unavailable;
 * the store gates calls behind the persisted `soundOn` setting.
 */
import { Platform, Vibration } from 'react-native';

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  try {
    const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, durMs: number, gainPeak = 0.04, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(gainPeak, ac.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + durMs / 1000);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + durMs / 1000 + 0.02);
  } catch {
    /* never let a sound break the game */
  }
}

function pulse(ms: number) {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(ms);
  } catch {
    /* no-op */
  }
}

/** Soft page-turn tick: a month was advanced. */
export function sndTick(): void {
  blip(660, 60, 0.025, 'triangle');
  pulse(8);
}

/** Warm two-note chime: achievement / mandate met / carry. */
export function sndChime(): void {
  blip(523, 140, 0.035);
  setTimeout(() => blip(784, 200, 0.035), 110);
  pulse(15);
}

/** Low thud: bad news (margin call, redemption, game over). */
export function sndThud(): void {
  blip(140, 220, 0.05, 'square');
  pulse(30);
}
