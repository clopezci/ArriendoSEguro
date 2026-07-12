"use client";

import { useEffect, useState } from "react";

/**
 * Pequeño aviso flotante "Evidencia guardada" que aparece cada vez que se
 * captura la evidencia de una aceptación/juramento (escucha el evento
 * `oath-evidence-saved` que emite captureOathEvidence). Se autodescarta.
 */
export function OathEvidenceToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onSaved = () => {
      setVisible(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 2800);
    };
    window.addEventListener("oath-evidence-saved", onSaved as EventListener);
    return () => {
      window.removeEventListener("oath-evidence-saved", onSaved as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 rounded-full border border-[#12B886]/40 bg-white/95 px-4 py-2 text-sm font-semibold text-[#0B6E4E] shadow-[0_10px_30px_rgba(18,184,134,0.25)] backdrop-blur">
        <span aria-hidden="true">🔒</span>
        Evidencia guardada (fecha, IP y dispositivo)
      </div>
    </div>
  );
}
