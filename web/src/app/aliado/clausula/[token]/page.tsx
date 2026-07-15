"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Review = {
  contractId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  proposedText: string;
  finalText: string;
  priceCop: number;
  status: "pending" | "drafted" | "declined";
};

export default function LawyerClauseReviewPage() {
  const token = String(useParams<{ token: string }>().token);
  const [review, setReview] = useState<Review | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound">("loading");
  const [finalText, setFinalText] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<"drafted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/aliado/clausula/${token}`);
        const j = (await res.json()) as { success?: boolean; review?: Review };
        if (cancelled) return;
        if (res.ok && j.success && j.review) {
          setReview(j.review);
          setFinalText(j.review.finalText || j.review.proposedText || "");
          setLoadState("ready");
          if (j.review.status === "drafted") setDone("drafted");
          if (j.review.status === "declined") setDone("declined");
        } else {
          setLoadState("notfound");
        }
      } catch {
        if (!cancelled) setLoadState("notfound");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(action: "draft" | "decline") {
    setError(null);
    if (action === "draft" && finalText.trim().length < 10) {
      setError("Escribe la redacción final de la cláusula (mínimo 10 caracteres).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/aliado/clausula/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, finalText: finalText.trim(), reviewerName: reviewerName.trim() }),
      });
      const j = (await res.json()) as { success?: boolean; status?: string; error?: string };
      if (res.ok && j.success) {
        setDone(action === "decline" ? "declined" : "drafted");
      } else {
        setError(j.error === "final_text_too_short" ? "La redacción final es muy corta." : "No se pudo guardar. Intenta de nuevo.");
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const priceText = review && review.priceCop > 0 ? `$${review.priceCop.toLocaleString("es-CO")}` : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5646E5]">ArriendoSeguro · Aliado jurídico</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Redacción de cláusula especial</h1>

        {loadState === "loading" && <p className="mt-6 text-sm text-slate-500">Cargando la solicitud…</p>}

        {loadState === "notfound" && (
          <div className="mt-6 rounded-2xl border-2 border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            No encontramos esta solicitud. El enlace puede haber expirado o ser incorrecto.
          </div>
        )}

        {loadState === "ready" && review && (
          <>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Quién creó el contrato</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{review.requesterName || "(sin nombre)"}</p>
              <p className="mt-1 text-slate-600">
                Correo: <a className="font-medium text-[#5646E5] underline" href={`mailto:${review.requesterEmail}`}>{review.requesterEmail || "—"}</a>
              </p>
              <p className="text-slate-600">Teléfono / WhatsApp: <span className="font-medium">{review.requesterPhone || "—"}</span></p>
              <p className="mt-2 text-xs text-slate-500">Expediente: {review.contractId}{priceText ? ` · Cobro al usuario: ${priceText}` : ""}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Cláusula propuesta por el usuario</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-800">{review.proposedText || "—"}</p>
            </div>

            {done === "drafted" && (
              <div className="mt-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-800">
                <p className="font-bold">✓ Cláusula final registrada.</p>
                <p className="mt-1">Se incorporará automáticamente al contrato del usuario. Puedes cerrar esta página o editar la redacción abajo si lo necesitas.</p>
              </div>
            )}
            {done === "declined" && (
              <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
                <p className="font-bold">Marcaste que la cláusula no procede.</p>
                <p className="mt-1">El usuario verá que su solicitud fue revisada. Puedes registrar una redacción alternativa abajo si cambias de opinión.</p>
              </div>
            )}

            <div className="mt-5">
              <label className="block text-sm font-semibold text-slate-800">Redacción final de la cláusula</label>
              <textarea
                value={finalText}
                onChange={(e) => setFinalText(e.target.value)}
                rows={7}
                maxLength={4000}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Redacta aquí la versión jurídica final que se incorporará al contrato…"
              />
              <label className="mt-3 block text-sm font-semibold text-slate-800">Tu nombre (opcional)</label>
              <input
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Abogado responsable"
              />

              {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submit("draft")}
                  className="rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105 active:scale-95 disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Registrar cláusula final"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submit("decline")}
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                >
                  No procede
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
