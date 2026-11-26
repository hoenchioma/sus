import { useEffect, useRef } from 'react';
import type { PromptKey } from '@sus/engine';
import type { Skin } from '../skins';
import { promptName } from './describe';

declare global {
  interface Window {
    /** Set by the Sus Fire TV app: Android's web view can't speak, so the app lends the TV's own voice. */
    SusTv?: { speak(text: string, lang: string): void };
  }
}

/** True inside the Fire TV app, which allows sound without a tap and speaks through the TV. */
export const inTvApp = typeof window !== 'undefined' && !!window.SusTv;

let ctx: AudioContext | null = null;

export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx.state !== 'suspended';
}

function tone(freq: number, start: number, length: number, type: OscillatorType = 'sine', gain = 0.18) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

const SOUNDS: Record<string, () => void> = {
  night: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.28, 1.2, 'triangle')),
  morning: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.9, 'sine')),
  death: () => [311, 294, 220].forEach((f, i) => tone(f, i * 0.22, 1, 'sawtooth', 0.07)),
  vote: () => [0, 0.12, 0.24, 0.36, 0.48].forEach((s) => tone(110, s, 0.1, 'square', 0.08)),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 1.2, 'triangle', 0.14)),
};

function narrationText(cueId: string, skin: Skin): string | null {
  const [kind, key] = cueId.split(':') as [string, PromptKey | undefined];
  if (kind === 'night') return 'Night falls. Everyone, close your eyes.';
  if (kind === 'dawn') return 'Everyone, open your eyes.';
  if (kind === 'wake' && key) return `${promptName(skin, key)}, open your eyes.`;
  if (kind === 'sleep' && key) return `${promptName(skin, key)}, close your eyes.`;
  return null;
}

function speak(text: string) {
  if (window.SusTv) return window.SusTv.speak(text, 'en');
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92;
  u.pitch = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/** Plays the shipped narration clip for a cue, falling back to the browser's voice. */
function narrate(cueId: string, skin: Skin) {
  const text = narrationText(cueId, skin);
  if (!text) return;
  const clip = new Audio(`/audio/${skin.id}/${cueId.replace(':', '-')}.mp3`);
  clip.onerror = () => speak(text);
  clip.play().catch(() => speak(text));
}

export function useCues(cue: { seq: number; id: string } | null, skin: Skin, opts: { enabled: boolean; narrated: boolean }) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!cue || last.current === cue.seq) return;
    const first = last.current === null;
    last.current = cue.seq;
    if (first || !opts.enabled) return;
    const [base, arg] = cue.id.split(':');
    if (base === 'dawn') SOUNDS[arg === 'death' ? 'death' : 'morning']!();
    else if (base === 'result') SOUNDS[arg === 'death' ? 'death' : 'morning']!();
    else SOUNDS[base!]?.();
    if (opts.narrated) narrate(cue.id, skin);
  }, [cue, skin, opts.enabled, opts.narrated]);
}

const QUEST_SOUNDS: Record<string, keyof typeof SOUNDS> = {
  newCommander: 'vote',
  vote: 'vote',
  approved: 'morning',
  rejected: 'death',
  chapterWon: 'morning',
  chapterLost: 'death',
  spy: 'night',
  lastChance: 'night',
  goodWins: 'win',
  evilWins: 'win',
};

function speakIn(text: string, lang: 'en' | 'bn') {
  if (window.SusTv) return window.SusTv.speak(text, lang);
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang === 'bn' ? 'bn' : 'en'));
  if (voice) u.voice = voice;
  u.lang = lang === 'bn' ? 'bn-BD' : 'en-GB';
  u.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/** Sound effects plus short spoken phase announcements for quest games (no player names spoken). */
export function useQuestCues(
  cue: { seq: number; id: string } | null,
  opts: { enabled: boolean; skin: string; lang: 'en' | 'bn'; lines: Record<string, string> },
) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!cue || last.current === cue.seq) return;
    const first = last.current === null;
    last.current = cue.seq;
    if (first || !opts.enabled) return;
    const sound = QUEST_SOUNDS[cue.id];
    if (sound) SOUNDS[sound]!();
    const text = opts.lines[cue.id];
    if (!text) return;
    const clip = new Audio(`/audio/${opts.skin}/${opts.lang}/${cue.id}.mp3`);
    clip.onerror = () => speakIn(text, opts.lang);
    clip.play().catch(() => speakIn(text, opts.lang));
  }, [cue, opts.enabled, opts.skin, opts.lang, opts.lines]);
}

/** Reads one line aloud (Mode 1 ritual), preferring a shipped clip. */
export function sayLine(skin: string, lang: 'en' | 'bn', id: string, text: string) {
  const clip = new Audio(`/audio/${skin}/${lang}/${id}.mp3`);
  clip.onerror = () => speakIn(text, lang);
  clip.play().catch(() => speakIn(text, lang));
}
