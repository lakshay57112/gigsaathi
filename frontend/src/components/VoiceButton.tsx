import { useEffect, useRef, useState } from "react";
import { useApp } from "../context";

// The browser's built-in speech recognition. It is free, needs no server, and is not available
// in every browser or language, so the button only appears when it is supported.

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => Recognition;

function getRecognition(): RecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceButton({ onText, label }: { onText: (text: string) => void; label?: string }) {
  const { t, speechLocale } = useApp();
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const Ctor = getRecognition();

  useEffect(() => () => recognition.current?.stop(), []);

  if (!Ctor) return null;

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new Ctor!();
    rec.lang = speechLocale;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium ${
        listening ? "border-green-700 bg-green-50 text-green-900" : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
      <span>{listening ? t("voice_listening") : (label ?? t("voice_start"))}</span>
      <span className="sr-only">{listening ? t("voice_stop") : ""}</span>
    </button>
  );
}
