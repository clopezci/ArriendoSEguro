"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type PendingReq = { requesterUid: string; requesterEmail: string; status: string; requestedAt: string };
type LookupResult =
  | { status: "none" | "pending" | "denied" }
  | { status: "granted"; aggregate: { totalReviews: number; overallAverage: number } };

/**
 * Secciones de consulta con consentimiento (Habeas Data):
 * - Titular: solicitudes para ver MI reputación → autorizar / rechazar.
 * - Solicitante: pedir ver la reputación de otra persona (por correo) y ver el
 *   agregado solo si fue autorizado.
 */
export function ReputationConsentSections() {
  const { user } = useAuth();

  // --- Titular: solicitudes recibidas ---
  const [requests, setRequests] = useState<PendingReq[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/reputation/lookup/pending", { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; requests?: PendingReq[] };
      if (res.ok && j.success) setRequests(j.requests ?? []);
    } catch {
      /* noop */
    }
  }, [user]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function respond(requesterUid: string, action: "grant" | "deny") {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/reputation/lookup/respond", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ requesterUid, action }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo registrar tu decisión.");
        return;
      }
      setMsg(action === "grant" ? "Autorización registrada." : "Solicitud rechazada.");
      await loadRequests();
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  // --- Solicitante: consultar reputación de otra persona ---
  const [email, setEmail] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  async function requestLookup() {
    if (!user || !email) return;
    setLookupBusy(true);
    setLookupMsg("");
    setResult(null);
    try {
      const res = await fetch("/api/reputation/lookup/request", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ subjectEmail: email }),
      });
      const j = (await res.json()) as { success?: boolean; status?: string; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setLookupMsg(j.errors?.[0]?.message ?? "No se pudo enviar la solicitud.");
        return;
      }
      setLookupMsg(
        j.status === "granted"
          ? "Ya tienes autorización. Consulta el resultado abajo."
          : "Solicitud enviada. La persona debe autorizarla; te avisaremos.",
      );
    } catch {
      setLookupMsg("Error de red.");
    } finally {
      setLookupBusy(false);
    }
  }

  async function checkResult() {
    if (!user || !email) return;
    setLookupBusy(true);
    setLookupMsg("");
    try {
      const res = await fetch(`/api/reputation/lookup/result?subjectEmail=${encodeURIComponent(email)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean } & LookupResult;
      if (!res.ok || !j.success) {
        setLookupMsg("No se pudo consultar el resultado.");
        return;
      }
      setResult(j);
      if (j.status === "pending") setLookupMsg("La consulta sigue pendiente de autorización.");
      else if (j.status === "denied") setLookupMsg("La persona rechazó la consulta.");
      else if (j.status === "none") setLookupMsg("Aún no has solicitado autorización a esta persona.");
    } catch {
      setLookupMsg("Error de red.");
    } finally {
      setLookupBusy(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-violet-300 bg-violet-50/40 p-4">
        <h2 className="text-sm font-semibold text-violet-900">Solicitudes para ver tu reputación</h2>
        <p className="mt-1 text-xs text-slate-600">
          Tú decides. Si autorizas, la persona verá solo tu <strong>promedio</strong> y el número de contratos, nunca
          quién te calificó ni el detalle (Habeas Data, Ley 1581 de 2012).
        </p>
        {requests.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No tienes solicitudes.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((r) => (
              <li
                key={r.requesterUid}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <strong className="text-slate-800">{r.requesterEmail}</strong>{" "}
                  <span
                    className={
                      r.status === "granted"
                        ? "text-emerald-700"
                        : r.status === "denied"
                          ? "text-rose-700"
                          : "text-amber-700"
                    }
                  >
                    · {r.status}
                  </span>
                </span>
                {r.status === "pending" && (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void respond(r.requesterUid, "grant")}
                      className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-700 disabled:opacity-50"
                    >
                      Autorizar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void respond(r.requesterUid, "deny")}
                      className="rounded border border-rose-400 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="mt-2 text-xs text-slate-700">{msg}</p>}
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white/95 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Consultar la reputación de otra persona</h2>
        <p className="mt-1 text-xs text-slate-600">
          Antes de firmar, puedes pedir ver la reputación de la otra parte. Se le envía una solicitud y solo verás su
          promedio <strong>si autoriza</strong>.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@dela-otra-parte.com"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
          <button
            type="button"
            disabled={lookupBusy || !email}
            onClick={() => void requestLookup()}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Solicitar
          </button>
          <button
            type="button"
            disabled={lookupBusy || !email}
            onClick={() => void checkResult()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
          >
            Ver resultado
          </button>
        </div>
        {lookupMsg && <p className="mt-2 text-xs text-slate-700">{lookupMsg}</p>}
        {result?.status === "granted" && (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            Reputación autorizada: <strong>{result.aggregate.overallAverage.toFixed(1)} / 5</strong> en{" "}
            {result.aggregate.totalReviews} calificación(es).
          </div>
        )}
      </section>
    </>
  );
}
