"use client";

import { useCallback, useEffect, useState } from "react";

type Tip = { icon: string; title: string; text: string };

/**
 * Carrusel de buenas prácticas para el DUEÑO (estilo MercadoLibre). Consejos de
 * verificación y documentación, redactados para NO inducir discriminación ni
 * juicios sobre las personas (nada de "desconfía de X"): siempre en clave de
 * "pide soportes / referencias / más garantías". Rota solo y permite avanzar.
 */
const TIPS: Tip[] = [
  {
    icon: "⭐",
    title: "Pide la reputación",
    text: "Antes de firmar, pídele a tu inquilino que comparta su reputación en ArriendoSeguro. Un buen historial da tranquilidad.",
  },
  {
    icon: "📞",
    title: "Solicita referencias",
    text: "Pide referencias de arrendamientos anteriores. Hablar con el arrendador previo dice mucho de cómo cuida y paga.",
  },
  {
    icon: "🧾",
    title: "Verifica ingresos",
    text: "Confirma la capacidad de pago con soportes reales: carta laboral, colillas de pago o extractos bancarios.",
  },
  {
    icon: "🤝",
    title: "Respáldate con codeudor",
    text: "Un codeudor solidario suma seguridad. Verifica también sus ingresos y su documento.",
  },
  {
    icon: "🛡️",
    title: "Si faltan soportes, pide más garantías",
    text: "Si el candidato no puede darte referencias ni soportes, no lo descartes por prejuicio: pide garantías adicionales antes de decidir.",
  },
  {
    icon: "📷",
    title: "Inventario con fotos",
    text: "El día de la entrega, registra el estado del inmueble con fotos y genera el acta firmada. Evita discusiones al final.",
  },
  {
    icon: "✅",
    title: "Registra los pagos",
    text: "Anota cada pago en la plataforma. Construyes historial y evidencia, y activas los recordatorios automáticos.",
  },
  {
    icon: "✍️",
    title: "Firma con evidencia",
    text: "Usa la firma electrónica con evidencia (Ley 527). Le da validez a tu contrato y queda todo trazable.",
  },
];

const ROTATE_MS = 7000;

export function OwnerTipsCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((next: number) => {
    setI(((next % TIPS.length) + TIPS.length) % TIPS.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((prev) => (prev + 1) % TIPS.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused]);

  const tip = TIPS[i];

  return (
    <section
      aria-label="Consejos para arrendar mejor"
      className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-[0_8px_22px_rgba(245,158,11,0.10)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-amber-100 text-2xl" aria-hidden="true">
          {tip.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Consejo para arrendar mejor</p>
          <h3 className="text-sm font-bold text-[#17151F]">{tip.title}</h3>
          <p className="mt-0.5 text-sm text-slate-700">{tip.text}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          {TIPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Ir al consejo ${idx + 1}`}
              aria-current={idx === i}
              onClick={() => go(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-amber-500" : "w-1.5 bg-amber-200 hover:bg-amber-300"}`}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Consejo anterior"
            onClick={() => go(i - 1)}
            className="grid h-7 w-7 place-items-center rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-100"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Siguiente consejo"
            onClick={() => go(i + 1)}
            className="grid h-7 w-7 place-items-center rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-100"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
