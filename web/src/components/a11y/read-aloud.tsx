"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

/**
 * Lectura por voz (accesibilidad) con la Web Speech API del navegador — sin
 * servicios externos. Arquitectura:
 *   - `ReadAloudProvider` gestiona UNA sola lectura a la vez (cola de fragmentos,
 *     estado, velocidad y voz en español).
 *   - `ReadAloudButton` es solo un ícono "escuchar" por bloque; delega en el
 *     provider.
 *   - `ReadAloudControls` es una barra flotante única (pausa/continuar/detener +
 *     velocidad) que aparece mientras hay una lectura activa. Así cada bloque
 *     queda limpio y los controles no se repiten.
 */

type Status = "idle" | "playing" | "paused";

type ReadAloudCtx = {
  supported: boolean;
  status: Status;
  activeId: string | null;
  rate: number;
  speak: (id: string, text: string) => void;
  pause: () => void;
  resume: () => void;
  rewind: () => void;
  stop: () => void;
  setRate: (r: number) => void;
};

const Ctx = createContext<ReadAloudCtx | null>(null);

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

/** Trocea por oración (≤220 chars) para evitar el corte de Chrome en textos largos. */
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

export function ReadAloudProvider({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);

  const chunksRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  /**
   * "Generación" de lectura. Cada vez que iniciamos, reiniciamos o detenemos
   * una lectura, incrementamos este contador. Los callbacks `onend`/`onerror`
   * de una locución que NOSOTROS cancelamos (p. ej. al cambiar la velocidad o
   * al pausar) quedan con una generación vieja y se ignoran, para que un
   * `cancel()` propio no dispare `idle` ni haga desaparecer la barra.
   */
  const genRef = useRef(0);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (!ok) return;
    const loadVoices = () => {
      voiceRef.current = pickSpanishVoice(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    };
  }, []);

  const speakFrom = useCallback((index: number) => {
    const synth = window.speechSynthesis;
    const gen = ++genRef.current; // invalida los handlers de la locución anterior
    synth.cancel();
    // Chrome a veces queda "pausado" tras un cancel; asegúrate de reanudar el motor.
    try {
      synth.resume();
    } catch {
      /* noop */
    }
    idxRef.current = index;
    const voice = voiceRef.current ?? pickSpanishVoice(synth.getVoices());
    const next = () => {
      if (gen !== genRef.current) return; // esta lectura fue superada/cancelada por nosotros
      if (idxRef.current >= chunksRef.current.length) {
        setStatus("idle");
        setActiveId(null);
        return;
      }
      const u = new SpeechSynthesisUtterance(chunksRef.current[idxRef.current]);
      u.lang = voice?.lang ?? "es-ES";
      if (voice) u.voice = voice;
      u.rate = rateRef.current;
      u.pitch = 1;
      u.onend = () => {
        if (gen !== genRef.current) return; // cancelada por nosotros: no avanzar
        idxRef.current += 1;
        next();
      };
      u.onerror = () => {
        if (gen !== genRef.current) return; // cancelada por nosotros: no apagar la barra
        setStatus("idle");
        setActiveId(null);
      };
      synth.speak(u);
    };
    setStatus("playing");
    next();
  }, []);

  const speak = useCallback(
    (id: string, text: string) => {
      const chunks = chunkText(text);
      if (!chunks.length) return;
      chunksRef.current = chunks;
      setActiveId(id);
      speakFrom(0);
    },
    [speakFrom],
  );

  const pause = useCallback(() => {
    // En vez de speechSynthesis.pause() (poco fiable en móvil/iOS, donde resume()
    // no reanuda), invalidamos la locución actual y recordamos el fragmento.
    genRef.current++;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (chunksRef.current.length === 0) return;
    // Reanuda releyendo el fragmento actual (≤220 chars): funciona en todos los navegadores.
    speakFrom(idxRef.current);
  }, [speakFrom]);

  /**
   * Retroceder ~10 segundos. Como la lectura va por fragmentos (~220 caracteres
   * ≈ 10–15 s a velocidad normal), retrocedemos uno o dos fragmentos según la
   * velocidad y releemos desde ahí (aproxima los 10 s de forma fiable en todos
   * los navegadores, sin API de tiempo).
   */
  const rewind = useCallback(() => {
    if (chunksRef.current.length === 0) return;
    const back = rateRef.current >= 1.5 ? 2 : 1; // más rápido → retrocede más fragmentos
    const target = Math.max(0, idxRef.current - back);
    speakFrom(target);
  }, [speakFrom]);

  const stop = useCallback(() => {
    genRef.current++;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    chunksRef.current = [];
    idxRef.current = 0;
    setStatus("idle");
    setActiveId(null);
  }, []);

  const setRate = useCallback(
    (r: number) => {
      rateRef.current = r;
      setRateState(r);
      // La velocidad no se puede cambiar en curso: reiniciamos el fragmento actual
      // solo si está sonando. Si está en pausa, se aplica al continuar.
      if (chunksRef.current.length > 0 && status === "playing") {
        speakFrom(idxRef.current);
      }
    },
    [speakFrom, status],
  );

  const value: ReadAloudCtx = { supported, status, activeId, rate, speak, pause, resume, rewind, stop, setRate };
  return (
    <Ctx.Provider value={value}>
      {children}
      <ReadAloudControls />
    </Ctx.Provider>
  );
}

