"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Row = { id: string; role: string; fileName: string; sizeBytes: number; uploadedAt: string; uploadedByName: string };

/**
 * Lado del DUEÑO: muestra (y deja descargar) los documentos que subió el
 * invitado (inquilino/codeudor) desde su enlace. Se auto-actualiza para que el
 * dueño sepa cuándo ya subieron.
 */
export function InviteSupportsOwnerList({ contractDraftId, role, title }: { contractDraftId: string; role: "tenant" | "solidaryCoDebtor"; title: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const refresh = useCallback(async () => {
    if (!user || !contractDraftId) return;
    try {
      const res = await fetch(`/api/party-invite/support/owner-list?contractDraftId=${encodeURIComponent(contractDraftId)}&role=${role}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; supports?: Row[] };
      if (res.ok && j.success) setRows(j.supports ?? []);
    } catch {
      /* noop */
    }
  }, [user, contractDraftId, role]);

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
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700">
            <span className="truncate">📎 {r.fileName}</span>
            <button type="button" onClick={() => void download(r.id)} className="flex-none rounded-lg bg-[#5646E5] px-3 py-1 text-[11px] font-bold text-white transition hover:brightness-105">
              Ver / descargar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
