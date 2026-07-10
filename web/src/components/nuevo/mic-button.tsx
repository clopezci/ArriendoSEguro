"use client";

import { useVoice } from "@/lib/nuevo/useVoice";
import { VoiceHelp, type VoiceHelpReason } from "@/components/nuevo/voice-help";
import { useState } from "react";

/**
 * Botón de micrófono por campo. Objetivo: que funcione para TODOS y, si el
 * dispositivo no puede o el permiso está bloqueado, que lo explique con un paso
 * a paso (en vez de "no pasar nada"):
 *  - Chrome/Edge/Android: pide permiso al tocar y dicta al campo.
 *  - Permiso bloqueado / sin voz: muestra ayuda para reactivarlo.
 *  - iPhone/iPad: guía para usar el micrófono del teclado (sí funciona).
 * Siempre se muestra, para que el usuario nunca quede sin salida.
 */
export function MicButton({ onResult, label = "Dictar por voz" }: { onResult: (t: string) => void; label?: string }) {
  const { canListen, isIOS, listening, listen, requestMic } = useVoice();
  const [help, setHelp] = useState<VoiceHelpReason | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  function flashHint(msg: string) {
    setHint(msg);
    setTimeout(() => setHint(null), 3500);
  }

  async function handleClick() {
    setHint(null);
    // iPhone/iPad: no hay dictado web; guiamos al micrófono del teclado.
    if (isIOS || !canListen) {
      setHelp(isIOS ? "ios" : "unsupported");
      return;
    }
    // Pide el permiso con getUserMedia PRIMERO: en celular esto SÍ abre el diálogo
    // de permiso (a diferencia de SpeechRecognition.start(), que a veces solo falla).
    // Concedido el permiso, rec.start() ya no necesita un gesto nuevo.
    const granted = await requestMic();
    if (!granted) {
      setHelp("blocked");
      return;
    }
    listen(
      (t) => {
        if (t.trim()) onResult(t);
        else flashHint("No te escuché. Intenta de nuevo.");
      },
      undefined,
      (code) => {
        if (code === "not-allowed" || code === "service-not-allowed") setHelp("blocked");
        else if (code === "audio-capture") flashHint("No detecto micrófono en el dispositivo.");
        else if (code === "no-speech") flashHint("No te escuché. Acércate y habla claro.");
        else if (code === "network") flashHint("Sin conexión para el dictado. Revisa internet.");
        else if (code === "unsupported") setHelp("unsupported");
      },
    );
  }

  return (
    <>
      <div className="relative flex-none">
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => void handleClick()}
          className={`grid h-[54px] w-12 place-items-center rounded-2xl border-2 transition ${
            listening ? "animate-pulse border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-500 hover:border-[#5646E5]"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10a7 7 0 0 1-14 0M12 17v4" />
          </svg>
        </button>
        {hint && (
          <span className="absolute right-0 top-[58px] z-20 w-44 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">
            {hint}
          </span>
        )}
      </div>
      {help && <VoiceHelp reason={help} onClose={() => setHelp(null)} />}
    </>
  );
}
