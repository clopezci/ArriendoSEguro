"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { PARTNER_CATEGORY_LABELS, type PartnerCategory } from "@/domain/partners/partners";

type Partner = { id: string; name: string; category: string; description: string; websiteUrl: string };

function categoryLabel(c: string): string {
  return PARTNER_CATEGORY_LABELS[c as PartnerCategory] ?? "Servicio";
}

const CATEGORY_ICON: Record<string, string> = {
  recaudo: "💳",
  seguro: "🛡️",
  estudio_credito: "📊",
  mantenimiento: "🔧",
  juridica: "⚖️",
  cobranza: "📮",
  otro: "🤝",
};

export function PartnersDirectory() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [active, setActive] = useState<Partner | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partners/active", { cache: "no-store" });
        const j = (await res.json()) as { success?: boolean; partners?: Partner[] };
        if (!cancelled && res.ok && j.success) setPartners(j.partners ?? []);
        else if (!cancelled) setPartners([]);
      } catch {
        if (!cancelled) setPartners([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (partners === null) return <p className="text-sm text-slate-500">Cargando aliados…</p>;
  if (partners.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
        Aún no hay aliados disponibles. Próximamente publicaremos servicios de terceros (recaudo, seguro, estudio de
        crédito, mantenimiento, jurídica) que tú decides tomar.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {partners.map((p) => (
          <li key={p.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_10px_30px_rgba(86,70,229,0.06)]">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[#ECE9FB] text-xl">{CATEGORY_ICON[p.category] ?? "🤝"}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#5646E5]">{categoryLabel(p.category)}</p>
                <h3 className="text-[15px] font-bold tracking-tight text-[#17151F]">{p.name}</h3>
              </div>
            </div>
            {p.description && <p className="mt-2 flex-1 text-sm text-slate-500">{p.description}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActive(p)}
                className="rounded-2xl bg-[#5646E5] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-105 active:scale-95"
              >
                Contactar
              </button>
              {p.websiteUrl && (
                <a
                  href={p.websiteUrl}
                  target="_blank"
                  rel="sponsored noreferrer"
                  className="rounded-2xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5]"
                >
                  Visitar sitio
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-400">
        Los servicios los prestan y cobran los aliados (terceros). ArriendoSeguro solo te conecta y no se hace
        responsable de la prestación.
      </p>
      {active && <ContactModal partner={active} userEmail={user?.email ?? ""} onClose={() => setActive(null)} />}
    </>
  );
}

function ContactModal({
  partner,
  userEmail,
  onClose,
}: {
  partner: Partner;
  userEmail: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!user) return;
    if (name.trim().length < 2 || phone.trim().length < 5) {
      setError("Ingresa tu nombre y un teléfono de contacto.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partners/lead", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ partnerId: partner.id, name, phone, message }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setError(j.errors?.[0]?.message ?? "No se pudo enviar la solicitud.");
        return;
      }
      setDone(true);
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-contact-title"
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
    >
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-[101] w-full max-w-md rounded-3xl border border-slate-200 bg-[#F5F3EF] p-6 shadow-[0_24px_60px_rgba(86,70,229,0.25)] focus:outline-none"
      >
        <h2 id="partner-contact-title" className="text-xl font-black tracking-tight text-[#17151F]">
          Contactar a {partner.name}
        </h2>
        {done ? (
          <div className="mt-3 rounded-2xl border-2 border-[#12B886]/40 bg-[#12B886]/10 p-4 text-sm text-emerald-800">
            <p className="font-bold">¡Listo! Compartimos tus datos con el aliado.</p>
            <p className="mt-1">Te enviamos un correo de confirmación; cuando lo resuelvas, ayúdanos confirmando si tomaste el servicio (así llevamos el control).</p>
            <div className="mt-3 text-right">
              <button type="button" onClick={onClose} className="rounded-2xl bg-[#5646E5] px-5 py-2.5 text-sm font-bold text-white">
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">
              Enviaremos tus datos al aliado para que te contacte. Tu correo registrado ({userEmail}) se incluye
              automáticamente.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Tu nombre</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5646E5]"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Teléfono de contacto</span>
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5646E5]"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">¿Qué necesitas? (opcional)</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5646E5]"
                />
              </label>
            </div>
            {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600">
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="rounded-2xl bg-[#FF6B4A] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95 disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Enviar solicitud"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
