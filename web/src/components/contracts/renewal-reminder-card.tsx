"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Configuración de alertas de terminación/renovación del contrato. La
 * preferencia se guarda en el expediente (no en el contrato legal). Por defecto
 * está activada.
 */
export function RenewalReminderCard({ contractId }: { contractId: string }) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/contracts/renewal-reminder?contractId=${encodeURIComponent(contractId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const json = (await res.json()) as { success?: boolean; enabled?: boolean };
      if (res.ok && json.success) setEnabled(Boolean(json.enabled));
    } catch {
      /* silencioso */
    }
  }, [contractId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(next: boolean) {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/contracts/renewal-reminder", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, enabled: next }),
      });
      const json = (await res.json()) as { success?: boolean; enabled?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setMsg(json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      setEnabled(Boolean(json.enabled));
      setMsg("Preferencia guardada.");
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-300 bg-white/95 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Alertas de terminación o renovación</h2>
      <p className="mt-1 text-xs text-slate-600">
        Te avisamos por <strong>correo y SMS</strong> con anticipación al preaviso legal de 3 meses (Ley 820 de 2003):
        dos recordatorios semanales, el primero <strong>3 meses y 2 semanas</strong> antes del vencimiento. Así decides a
        tiempo si renovar o terminar.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          className="h-4 w-4 accent-violet-600"
          checked={enabled ?? true}
          disabled={busy || enabled === null || !user}
          onChange={(e) => void toggle(e.target.checked)}
        />
        Quiero recibir recordatorios de vencimiento de este contrato
      </label>
      {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}
      {!user && <p className="mt-2 text-xs text-amber-700">Inicia sesión como parte del contrato para configurar.</p>}
    </section>
  );
}
