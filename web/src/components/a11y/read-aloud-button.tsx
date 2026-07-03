"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botón de accesibilidad "escuchar" (lectura por voz) que usa la Web Speech API
 * del navegador (SpeechSynthesis) — sin servicios externos. Lee el texto que se
 * le pase (`text`/`getText`) o el contenido de un elemento (`targetRef`), en voz
 * española (prefiere es-CO, luego es-*). Un toque inicia; otro detiene. Si el
 * navegador no soporta síntesis de voz, el botón no se muestra.
 *
 * Coordinación: al iniciar, avisa por un evento global para que cualquier otro
 * botón que estuviera leyendo se apague (solo una lectura a la vez).
 */

const START_EVENT = "as:readaloud:start";

let instanceCounter = 0;

type Props = {
  /** Texto directo a leer. */
  text?: string;
  /** Función que retorna el texto en el momento del click (contenido dinámico). */
  getText?: () => string;
  /** Elemento cuyo texto visible se leerá (p. ej. el contrato renderizado). */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** Etiqueta accesible / tooltip. */
  label?: string;
  /** Mostrar también la palabra "Escuchar" junto al ícono. */
  withText?: boolean;
  className?: string;
};

function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  return (
    voices.find((v) => /es[-_]CO/i.test(v.lang)) ??
    voices.find((v) => /es[-_](419|MX|US|AR|CL|PE)/i.test(v.lang)) ??
    voices.find((v) => /es[-_]ES/i.test(v.lang)) ??
    voices.find((v) => /^es/i.test(v.lang)) ??
    null
  );
}

/**
 * Trocea el texto en fragmentos por oración (hasta ~220 caracteres) para evitar
 * un bug conocido de Chrome que corta lecturas largas, y mejora la fiabilidad.
 */
function chunkText(text: string, maxLen = 220): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?;\n]+[.!?;\n]*/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > maxLen && cur) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export function ReadAloudButton({
  text,
  getText,
  targetRef,
  label = "Leer en voz alta",
  withText = false,
  className,
}: Props) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const idRef = useRef<number>(0);
  if (idRef.current === 0) idRef.current = ++instanceCounter;

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (ok) {
      // Algunos navegadores cargan las voces de forma asíncrona.
      try {
        window.speechSynthesis.getVoices();
      } catch {
        /* noop */
      }
    }
    // Si otro botón empieza a leer, este se apaga.
    const onOtherStart = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (detail !== idRef.current) setSpeaking(false);
    };
    window.addEventListener(START_EVENT, onOtherStart as EventListener);
    return () => {
      window.removeEventListener(START_EVENT, onOtherStart as EventListener);
      // Al desmontar, detenemos cualquier lectura en curso de este botón.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  function resolveText(): string {
    if (typeof getText === "function") return getText();
    if (targetRef?.current) return targetRef.current.innerText || targetRef.current.textContent || "";
    return text ?? "";
  }

  function stop() {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    setSpeaking(false);
  }

  function speak() {
    const chunks = chunkText(resolveText());
    if (!chunks.length) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    // Avisa a los demás botones que se apaguen.
    try {
      window.dispatchEvent(new CustomEvent(START_EVENT, { detail: idRef.current }));
    } catch {
      /* noop */
    }
    const voice = pickSpanishVoice(synth.getVoices());
    let idx = 0;
    const speakNext = () => {
      if (idx >= chunks.length) {
        setSpeaking(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[idx++]);
      u.lang = voice?.lang ?? "es-ES";
      if (voice) u.voice = voice;
      u.rate = 1;
      u.pitch = 1;
      u.onend = speakNext;
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    };
    setSpeaking(true);
    speakNext();
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak())}
      aria-label={speaking ? "Detener lectura" : label}
      title={speaking ? "Detener lectura" : label}
      className={
        className ??
        `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition ${
          speaking
            ? "border-violet-500 bg-violet-100 text-violet-800"
            : "border-slate-300 bg-white text-slate-600 hover:border-violet-400 hover:text-violet-700"
        }`
      }
    >
      {speaking ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
      {withText && <span>{speaking ? "Detener" : "Escuchar"}</span>}
    </button>
  );
}
