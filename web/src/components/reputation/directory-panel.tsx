"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { StarRating } from "@/components/reputation/star-rating";
import { isReputationDirectoryEnabled } from "@/domain/reputation/directoryFlags";

type Dir = {
  direction: string;
  reviewsCount: number;
  overallAverage: number;
  perCriterion: { key: string; label: string; average: number }[];
};

/**
 * Directorio de reputación (opt-in): el titular autoriza que otros usuarios
 * registrados consulten su agregado; y puede consultar el de otro que también
 * haya autorizado. Se AUTO-OCULTA salvo que el flag esté activo (activación tras
 * visto bueno del abogado). Cumplimiento Ley 1581 de 2012.
 */
export function DirectoryPanel() {
  const { user } = useAuth();
  const enabled = isReputationDirectoryEnabled();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<
    | { authorized: true; subjectEmail: string; aggregate: { totalReviews: number; overallAverage: number; byDirection: Dir[] } }
    | { authorized: false }
    | null
  >(null);
  const [msg, setMsg] = useState("");

  const loadStatus = useCallback(async () => {
    if (!user || !enabled) return;
    try {
      const res = await fetch("/api/reputation/directory/status", { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; authorization?: { authorized?: boolean } };
      if (res.ok && j.success) setAuthorized(Boolean(j.authorization?.authorized));
    } catch {
      /* no-op */
    }
  }, [user, enabled]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  if (!enabled) return null;

  async function setAuth(next: boolean) {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/reputation/directory/authorize", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ authorized: next }),
      });
      const j = (await res.json()) as { success?: boolean; authorization?: { authorized?: boolean }; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo actualizar la autorización.");
        return;
      }
      setAuthorized(Boolean(j.authorization?.authorized));
      setMsg(next ? "Autorizaste la consulta de tu reputación." : "Revocaste la autorización.");
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  async function doLookup() {
    if (!user || !lookupEmail.trim()) return;
    setLookupBusy(true);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/reputation/directory/lookup?subjectEmail=${encodeURIComponent(lookupEmail.trim())}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as
        | { success: true; authorized: true; subjectEmail: string; aggregate: { totalReviews: number; overallAverage: number; byDirection: Dir[] } }
        | { success: true; authorized: false }
        | { success: false };
      if ("success" in j && j.success) {
        setLookupResult(j.authorized ? j : { authorized: false });
      }
    } catch {
      /* no-op */
    } finally {
      setLookupBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Directorio de reputación (entre usuarios)</h2>

      {/* Opt-in del titular */}
      <div className="mt-2 rounded-xl border border-slate-200 bg-white/80 p-3">
        <p className="text-xs text-slate-600">
          Autorizo, de manera libre, previa, expresa e informada, que otros <strong>usuarios registrados</strong> de
          ArriendoSeguro consulten mi <strong>reputación estructurada (promedios)</strong>, con la finalidad exclusiva de
          <strong> evaluar una relación de arrendamiento</strong>. Puedo conocer, actualizar, rectificar (réplica) y
          <strong> revocar</strong> esta autorización cuando quiera (Ley 1581 de 2012). No es público ni se consulta por
          cédula.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className={`text-xs font-semibold ${authorized ? "text-emerald-700" : "text-slate-500"}`}>
            {authorized === null ? "Cargando…" : authorized ? "Autorizado" : "No autorizado"}
          </span>
          {authorized !== null && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void setAuth(!authorized)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${authorized ? "bg-slate-500" : "bg-violet-600"}`}
            >
              {busy ? "Guardando…" : authorized ? "Revocar autorización" : "Autorizar consulta"}
            </button>
          )}
        </div>
        {msg && <p className="mt-1 text-[11px] text-slate-600">{msg}</p>}
      </div>

      {/* Consulta del directorio */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-3">
        <p className="mb-1 text-xs font-medium text-slate-600">Consultar la reputación de otro usuario (por correo)</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={lookupBusy || !lookupEmail.trim()}
            onClick={() => void doLookup()}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {lookupBusy ? "Consultando…" : "Consultar"}
          </button>
        </div>

        {lookupResult && !lookupResult.authorized && (
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            Este usuario no ha autorizado la consulta en el directorio. Puedes solicitarle permiso puntual más abajo.
          </p>
        )}
        {lookupResult?.authorized && (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-slate-800">
              <StarRating name="dir-overall" value={Math.round(lookupResult.aggregate.overallAverage)} readOnly />{" "}
              <span className="text-xs text-slate-500">
                {lookupResult.aggregate.overallAverage.toFixed(1)} / 5 · {lookupResult.aggregate.totalReviews} calificación(es)
              </span>
            </p>
            {lookupResult.aggregate.byDirection.map((d) => (
              <div key={d.direction} className="rounded-lg border border-slate-100 p-2">
                <p className="text-xs font-medium text-slate-700">
                  Como {d.direction === "landlord_to_tenant" ? "arrendatario" : "arrendador"} · {d.overallAverage.toFixed(1)} / 5
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                  {d.perCriterion.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-2">
                      <span>{c.label}</span>
                      <span>{c.average.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
