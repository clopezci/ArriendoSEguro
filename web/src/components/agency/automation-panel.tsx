"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

export function AutomationPanel({ agencyId }: { agencyId: string }) {
  const { user } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [secretsAvailable, setSecretsAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agency/${agencyId}/automation`, { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; config?: { webhookUrl?: string; hasSecret?: boolean; secretsAvailable?: boolean } };
      if (json?.success && json.config) {
        setWebhookUrl(json.config.webhookUrl ?? "");
        setHasSecret(Boolean(json.config.hasSecret));
        setSecretsAvailable(json.config.secretsAvailable !== false);
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
      const res = await fetch(`/api/agency/${agencyId}/automation`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim(), ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}) }),
      });
      const json = (await res.json()) as { success?: boolean; config?: { hasSecret?: boolean }; errors?: { message?: string }[] };
      if (!res.ok || !json.success) setErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
      else {
        setMsg("✅ Automatización guardada.");
        setWebhookSecret("");
        setHasSecret(Boolean(json.config?.hasSecret));
      }
    } catch {
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <p className="text-sm font-bold text-violet-900">⚙️ Automatizaciones</p>
        <p className="mt-1 text-xs text-slate-600">
          Conecta tus herramientas (n8n, Zapier, Make, tu CRM) sin complicaciones: cada vez que llega una solicitud
          nueva, te la enviamos a tu URL. Desde ahí automatizas lo que quieras.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-800">Webhook de eventos</p>
        <p className="mt-1 text-xs text-slate-500">Pega la URL de tu flujo (n8n/Zapier/Make). Te enviaremos un POST con cada solicitud nueva.</p>
        <input className={`${input} mt-2`} placeholder="https://tu-n8n.com/webhook/…" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
        <input className={`${input} mt-2`} type="password" placeholder={hasSecret ? "Secreto (guardado — escribe para reemplazar)" : "Secreto para verificar (opcional)"} value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
        {!secretsAvailable && <p className="mt-1 text-[11px] text-amber-600">⚠ El secreto no se puede guardar hasta configurar el cifrado del servidor (AGENCY_SECRETS_KEY). La URL sí funciona.</p>}
        <button type="button" onClick={() => void save()} disabled={loading} className="mt-3 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {loading ? "Guardando…" : "Guardar"}
        </button>
        {hasSecret && <span className="ml-2 text-[11px] text-emerald-600">✓ secreto configurado</span>}
        {msg && <p className="mt-2 text-xs font-semibold text-emerald-700">{msg}</p>}
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">Qué recibes (evento <code>submission.created</code>)</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">{`{
  "event": "submission.created",
  "agencyId": "…",
  "data": {
    "submissionId": "…",
    "tenant": { "fullName","documentNumber","email","phone","city" },
    "propertyHint": "…",
    "study": { "income","contractType","hasCodebtor" }
  }
}`}</pre>
        <p className="mt-2">Enviamos un header <code>x-webhook-secret</code> con tu secreto para que verifiques que somos nosotros.</p>
        <p className="mt-2 text-slate-500">Ideas: crear la ficha en tu CRM, avisar a un agente por WhatsApp/Slack, agregar a una hoja de cálculo, disparar tu propio estudio y devolvernos el score.</p>
      </div>
    </div>
  );
}
