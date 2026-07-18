"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { verdictBadge, type SupportVerdict as Verdict } from "@/domain/documents/verdictBadge";

type Row = { id: string; role: string; fileName: string; sizeBytes: number; uploadedAt: string; uploadedByName: string };

/**
 * Lado del DUEÑO: muestra (y deja descargar) los documentos que subió el
 * invitado (inquilino/codeudor) desde su enlace. Se auto-actualiza para que el
 * dueño sepa cuándo ya subieron.
 */
export function InviteSupportsOwnerList({ contractDraftId, role, title, codebtorSlot }: { contractDraftId: string; role: "tenant" | "solidaryCoDebtor"; title: string; codebtorSlot?: number }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  async function verify(id: string) {
    if (!user) return;
    setVerdicts((p) => ({ ...p, [id]: { status: "checking" } }));
    try {
      const res = await fetch("/api/party-invite/support/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ supportId: id }),
      });
      const j = (await res.json()) as Verdict & { success?: boolean };
      setVerdicts((p) => ({ ...p, [id]: res.ok && j.success ? j : { status: "skipped" } }));
    } catch {
      setVerdicts((p) => ({ ...p, [id]: { status: "skipped" } }));
    }
  }

  const refresh = useCallback(async () => {
    if (!user || !contractDraftId) return;
    try {
      const slotQ = typeof codebtorSlot === "number" ? `&codebtorSlot=${codebtorSlot}` : "";
      const res = await fetch(`/api/party-invite/support/owner-list?contractDraftId=${encodeURIComponent(contractDraftId)}&role=${role}${slotQ}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; supports?: Row[] };
      if (res.ok && j.success) setRows(j.supports ?? []);
    } catch {
      /* noop */
    }
  }, [user, contractDraftId, role, codebtorSlot]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15000);
    return () => clearInterval(t);
  }, [refresh]);

  async function download(id: string) {
    if (!user) return;
    try {
      const res = await fetch(`/api/party-invite/support/download-url?id=${encodeURIComponent(id)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; downloadUrl?: string };
      if (res.ok && j.success && j.downloadUrl) window.open(j.downloadUrl, "_blank", "noopener,noreferrer");
    } catch {
      /* noop */
    }
  }

  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-[#12B886]/30 bg-[#12B886]/[0.06] p-3">
      <p className="text-sm font-bold text-[#0B7A55]">{title} ({rows.length})</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => {
          const badge = verdicts[r.id] ? verdictBadge(verdicts[r.id]) : null;
          return (
            <li key={r.id} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">📎 {r.fileName}</span>
                <span className="flex flex-none gap-1">
                  <button type="button" onClick={() => void verify(r.id)} className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                    Verificar
                  </button>
                  <button type="button" onClick={() => void download(r.id)} className="rounded-lg bg-[#5646E5] px-3 py-1 text-[11px] font-bold text-white transition hover:brightness-105">
                    Ver / descargar
                  </button>
                </span>
              </div>
              {badge && <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.text}</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        La verificación por IA es <b>orientativa y no vinculante</b>: revisa que el documento sea del tipo correcto y
        que el nombre/número coincidan. Un asistente automatizado procesa el documento solo para esta validación (Ley 1581 de 2012).
      </p>
    </div>
  );
}
