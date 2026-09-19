"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

export function AgencyConfig({ agencyId }: { agencyId: string }) {
  const { user } = useAuth();
  const [logoUrl, setLogoUrl] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agency/${agencyId}/settings`, { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; logoUrl?: string; whatsappNumber?: string };
      if (json?.success) {
        setLogoUrl(json.logoUrl ?? "");
        setWhatsappNumber(json.whatsappNumber ?? "");
      }
    } catch {
      /* noop */
    }
  }, [agencyId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setMsg(null);
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ logoUrl: logoUrl.trim(), whatsappNumber: whatsappNumber.trim() }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
      else setMsg("✅ Configuración guardada.");
    } catch {
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  const digits = whatsappNumber.replace(/[^\d]/g, "");
  const waFunnel = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(`AG-${agencyId} Quiero arrendar`)}` : "";
  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-800">Marca</p>
        <p className="mt-1 text-xs text-slate-500">Tu logo aparece en el formulario que llenan tus inquilinos, así se ve como tuyo aunque llegue por nuestro canal.</p>
        <label className="mt-3 block text-xs text-slate-500">
          URL de tu logo (imagen alojada en internet)
          <input className={`${input} mt-1`} placeholder="https://…/mi-logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </label>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Vista previa del logo" className="mt-2 h-12 w-auto max-w-[160px] object-contain" />
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-800">WhatsApp propio (opcional)</p>
        <p className="mt-1 text-xs text-slate-500">Si tienes tu propio WhatsApp, ponlo con indicativo (ej. 57300…). Generaremos un enlace para que tus clientes te escriban y reciban tu formulario. Si lo dejas vacío, puedes usar el enlace/QR web por cualquier canal.</p>
        <input className={`${input} mt-3`} placeholder="Ej: 573001234567" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
        {waFunnel && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">{waFunnel}</code>
            <button
              type="button"
              onClick={() => { try { void navigator.clipboard.writeText(waFunnel); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ } }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? "¡Copiado!" : "Copiar enlace WhatsApp"}
            </button>
          </div>
        )}
      </div>

      <button type="button" onClick={() => void save()} disabled={loading} className="rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
        {loading ? "Guardando…" : "Guardar configuración"}
      </button>
      {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </div>
  );
}
