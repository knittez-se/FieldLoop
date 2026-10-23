"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "./ui";

/* Minimal typings for the Web Speech API (not in TS's DOM lib everywhere). */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Browser speech recognition (Chrome/Edge/Safari). Appends recognized text via `onText`.
 * If unsupported, says so — it never pretends a recording was transcribed.
 */
export function VoiceInput({ onText, lang = "en-US" }: { onText: (text: string) => void; lang?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()));
    return () => recRef.current?.stop();
  }, []);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onTextRef.current(r[0].transcript.trim());
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone permission denied." : `Speech recognition error: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() {
    recRef.current?.stop();
  }

  if (supported === null) return null;
  if (!supported) {
    return (
      <p className="text-xs text-stone-500">
        Voice dictation isn&apos;t supported in this browser. Type the note instead, or use your phone keyboard&apos;s dictation.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {listening ? (
        <Button variant="danger" size="sm" icon={Square} onClick={stop}>
          Stop dictation
        </Button>
      ) : (
        <Button variant="secondary" size="sm" icon={Mic} onClick={start}>
          Dictate
        </Button>
      )}
      {listening && (
        <span className="flex items-center gap-1.5 text-xs text-red-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> Listening… {interim && <em className="text-stone-500">{interim}</em>}
        </span>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
