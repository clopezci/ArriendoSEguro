"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { ManualReviewControl } from "@/components/documents/manual-review-control";
import { buildWhatsAppUrl } from "@/lib/nuevo/whatsapp";

type ReqDoc = { key: string; label: string; uploaded: boolean; validated: boolean; supportId: string | null; fileName: string };
type Extra = { id: string; fileName: string; validated: boolean; docLabel: string };
type Party = {
  role: "tenant" | "solidaryCoDebtor";
  slot: number | null;
  name: string;
  email: string;
  phone: string;
  requiredDocs: ReqDoc[];
  extras: Extra[];
  pendingCount: number;
  requiredTotal: number;
  allRequiredPresent: boolean;
  inviteUrl: string | null;
  inviteExpired: boolean;
};

function partyTitle(p: Party): string {
  if (p.role === "tenant") return "Arrendatario (inquilino)";
  const n = typeof p.slot === "number" && p.slot > 0 ? ` ${p.slot + 1}` : "";
  return `Codeudor${n}`;
}

export default function SoportesCodeudorPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [draftId, setDraftId] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sharing, setSharing] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/party-invite/support/reconcile?contractId=${encodeURIComponent(id)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; draftId?: string; parties?: Party[]; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setErr(j.errors?.[0]?.message ?? "No se pudo cargar el estado de los soportes.");
        return;
      }
      setDraftId(j.draftId ?? "");
      setParties(j.parties ?? []);
    } catch {
      setErr("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { void load(); }, [load]);

  async function download(supportId: string) {
    if (!user) return;
    try {
      const res = await fetch(`/api/party-invite/support/download-url?id=${encodeURIComponent(supportId)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; downloadUrl?: string };
      if (res.ok && j.success && j.downloadUrl) window.open(j.downloadUrl, "_blank", "noopener,noreferrer");
    } catch { /* noop */ }
  }

  /** Genera/reutiliza el enlace de la parte y abre el WhatsApp del dueño. */
  async function shareWithParty(p: Party) {
    if (!user) return;
    // Si ya están TODOS los exigidos, confirmar si quiere pedir adicionales.
    if (p.requiredTotal > 0 && p.pendingCount === 0) {
      const ok = window.confirm(
        `Los documentos exigidos a ${partyTitle(p)} ya están completos. ¿Quieres enviarle el enlace de todas formas para que suba documentos adicionales?`,
      );
      if (!ok) return;
    }
    setSharing(`${p.role}:${p.slot}`);
    try {
      let url = p.inviteUrl;
      if (!url) {
        // No hay enlace vigente: creamos/reutilizamos la invitación de esa parte.
        const res = await fetch("/api/party-invite/create", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
          body: JSON.stringify({
            contractDraftId: draftId,
            role: p.role,
            inviteeEmail: p.email || "",
            inviteeName: p.name || "",
            codebtorSlot: p.role === "tenant" ? undefined : p.slot ?? 0,
          }),
        });
        const j = (await res.json()) as { success?: boolean; invitationUrl?: string; errors?: { message?: string }[] };
        if (!res.ok || !j.success || !j.invitationUrl) {
          alert(j.errors?.[0]?.message ?? "No se pudo generar el enlace.");
          return;
        }
        url = j.invitationUrl;
      }
      const firstName = (p.name || "").split(" ")[0];
      const faltan = p.pendingCount > 0 ? ` Te faltan ${p.pendingCount} documento(s).` : "";
      const msg = `Hola${firstName ? ` ${firstName}` : ""}, por favor sube tus documentos del contrato de arriendo en este enlace seguro: ${url}${faltan} Puedes volver a él cuando quieras para actualizarlos.`;
      window.open(buildWhatsAppUrl(p.phone, msg), "_blank", "noopener,noreferrer");
      // Refrescamos para tomar el enlace recién creado.
      void load();
    } catch {
      alert("Error de red al generar/compartir el enlace.");
    } finally {
      setSharing("");
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <ExpedientePostWizardNav contractId={id} />

      <header className="space-y-2">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[#17151F]">Soportes de ingresos (inquilino y codeudor)</h1>
        <p className="mt-2 text-slate-500">
          Estado real de los documentos que exigiste a cada parte: lo que ya subieron por su enlace, lo que ya validaste y
          lo que falta. Comparte el enlace para que suban lo pendiente (o lo actualicen cuando quieran).
        </p>
      </header>

      {loading && <p className="text-sm text-slate-600">Cargando estado…</p>}
      {err && <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}

      {!loading && !err && parties.map((p) => (
        <section key={`${p.role}:${p.slot}`} className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{partyTitle(p)}{p.name ? ` · ${p.name}` : ""}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {p.requiredTotal === 0
                  ? "No le exigiste documentos en el flujo del contrato."
                  : p.allRequiredPresent
                    ? "✓ Ya subió todos los documentos exigidos."
                    : `Faltan ${p.pendingCount} de ${p.requiredTotal} documentos exigidos.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void shareWithParty(p)}
              disabled={sharing === `${p.role}:${p.slot}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-95 disabled:opacity-60"
            >
              {sharing === `${p.role}:${p.slot}` ? "Generando…" : "🟢 Compartir enlace por WhatsApp"}
            </button>
          </div>

          {/* Documentos EXIGIDOS con su estado real. */}
          {p.requiredDocs.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {p.requiredDocs.map((d) => (
                <li key={d.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-slate-800">{d.label}</span>
                  <span className="flex flex-none flex-wrap items-center gap-1.5">
                    {d.uploaded ? (
                      <>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Subido</span>
                        {d.validated ? (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">✓ Validado por ti</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Sin validar</span>
                        )}
                        {d.supportId && (
                          <>
                            <button type="button" onClick={() => void download(d.supportId!)} className="rounded-lg bg-[#5646E5] px-2 py-0.5 text-[11px] font-bold text-white">Ver</button>
                            <ManualReviewControl scope={draftId} docKey={`support:${d.supportId}`} onChange={() => void load()} />
                          </>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Pendiente</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Adicionales subidos que NO estaban exigidos. */}
          {p.extras.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-500">Otros documentos que subió (no exigidos)</p>
              <ul className="mt-1.5 space-y-1.5">
                {p.extras.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-800">📎 {e.fileName}{e.docLabel ? ` · ${e.docLabel}` : ""}</span>
                    <span className="flex flex-none items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">No exigido</span>
                      <button type="button" onClick={() => void download(e.id)} className="rounded-lg bg-[#5646E5] px-2 py-0.5 text-[11px] font-bold text-white">Ver</button>
                      <ManualReviewControl scope={draftId} docKey={`support:${e.id}`} onChange={() => void load()} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.inviteUrl && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <p className="text-[11px] font-medium text-slate-600">Enlace para que {partyTitle(p).toLowerCase()} suba/actualice sus documentos (vigente):</p>
              <div className="mt-1 flex items-center gap-2">
                <input readOnly value={p.inviteUrl} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700" />
                <button type="button" onClick={() => void navigator.clipboard?.writeText(p.inviteUrl!)} className="flex-none rounded-lg border border-[#5646E5] px-2 py-1 text-[11px] font-semibold text-[#5646E5]">Copiar</button>
              </div>
            </div>
          )}
        </section>
      ))}

      {!loading && !err && parties.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">No hay partes con soportes en este contrato.</p>
      )}
    </main>
  );
}
