"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voz nativa del navegador (Web Speech API), gratis:
 *  - `speak`  → lee texto en voz alta (SpeechSynthesis), voz en español.
 *  - `listen` → escucha una frase y devuelve el texto (SpeechRecognition).
 * Pensado para el modo accesible (personas que no ven): la app lee la pregunta
 * y la persona responde por voz. Requiere Chrome/Edge + permiso de micrófono.
 */

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export function useVoice() {
  // `canSpeak`: puede LEER en voz alta (TTS) — incluye iPhone/Safari.
  // `canListen`: puede ESCUCHAR/dictar (STT) — Chrome/Edge/Android; NO iOS.
  const [canSpeak, setCanSpeak] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setCanSpeak("speechSynthesis" in window);
    setCanListen(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-CO";
      u.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const es = voices.find((v) => /es[-_]?co/i.test(v.lang)) || voices.find((v) => v.lang?.toLowerCase().startsWith("es"));
      if (es) u.voice = es;
      u.onstart = () => setSpeaking(true);
      u.onend = () => { setSpeaking(false); onEnd?.(); };
      u.onerror = () => { setSpeaking(false); onEnd?.(); };
      window.speechSynthesis.speak(u);
    } catch {
      onEnd?.();
    }
  }, []);

  // Pide permiso de micrófono UNA vez. Debe invocarse DENTRO del gesto del clic
  // (p. ej. al activar el modo voz) para que el navegador muestre el diálogo.
  const requestMic = useCallback(async (): Promise<boolean> => {
    try {
      const md = (navigator as unknown as { mediaDevices?: { getUserMedia?: (c: unknown) => Promise<{ getTracks: () => { stop: () => void }[] }> } }).mediaDevices;
      if (md?.getUserMedia) {
        const stream = await md.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const listen = useCallback((onResult: (t: string) => void, onEnd?: () => void) => {
    const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { onEnd?.(); return; }
    try {
      const rec = new SR();
      rec.lang = "es-CO";
      rec.continuous = false;
      rec.interimResults = false;
      let done = false;
      const finish = () => { if (done) return; done = true; setListening(false); };
      // Salvavidas: si en 15s no llega nada, se corta para no dejar el botón pegado.
      const timer = setTimeout(() => { try { rec.abort(); } catch { /* noop */ } }, 15000);
      rec.onresult = (e) => {
        clearTimeout(timer);
        const t = e.results?.[0]?.[0]?.transcript ?? "";
        onResult(String(t));
      };
      rec.onerror = () => { clearTimeout(timer); finish(); onEnd?.(); };
      rec.onend = () => { clearTimeout(timer); finish(); onEnd?.(); };
      recRef.current = rec;
      setListening(true);
      // start() SÍNCRONO dentro del gesto del clic → dispara el permiso y evita el
      // bloqueo silencioso que ocurría al iniciarlo tras una promesa.
      rec.start();
    } catch {
      setListening(false);
      onEnd?.();
    }
  }, []);

  const stop = useCallback(() => {
    try { recRef.current?.abort(); } catch { /* noop */ }
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    setListening(false);
    setSpeaking(false);
  }, []);

  return { canSpeak, canListen, speaking, listening, speak, listen, stop, requestMic };
}
