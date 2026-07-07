"use client";

/**
 * Escena "camino a casa": un hogar (que cambia en cada escena para ser
 * inclusivo) que se acerca a la casa según el % de avance y entra al 100%.
 * Refuerza el progreso de forma lúdica. Respeta prefers-reduced-motion vía CSS.
 */

// Hogares diversos: persona sola, parejas, familias, mascota, y personas con
// discapacidad (silla de ruedas, bastón) — todos representados.
const WALKERS = ["🚶", "👫", "👨‍👩‍👧", "👨‍👩‍👧‍👦", "🧑‍🦽", "🧑‍🦯", "🚶‍♀️ 🐕", "🧑‍🤝‍🧑"];

const MESSAGES: { min: number; text: string }[] = [
  { min: 100, text: "¡Bienvenido a tu casa! 🎉" },
  { min: 99, text: "¡Casi en la puerta! 🔑" },
  { min: 80, text: "Estás a un paso de entrar…" },
  { min: 60, text: "Cada vez más cerca de tu casa 🏠" },
  { min: 45, text: "¡Ya casi terminas lo esencial!" },
  { min: 30, text: "Vas avanzando… tu casa te espera" },
  { min: 15, text: "Diste el primer paso 👣" },
  { min: 0, text: "Empieza tu camino a casa 🏡" },
];

function messageFor(pct: number): string {
  return (MESSAGES.find((m) => pct >= m.min) ?? MESSAGES[MESSAGES.length - 1]).text;
}

export function JourneyScene({ pct, stepIndex }: { pct: number; stepIndex: number }) {
  const arrived = pct >= 100;
  const left = arrived ? 76 : 2 + pct * 0.66;
  const walker = WALKERS[stepIndex % WALKERS.length];

  return (
    <div className="mt-6 border-t border-dashed border-slate-300 pt-4">
      <p className="mb-1.5 min-h-[20px] text-sm font-semibold text-violet-700 transition-opacity">{messageFor(pct)}</p>
      <div className="relative h-[92px]" aria-hidden>
        <span className="absolute top-0.5 text-xl opacity-50" style={{ left: "20%" }}>☁️</span>
        <span className="absolute text-xl opacity-50" style={{ left: "55%", top: "-4px" }}>☁️</span>
        <div
          className="absolute bottom-[18px] left-0 right-0 h-[3px] rounded"
          style={{ background: "repeating-linear-gradient(90deg,#D9D3C8 0 14px, transparent 14px 30px)" }}
        />
        <svg className="absolute bottom-4 right-[3%]" width="88" height="80" viewBox="0 0 100 92">
          <polygon points="50,6 94,44 6,44" fill="#5646E5" />
          <rect x="16" y="44" width="68" height="44" fill="#fff" stroke="#E7E3DC" strokeWidth="2" />
          <rect x="43" y="60" width="16" height="28" rx="2" fill="#C9A26B" />
          <rect x="24" y="52" width="13" height="13" rx="2" fill={arrived ? "#FFD23F" : "#EAE6DF"} />
        </svg>
        <span
          className="absolute bottom-[14px] inline-block text-[30px] leading-none [transform:scaleX(-1)] motion-safe:animate-[bob_0.5s_ease-in-out_infinite]"
          style={{ left: `${left}%`, transition: "left .6s cubic-bezier(.35,.1,.35,1)" }}
        >
          {walker}
        </span>
      </div>
      {/* El emoji mira a la izquierda por defecto; scaleX(-1) lo voltea para que
          camine mirando hacia la casa (a la derecha). El bob conserva el volteo. */}
      <style>{`@keyframes bob{0%,100%{transform:scaleX(-1) translateY(0)}50%{transform:scaleX(-1) translateY(-3px)}}`}</style>
    </div>
  );
}
