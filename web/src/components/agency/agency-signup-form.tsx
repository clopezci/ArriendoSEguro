"use client";

import { useState } from "react";
import Link from "next/link";

type Fields = {
  name: string;
  nit: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  escalationEmail: string;
  city: string;
  monthlyVolume: string;
  message: string;
};

const EMPTY: Fields = {
  name: "",
  nit: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  escalationEmail: "",
  city: "",
  monthlyVolume: "",
  message: "",
};

export function AgencySignupForm({ trialCredits }: { trialCredits: number }) {
  const [f, setF] = useState<Fields>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set<K extends keyof Fields>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    // Validación mínima en cliente (el servidor revalida).
    if (f.name.trim().length < 2 || f.contactName.trim().length < 2) {
      setErr("Completa el nombre de la agencia y del contacto.");
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailOk.test(f.contactEmail.trim())) {
      setErr("Escribe un correo de contacto válido.");
      return;
    }
    if (!emailOk.test(f.escalationEmail.trim())) {
      setErr("Escribe un correo de escalamiento/PQR válido (para casos de fraude).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/agencias/registro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setErr(json.errors?.[0]?.message ?? "No se pudo completar el registro. Intenta de nuevo.");
      } else {
        setDone(true);
      }
    } catch {
      setErr("Error de red. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
        <p className="text-2xl">🎉</p>
        <h2 className="mt-2 text-lg font-black text-emerald-900">¡Tu prueba está activa!</h2>
        <p className="mt-1 text-sm text-emerald-800">
          Te enviamos un correo a <strong>{f.contactEmail}</strong>. Entra con ese mismo correo a tu panel y empieza con {trialCredits} contratos gratis.
        </p>
        <Link
          href="/agency"
          className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-[#5646E5] px-6 text-sm font-bold text-white transition hover:brightness-105"
        >
          Entrar a mi panel →
        </Link>
      </div>
    );
  }

  const input = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#5646E5]";
  const label = "block text-xs font-semibold text-slate-600";

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white/80 p-6 backdrop-blur">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={label}>Nombre de la agencia *</span>
          <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Inmobiliaria Los Alpes" maxLength={120} />
        </label>
        <label>
          <span className={label}>NIT (opcional)</span>
          <input className={input} value={f.nit} onChange={(e) => set("nit", e.target.value)} maxLength={40} />
        </label>
        <label>
          <span className={label}>Ciudad</span>
          <input className={input} value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Medellín" maxLength={80} />
        </label>
        <label>
          <span className={label}>Tu nombre *</span>
          <input className={input} value={f.contactName} onChange={(e) => set("contactName", e.target.value)} maxLength={120} />
        </label>
        <label>
          <span className={label}>Tu teléfono / WhatsApp</span>
          <input className={input} value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} inputMode="tel" maxLength={30} />
        </label>
        <label>
          <span className={label}>Correo de acceso *</span>
          <input className={input} value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} type="email" inputMode="email" placeholder="tu@inmobiliaria.com" />
          <span className="mt-1 block text-[11px] text-slate-400">Con este correo entrarás a tu panel.</span>
        </label>
        <label>
          <span className={label}>Correo de escalamiento/PQR *</span>
          <input className={input} value={f.escalationEmail} onChange={(e) => set("escalationEmail", e.target.value)} type="email" inputMode="email" placeholder="pqr@inmobiliaria.com" />
          <span className="mt-1 block text-[11px] text-slate-400">A donde llegan casos de fraude/suplantación.</span>
        </label>
        <label>
          <span className={label}>Contratos al mes (aprox.)</span>
          <input className={input} value={f.monthlyVolume} onChange={(e) => set("monthlyVolume", e.target.value)} placeholder="10-20" maxLength={40} />
        </label>
        <label className="sm:col-span-2">
          <span className={label}>Cuéntanos qué necesitas (opcional)</span>
          <textarea className={input} value={f.message} onChange={(e) => set("message", e.target.value)} rows={3} maxLength={1000} />
        </label>
      </div>

      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#FF6B4A] px-6 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95 disabled:opacity-50"
      >
        {busy ? "Creando tu prueba…" : `Crear mi agencia — ${trialCredits} contratos gratis`}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-400">Sin tarjeta. Al registrarte aceptas los términos y la política de datos.</p>
    </form>
  );
}
