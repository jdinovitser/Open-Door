import { useEffect, useId, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import "./FriendlyBrief.css";

type SpeechResult = { isFinal: boolean; [index: number]: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function FriendlyBrief({ value, onChange, disabled = false, label = "Describe what you’d like to do", maxLength = 1000 }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; label?: string; maxLength?: number;
}) {
  const id = useId();
  const active = useRef<Recognition | null>(null);
  const latest = useRef({ value, onChange, maxLength });
  latest.current = { value, onChange, maxLength };
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const browser = window as SpeechWindow;
    setSupported(Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    return () => { const recognition = active.current; active.current = null; recognition?.abort(); };
  }, []);
  useEffect(() => {
    if (!disabled) return;
    const recognition = active.current;
    active.current = null;
    recognition?.abort();
    setListening(false);
  }, [disabled]);

  function startVoice() {
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor || disabled || active.current) return;
    const recognition = new Constructor();
    active.current = recognition;
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      if (active.current !== recognition) return;
      const text = Array.from(event.results).slice(event.resultIndex)
        .filter(result => result.isFinal).map(result => result[0]?.transcript || "").join(" ").trim();
      if (!text) return;
      const current = latest.current;
      const combined = [current.value.trim(), text].filter(Boolean).join(" ");
      const next = combined.slice(0, current.maxLength);
      latest.current = { ...current, value: next };
      current.onChange(next);
      setMessage(combined.length > current.maxLength ? "Your note is full. Review or shorten it before adding more." : "Added your words. You can edit them before exploring.");
    };
    recognition.onerror = event => {
      if (active.current !== recognition) return;
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access wasn’t allowed. You can type instead, or enable it in your browser and try again.",
        "service-not-allowed": "Voice input isn’t available here. Typing works just as well.",
        "audio-capture": "We couldn’t access a microphone. You can type your note instead.",
        "no-speech": "We didn’t hear anything. Try again or type your note.",
        network: "The browser’s voice service couldn’t connect. Your typed words are safe—please type or retry.",
      };
      setMessage(messages[event.error] || "Voice input stopped. Your existing words are safe; you can keep typing.");
      active.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      if (active.current !== recognition) return;
      active.current = null;
      setListening(false);
      setMessage(current => current.startsWith("Listening") ? "Voice input finished. Review your note or try again." : current);
    };
    try {
      setMessage("Listening… speak naturally, then stop or wait for the browser to finish.");
      setListening(true);
      recognition.start();
    } catch {
      active.current = null;
      setListening(false);
      setMessage("Voice input couldn’t start. You can type instead.");
    }
  }

  return <div className="friendly-brief">
    <label htmlFor={id}>{label} {!/optional/i.test(label) && <span>Optional</span>}</label>
    <textarea id={id} value={value} disabled={disabled} rows={2} maxLength={maxLength} aria-describedby={`${id}-help ${id}-voice`}
      onChange={event => {
        const recognition = active.current;
        active.current = null;
        recognition?.abort();
        setListening(false);
        onChange(event.target.value);
      }}
      placeholder="A relaxed afternoon with a friend, some art and music, easy walking, and time for a coffee…" />
    <div className="friendly-brief-tools">
      {supported ? <button className="secondary-btn" type="button" disabled={disabled} aria-pressed={listening}
        onClick={() => {
          if (!listening) { startVoice(); return; }
          try { active.current?.stop(); }
          catch { active.current = null; setListening(false); setMessage("Voice input stopped. You can keep typing."); }
        }}>
        {listening ? <Square size={15} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        {listening ? "Stop voice input" : "Use my voice"}
      </button> : <span>Type your note · voice input isn’t supported in this browser.</span>}
      <span className="friendly-brief-count">{value.length}/{maxLength}</span>
    </div>
    <p id={`${id}-help`}>This note helps with planning. Add an interest below for Qloo’s cultural matches.</p>
    <p id={`${id}-voice`} className="friendly-brief-privacy">{supported
      ? "Your browser’s speech service may process audio externally. Open Door stores no audio and keeps this editable planning note in your browser, not your account or Qloo."
      : "Open Door keeps this editable planning note in your browser, not your account or Qloo."}</p>
    {message && <p className="friendly-brief-status" role="status">{message}</p>}
  </div>;
}
