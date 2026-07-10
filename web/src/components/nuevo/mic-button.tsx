"use client";

import { useVoice } from "@/lib/nuevo/useVoice";

/**
 * Botón de micrófono por campo: al tocarlo pide permiso de micrófono, escucha
 * una frase y la entrega por `onResult` para llenar ESE campo. Solo aparece
 * donde el navegador soporta reconocimiento de voz (Chrome/Edge/Android);
 * en iPhone no se muestra (allí se usa el dictado del teclado).
 */
export function MicButton({ onResult, label = "Dictar por voz" }: { onResult: (t: string) => void; label?: string }) {
  const { canListen, listening, listen } = useVoice();
  if (!canListen) return null;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => listen((t) => onResult(t))}
      className={`grid h-[54px] w-12 flex-none place-items-center rounded-2xl border-2 transition ${
        listening ? "animate-pulse border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-500 hover:border-[#5646E5]"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10a7 7 0 0 1-14 0M12 17v4" />
      </svg>
    </button>
  );
}
