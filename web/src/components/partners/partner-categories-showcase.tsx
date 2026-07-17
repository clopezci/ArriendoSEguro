"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Cat = { id: string; label: string; icon: string; desc: string };

const CATEGORIES: Cat[] = [
  { id: "recaudo", label: "Recaudo del canon", icon: "🏦", desc: "Que un tercero reciba y concilie el pago del arriendo por ti." },
  { id: "seguro", label: "Seguro de arrendamiento", icon: "🛡️", desc: "Póliza que respalda el pago del canon ante incumplimiento." },
  { id: "estudio_credito", label: "Estudio de crédito", icon: "📋", desc: "Evaluación del posible inquilino o codeudor, con su autorización." },
  { id: "mantenimiento", label: "Mantenimiento y hogar", icon: "🔧", desc: "Plomería, electricidad, pintura y reparaciones del inmueble." },
  { id: "juridica", label: "Asesoría jurídica", icon: "⚖️", desc: "Un abogado para dudas, revisión o un proceso, si lo necesitas." },
  { id: "cobranza", label: "Agencia de cobranza", icon: "📞", desc: "Gestión de cartera y cobro cuando hay mora." },
  { id: "seguro_hogar", label: "Seguro de hogar (mensual)", icon: "🏠", desc: "Protege la casa ante daños comunes (inundación de lavadora, cortos, incendio) por una cuota mensual." },
  { id: "financiamiento", label: "Financiamiento del arriendo", icon: "💸", desc: "Si el inquilino tiene una mala racha, un aliado financiero adelanta el mes y él lo paga en cuotas; el dueño recibe a tiempo." },
];

export function PartnerCategoriesShowcase() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string>("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  async function interested(cat: Cat) {
    if (!user) {
      setError("Inicia sesión para solicitar contacto.");
      return;
    }
    setBusy(cat.id);
    setError("");
    try {
      const res = await fetch("/api/partners/interest", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ category: cat.id, categoryLabel: cat.label }),
      });
      const j = (await res.json()) as { success?: boolean };
      if (!res.ok || !j.success) {
        setError("No se pudo enviar tu interés. Intenta de nuevo.");
        return;
      }
      setDone((d) => ({ ...d, [cat.id]: true }));
    } catch {
      setError("Error de red.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Servicios de aliados</h2>
        <p className="text-sm text-slate-600">
          Servicios opcionales de terceros. Toca <strong>«Me interesa»</strong> y te contactamos para conectarte con el
          aliado. Tú decides; el aliado presta y cobra.
        </p>
      </div>

      {error && <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <li key={c.id} className="flex flex-col rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-sm">
            <span className="text-3xl" aria-hidden="true">{c.icon}</span>
            <h3 className="mt-2 text-base font-bold text-slate-900">{c.label}</h3>
            <p className="mt-1 flex-1 text-sm text-slate-600">{c.desc}</p>
            {done[c.id] ? (
              <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                ✓ ¡Listo! Te contactaremos.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void interested(c)}
                disabled={busy === c.id}
                className="mt-3 min-h-11 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {busy === c.id ? "Enviando…" : "Me interesa"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500">
        Los servicios los prestan y cobran los aliados (terceros). ArriendoSeguro solo te conecta y no se hace
        responsable de la prestación.
      </p>
    </section>
  );
}
