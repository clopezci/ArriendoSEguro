"use client";

/**
 * Ayuda paso a paso para el dictado por voz, según lo que ocurrió:
 *  - "ios": iPhone/iPad no soportan dictado dentro de la web, pero sí el
 *    micrófono del teclado del propio iPhone (funciona en cualquier campo).
 *  - "blocked": el navegador tiene el micrófono bloqueado/denegado; se explica
 *    cómo reactivarlo.
 *  - "unsupported": navegador sin reconocimiento de voz; se sugiere Chrome o el
 *    teclado del teléfono.
 */

export type VoiceHelpReason = "ios" | "blocked" | "unsupported";

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-3 space-y-2">
      {items.map((t, k) => (
        <li key={k} className="flex gap-2.5 text-sm text-slate-700">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
            {k + 1}
          </span>
          <span className="pt-0.5">{t}</span>
        </li>
      ))}
    </ol>
  );
}

export function VoiceHelp({ reason, onClose }: { reason: VoiceHelpReason; onClose: () => void }) {
  const content =
    reason === "ios"
      ? {
          title: "Dictar por voz en iPhone / iPad",
          intro:
            "En iPhone el dictado va por el teclado (funciona en todos los campos). Es muy fácil:",
          steps: [
            "Toca el campo donde quieres escribir para que aparezca el teclado.",
            "En el teclado, toca la tecla del micrófono 🎤 (abajo, junto a la barra espaciadora).",
            "Habla con naturalidad; verás cómo se escribe solo.",
            "Toca “Listo” o el teclado para terminar.",
          ],
          foot: "La primera vez, iPhone te pedirá activar el Dictado: toca “Activar dictado”. Si no ves el micrófono en el teclado, actívalo en Ajustes → General → Teclado → Activar Dictado.",
        }
      : reason === "blocked"
        ? {
            title: "Activa el micrófono",
            intro: "El navegador tiene el micrófono bloqueado. Actívalo así:",
            steps: [
              "Toca el candado 🔒 (o el ícono a la izquierda de la dirección web, arriba).",
              "Entra a “Permisos del sitio” y busca “Micrófono”.",
              "Cámbialo a “Permitir”.",
              "Recarga la página y vuelve a tocar el micrófono.",
            ],
            foot: "En Android/Chrome también puedes ir a Ajustes del navegador → Configuración del sitio → Micrófono. Y revisa que el navegador tenga permiso de micrófono en los ajustes del teléfono.",
          }
        : {
            title: "Tu navegador no permite dictado",
            intro: "Este navegador no tiene reconocimiento de voz. Tienes dos opciones fáciles:",
            steps: [
              "Abre la página en Google Chrome (o Microsoft Edge), que sí lo soportan.",
              "O usa el micrófono del teclado de tu teléfono: toca el campo y luego la tecla del micrófono 🎤 del teclado.",
            ],
            foot: "También puedes escribir normalmente: el dictado es solo una ayuda.",
          };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
          🎤 Ayuda
        </div>
        <h3 className="mt-2 text-xl font-black text-[#17151F]">{content.title}</h3>
        <p className="mt-1.5 text-sm text-slate-500">{content.intro}</p>
        <Steps items={content.steps} />
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{content.foot}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white transition hover:brightness-105 active:scale-95"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
