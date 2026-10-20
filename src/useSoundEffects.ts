import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

export type SoundEffect = "tap" | "start" | "door-open" | "door-close";
const PREFERENCE_KEY = "opendoor.sound.enabled";

function readPreference() {
  try { return localStorage.getItem(PREFERENCE_KEY) === "true"; }
  catch { return false; }
}

/** Short, locally synthesized effects: no audio downloads, tracking or microphone. */
export function synthesizeEffect(context: AudioContext, effect: SoundEffect) {
  const now = context.currentTime + 0.005;
  const tone = (frequency: number, delay: number, duration: number, volume: number, endFrequency = frequency) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + delay + duration);
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(volume, now + delay + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  };
  if (effect === "tap") {
    tone(760, 0, 0.055, 0.025, 560);
    return;
  }
  if (effect === "start") {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, index * 0.075, 0.22, 0.055));
    return;
  }
  const opening = effect === "door-open";
  const duration = opening ? 0.34 : 0.22;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(opening ? 260 : 900, now);
  filter.frequency.exponentialRampToValueAtTime(opening ? 1200 : 160, now + duration);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.075, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(now);
  source.stop(now + duration);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  // A soft latch and a low wooden resonance distinguish opening from closing.
  tone(opening ? 340 : 160, opening ? 0 : 0.15, 0.12, 0.075, opening ? 210 : 75);
  if (opening) tone(660, 0.16, 0.18, 0.025, 880);
}

export function useSoundEffects() {
  const [enabled, setEnabled] = useState(readPreference);
  const [notice, setNotice] = useState("");
  const enabledRef = useRef(enabled);
  const contextRef = useRef<AudioContext | null>(null);
  const lastSound = useRef(0);

  const play = useCallback((effect: SoundEffect) => {
    if (!enabledRef.current) return;
    // Avoid noisy overlapping feedback from accidental double clicks.
    if (effect === "tap" && performance.now() - lastSound.current < 65) return;
    lastSound.current = performance.now();
    try {
      if (!window.AudioContext) throw new Error("Sound effects are not supported by this browser.");
      const context = contextRef.current?.state !== "closed" && contextRef.current
        ? contextRef.current : new AudioContext();
      contextRef.current = context;
      const produce = () => {
        if (enabledRef.current && context.state === "running") synthesizeEffect(context, effect);
      };
      if (context.state === "suspended") {
        void context.resume().then(produce).catch(() => setNotice("Your browser blocked audio. Try turning sound off and on again."));
      } else produce();
    } catch {
      setNotice("Sound effects are unavailable in this browser. All features still work without sound.");
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    setNotice("");
    try { localStorage.setItem(PREFERENCE_KEY, String(next)); }
    catch { setNotice("Sound changed for this visit, but this browser could not save the preference."); }
    if (next) play("start");
    else {
      const context = contextRef.current;
      contextRef.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
    }
  }, [play]);

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true" || button.dataset.sound === "none") return;
    const declared = button.dataset.sound;
    if (declared === "door-open" || declared === "door-close" || declared === "start") play(declared);
    else if (/^open\b.*\bdoor\b/i.test(button.textContent?.trim() || "")) play("door-open");
    else if (button.textContent?.trim().toLowerCase().startsWith("start exploring")
      || button.matches('button.primary-btn[type="submit"]')) play("start");
    else play("tap");
  }, [play]);

  const reset = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    setNotice("");
    try { localStorage.removeItem(PREFERENCE_KEY); } catch { /* In-session audio still stops. */ }
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }, []);

  useEffect(() => () => {
    const context = contextRef.current;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }, []);

  return { enabled, notice, toggle, reset, play, onClickCapture };
}
