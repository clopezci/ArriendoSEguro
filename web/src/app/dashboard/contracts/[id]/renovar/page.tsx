"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { IPC_REFERENCE } from "@/lib/domain/rent-law";

function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function isoAddMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}
const money = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CO")}`;

type Lease = { monthlyRent?: number; monthlyRentText?: string; startDate?: string; endDate?: string; termMonths?: number };

export default function RenovarPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [versionId, setVersionId] = useState("");
  const [lease, setLease] = useState<Lease | null>(null);
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newRent, setNewRent] = useState(0);
  const [newRentText, setNewRentText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ newStart: string; newEnd: string; newRent: number; termMonths: number; ipcPercent: number; pdfUrl?: string; emailDelivery?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
      const data = await res.json();
      const st = String(data?.contract?.status ?? "");
      const vId = String(data?.version?.id ?? data?.contract?.currentVersionId ?? "");
      const ls = (data?.version?.contractPayload?.lease ?? null) as Lease | null;
      setStatus(st);
      setVersionId(vId);
      setLease(ls);
      if (ls) {
        const term = Number(ls.termMonths ?? 12) || 12;
        const start = ls.endDate ? isoAddDays(String(ls.endDate), 1) : "";
        const end = start ? isoAddMonths(start, term) : "";
        const rent = Math.round(Number(ls.monthlyRent ?? 0) * (1 + IPC_REFERENCE.percent / 100));
        setNewStart(start);
        setNewEnd(end);
        setNewRent(rent);
        setNewRentText("");
      }
    } catch {
      setError("No se pudo cargar el contrato.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function renew() {
    if (!user) {
      setError("Inicia sesión como una de las partes del contrato.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/contracts/renew", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          contractId: id,
          contractVersionId: versionId,
          mode,
          ...(mode === "custom"
            ? { newStartDate: newStart, newEndDate: newEnd, newMonthlyRent: newRent, newMonthlyRentText: newRentText || undefined }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.errors?.[0]?.message ?? "No se pudo renovar el contrato.");
        return;
      }
      setResult({ ...data.renewal, pdfUrl: data.pdfUrl, emailDelivery: data.emailDelivery });
    } catch {
      setError("Error de red al renovar.");
    } finally {
      setBusy(false);
    }
  }

  const isActive = status === "signed";

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6 text-slate-900">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Gestiona tu arriendo</p>
        <h1 className="text-2xl font-bold tracking-tight">Renovar contrato</h1>
        <Link href={`/dashboard/contracts/${id}/adicionales`} className="text-sm text-violet-700 underline">
          ← Volver a la posventa
        </Link>
      </header>

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {error && <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {!loading && !isActive && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          La renovación solo está disponible para <strong>contratos activos (firmados)</strong>. Este contrato aún no
          está firmado.
        </p>
      )}

      {!loading && isActive && !result && lease && (
        <>
          <p className="text-sm text-slate-700">
            ¿Vas a renovar con el mismo inquilino y la misma información? Elige una opción:
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={`rounded-xl border p-3 text-left text-sm transition ${mode === "auto" ? "border-violet-500 bg-violet-100/60 text-violet-800" : "border-slate-300 bg-white hover:border-violet-500"}`}
            >
              <span className="font-semibold">Dejar todo igual</span>
              <span className="mt-0.5 block text-xs text-slate-600">Renovamos con las mismas condiciones, actualizando fechas y el canon con el IPC.</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`rounded-xl border p-3 text-left text-sm transition ${mode === "custom" ? "border-violet-500 bg-violet-100/60 text-violet-800" : "border-slate-300 bg-white hover:border-violet-500"}`}
            >
              <span className="font-semibold">Editar antes de renovar</span>
              <span className="mt-0.5 block text-xs text-slate-600">Ajusta las fechas o el nuevo canon antes de generar el otrosí.</span>
            </button>
          </div>

          <section className="space-y-3 rounded-xl border border-slate-300 bg-white p-4">
            <p className="text-xs text-slate-600">
              Canon actual: <strong>{money(Number(lease.monthlyRent ?? 0))}</strong> · Vence:{" "}
              <strong>{lease.endDate ?? "—"}</strong> · Reajuste IPC sugerido: <strong>{IPC_REFERENCE.percent}%</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Nueva fecha de inicio</span>
                <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} disabled={mode === "auto"} className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm disabled:opacity-70" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Nueva fecha de fin</span>
                <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} disabled={mode === "auto"} className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm disabled:opacity-70" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Nuevo canon (COP)</span>
                <input type="number" value={newRent || ""} onChange={(e) => setNewRent(Number(e.target.value) || 0)} disabled={mode === "auto"} className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm disabled:opacity-70" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Nuevo canon en letras (opcional)</span>
                <input type="text" value={newRentText} onChange={(e) => setNewRentText(e.target.value)} disabled={mode === "auto"} className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm disabled:opacity-70" />
              </label>
            </div>
          </section>

          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-xs text-slate-700">
            La renovación genera un <strong>otrosí de prórroga y reajuste</strong> (Ley 820, art. 20) asociado a este
            contrato y lo envía a todas las partes. La <strong>firma de la renovación</strong> se activa con Plan Plus.{" "}
            <Link href="/dashboard/plans" className="text-violet-700 underline">Renovar / ver plan</Link>.
          </div>

          <button
            type="button"
            onClick={() => void renew()}
            disabled={busy || !newStart || !newEnd || !newRent}
            className="rounded-xl bg-[#5646E5] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60"
          >
            {busy ? "Renovando y enviando…" : "Renovar y enviar a las partes"}
          </button>
        </>
      )}

      {result && (
        <section className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">¡Contrato renovado!</p>
          <p>
            Nuevo período: <strong>{result.newStart}</strong> a <strong>{result.newEnd}</strong> ({result.termMonths} meses).
          </p>
          <p>
            Nuevo canon: <strong>{money(result.newRent)}</strong> (reajuste {result.ipcPercent}%).
          </p>
          <p>
            {result.emailDelivery === "ok"
              ? "Enviamos el otrosí por correo a todas las partes."
              : result.emailDelivery === "partial"
                ? "Enviamos el otrosí a algunas partes (revisa el correo de las demás)."
                : result.emailDelivery === "failed"
                  ? "No pudimos enviarlo por correo (revisa la configuración de correo)."
                  : "El otrosí quedó archivado como anexo del contrato."}
          </p>
          {result.pdfUrl && (
            <a href={result.pdfUrl} target="_blank" rel="noreferrer" className="inline-block rounded border border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              Descargar otrosí (PDF)
            </a>
          )}
          <p className="pt-1">
            <Link href={`/dashboard/contracts/${id}/adicionales`} className="text-violet-700 underline">← Volver a la posventa</Link>
          </p>
        </section>
      )}
    </main>
  );
}
