"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Control de VERIFICACIÓN MANUAL del dueño para un documento. Aparece junto a la
 * alerta de la IA: si el dueño revisó el documento a ojo y está bien, lo marca
 * como "revisado por él". Queda registrado (quién/cuándo) y se puede deshacer.
 * SIEMPRE opcional; no reemplaza el juramento final.
 *
 * `scope` = contractDraftId/contractId; `docKey` = id único del documento.
 * `onChange(reviewed)` avisa al padre para que suavice/oculte la alerta.
 */
export function ManualReviewControl({
  scope,
  docKey,
  onChange,
  className = "",
}: {
  scope: string;
  docKey: string;
  onChange?: (reviewed: boolean) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user || !scope) return;
      try {
        const res = await fetch(`/api/documents/manual-review?scope=${encodeURIComponent(scope)}`, {
          headers: { ...(await buildAuthHeaders(user)) },
        });
        const j = (await res.json()) as { reviewed?: string[] };
        if (cancelled) return;
        const r = Array.isArray(j.reviewed) && j.reviewed.includes(docKey);
        setReviewed(r);
        onChange?.(r);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
    // onChange se omite a propósito para no re-disparar el fetch en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, scope, docKey]);

  const setMark = useCallback(
    async (value: boolean) => {
      if (!user || busy) return;
      setBusy(true);
      try {
        const res = await fetch("/api/documents/manual-review", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
          body: JSON.stringify({ scope, key: docKey, reviewed: value }),
        });
        if (res.ok) {
          setReviewed(value);
          onChange?.(value);
        }
      } catch {
        /* noop */
      } finally {
        setBusy(false);
      }
    },
    [user, busy, scope, docKey, onChange],
  );

  if (!user) return null;

  if (reviewed) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ${className}`}
      >
        ✓ Revisado por ti
        <button
          type="button"
          onClick={() => void setMark(false)}
          disabled={busy}
          className="underline decoration-emerald-400 hover:text-emerald-900"
        >
          deshacer
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void setMark(true)}
      disabled={busy}
      title="Confírmalo si lo revisaste y está correcto; se registra y quita la alerta."
      className={`inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 ${className}`}
    >
      {busy ? "…" : "✓ Lo revisé, está correcto"}
    </button>
  );
}
