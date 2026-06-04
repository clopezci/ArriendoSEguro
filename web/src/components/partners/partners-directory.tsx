"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { PARTNER_CATEGORY_LABELS, type PartnerCategory } from "@/domain/partners/partners";

type Partner = { id: string; name: string; category: string; description: string; websiteUrl: string };

function categoryLabel(c: string): string {
  return PARTNER_CATEGORY_LABELS[c as PartnerCategory] ?? "Servicio";
}

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

  if (partners === null) return <p className="text-sm text-slate-600">Cargando aliados…</p>;
  if (partners.length === 0) {
    return (
      <p className="rounded-xl border border-slate-300 bg-white/90 p-4 text-sm text-slate-600">
        Aún no hay aliados disponibles. Próximamente publicaremos servicios de terceros (recaudo, seguro, estudio de
        crédito, mantenimiento, jurídica) que tú decides tomar.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {partners.map((p) => (
          <li key={p.id} className="rounded-2xl border border-slate-300 bg-white/95 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-700">{categoryLabel(p.category)}</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900">{p.name}</h3>
            {p.description && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActive(p)}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Contactar
              </button>
              {p.websiteUrl && (
                <a
                  href={p.websiteUrl}
                  target="_blank"
                  rel="sponsored noreferrer"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:border-violet-500"
                >
                  Visitar sitio
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
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
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-[101] w-full max-w-md rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.25)] focus:outline-none"
      >
        <h2 id="partner-contact-title" className="text-lg font-bold text-slate-900">
          Contactar a {partner.name}
        </h2>
        {done ? (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            ¡Listo! Compartimos tus datos con el aliado. Te enviamos un correo de confirmación; cuando lo resuelvas,
            ayúdanos confirmando si tomaste el servicio.
            <div className="mt-3 text-right">
              <button type="button" onClick={onClose} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-600">
              Enviaremos tus datos al aliado para que te contacte. Tu correo registrado ({userEmail}) se incluye
              automáticamente.
            </p>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Tu nombre</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Teléfono de contacto</span>
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">¿Qué necesitas? (opcional)</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>
            {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800">
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