function useReadAloud(): ReadAloudCtx | null {
  return useContext(Ctx);
}

const RATES = [0.75, 1, 1.5, 2] as const;

/** Barra flotante única de control (aparece solo mientras hay lectura activa). */
function ReadAloudControls() {
  const ra = useReadAloud();
  if (!ra || ra.status === "idle") return null;
  return (
    <div
      role="region"
      aria-label="Controles de lectura por voz"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center justify-center gap-1.5 rounded-3xl border border-violet-300 bg-white/95 px-3 py-2 shadow-[0_8px_28px_rgba(139,92,246,0.28)] backdrop-blur"
    >
      <span className="hidden text-xs font-medium text-violet-800 sm:inline">🔊 Leyendo</span>
      <button
        type="button"
        onClick={ra.rewind}
        aria-label="Retroceder 10 segundos"
        title="Retroceder 10 segundos"
        className="rounded-full border border-violet-400 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
      >
        ⏪ 10s
      </button>
      {ra.status === "paused" ? (
        <button
          type="button"
          onClick={ra.resume}
          className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
        >
          ▶ Continuar
        </button>
      ) : (
        <button
          type="button"
          onClick={ra.pause}
          className="rounded-full border border-violet-400 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
        >
          ⏸ Pausar
        </button>
      )}
      <button
        type="button"
        onClick={ra.stop}
        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-rose-400 hover:text-rose-600"
      >
        ⏹ Detener
      </button>
      <span className="mx-0.5 h-4 w-px bg-slate-300" aria-hidden="true" />
      <span className="text-[11px] text-slate-500">Velocidad</span>
      <div className="flex items-center gap-0.5">
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => ra.setRate(r)}
            aria-pressed={ra.rate === r}
            className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
              ra.rate === r ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}

type ButtonProps = {
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

/** Ícono "escuchar" por bloque. Delega en el provider (una lectura a la vez). */
export function ReadAloudButton({ text, getText, targetRef, label = "Leer en voz alta", withText = false, className }: ButtonProps) {
  const ra = useReadAloud();
  const id = useId();
  if (!ra || !ra.supported) return null;

  const isActive = ra.activeId === id && ra.status !== "idle";

  function resolveText(): string {
    if (typeof getText === "function") return getText();
    if (targetRef?.current) return targetRef.current.innerText || targetRef.current.textContent || "";
    return text ?? "";
  }

  return (
    <button
      type="button"
      onClick={() => (isActive ? ra!.stop() : ra!.speak(id, resolveText()))}
      aria-label={isActive ? "Detener lectura" : label}
      title={isActive ? "Detener lectura" : label}
      className={
        className ??
        `inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition ${
          isActive
            ? "border-violet-500 bg-violet-100 text-violet-800"
            : "border-slate-300 bg-white text-slate-600 hover:border-violet-400 hover:text-violet-700"
        }`
      }
    >
      {isActive ? (
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
      {withText && <span>{isActive ? "Detener" : "Escuchar"}</span>}
    </button>
  );
}
