"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";
import type { PaymentMethodKind, AccountType } from "@/domain/payments/paymentSettings";

export default function PagosRecordatoriosPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [method, setMethod] = useState<PaymentMethodKind>("none");
  const [bank, setBank] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("ahorros");
  const [accountNumber, setAccountNumber] = useState("");
  const [qrStoragePath, setQrStoragePath] = useState("");
  const [qrPreview, setQrPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [daysBefore, setDaysBefore] = useState(3);
  const [versionId, setVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadQrPreview = useCallback(
    async (path: string) => {
      if (!user || !path) return;
      try {
        const qs = new URLSearchParams({ contractId: id, storagePath: path });
        const res = await fetch(`/api/contracts/payment-qr/download-url?${qs}`, { headers: { ...(await buildAuthHeaders(user)) } });
        const j = (await res.json()) as { success?: boolean; downloadUrl?: string };
        if (res.ok && j.success && j.downloadUrl) setQrPreview(j.downloadUrl);
      } catch {
        /* noop */
      }
    },
    [user, id],
  );

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/contracts/payment-settings?contractId=${encodeURIComponent(id)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; settings?: Record<string, unknown> };
      if (res.ok && j.success && j.settings) {
        const s = j.settings;
        setMethod((s.method as PaymentMethodKind) ?? "none");
        setBank(String(s.bank ?? ""));
        setAccountType((s.accountType as AccountType) ?? "ahorros");
        setAccountNumber(String(s.accountNumber ?? ""));
        setConsent(Boolean(s.consentAccepted));
        if (s.qrStoragePath) {
          setQrStoragePath(String(s.qrStoragePath));
          void loadQrPreview(String(s.qrStoragePath));
        }
      }
    } catch {
      /* noop */
    }
    // Versión actual (para auto-generar el calendario) y días de aviso vigentes.
    try {
      const lv = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`).then((r) => r.json());
      setVersionId(String(lv?.version?.id ?? lv?.contract?.currentVersionId ?? ""));
      const sch = await fetch(
        `/api/payments/schedule/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(lv?.version?.id ?? lv?.contract?.currentVersionId ?? "")}`,
      ).then((r) => r.json());
      const d = Number(sch?.reminderSettings?.defaultDaysBefore);
      if (Number.isFinite(d) && d > 0) setDaysBefore(d);
    } catch {
      /* noop */
    }
  }, [user, id, loadQrPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadQr(file: File) {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/contracts/payment-qr/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, filename: file.name, contentType: file.type || "image/png", sizeBytes: file.size }),
      });
      const j = (await res.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!res.ok || !j.success || !j.uploadUrl || !j.storagePath) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo preparar la subida del QR.");
        return;
      }
      const put = await fetch(j.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "image/png" }, body: file });
      if (!put.ok) {
        setMsg("No se pudo subir el QR.");
        return;
      }
      setQrStoragePath(j.storagePath);
      await loadQrPreview(j.storagePath);
      setMsg("QR subido. Recuerda guardar.");
    } catch {
      setMsg("Error de red al subir el QR.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const body: Record<string, unknown> = { contractId: id, method, consentAccepted: method === "none" ? false : consent };
      if (method === "account") {
        body.bank = bank;
        body.accountType = accountType;
        body.accountNumber = accountNumber;
      }
      if (method === "qr") body.qrStoragePath = qrStoragePath;
      const res = await fetch("/api/contracts/payment-settings", {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }

      // Auto-generar el calendario de pagos con las fechas del contrato + los
      // días de aviso. Así el dueño no tiene que generarlo a mano.
      if (versionId) {
        try {
          await fetch("/api/payments/schedule/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              leaseProcessId: id,
              contractId: id,
              contractVersionId: versionId,
              reminderSettings: { enabled: true, defaultDaysBefore: daysBefore },
            }),
          });
        } catch {
          /* el calendario se puede generar luego; no bloquea */
        }
      }
      setMsg("Listo. Guardamos tu método de pago y activamos los recordatorios automáticos al inquilino.");
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Adicionales</p>
        <h1 className="text-2xl font-bold">Pagos y recordatorios</h1>
        <p className="text-sm text-slate-600">
          El <strong>calendario de pagos se arma solo</strong> con las fechas de tu contrato. Aquí solo eliges{" "}
          <strong>cómo te paga el inquilino</strong> y con <strong>cuántos días de anticipación</strong> avisarle.
          ArriendoSeguro <strong>no recauda ni custodia tu dinero</strong>: solo recuerda y guarda la constancia.
        </p>
        <Link href={`/dashboard/contracts/${id}/adicionales`} className="text-sm text-violet-700 underline">
          ← Centro de adicionales
        </Link>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      <RequiresSavedContract id={id}>
      <section className="rounded-xl border border-slate-300 bg-white/95 p-4">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">¿Cómo te paga el inquilino?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Método de pago">
            {([
              { v: "account", label: "Cuenta bancaria" },
              { v: "qr", label: "Código QR" },
              { v: "none", label: "Ninguno" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={method === o.v}
                onClick={() => setMethod(o.v)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  method === o.v ? "border-violet-500 bg-violet-100/60 text-violet-800" : "border-slate-300 bg-white hover:border-violet-400"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        {method === "account" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Entidad bancaria</span>
              <input value={bank} onChange={(e) => setBank(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Ej. Bancolombia" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Tipo de cuenta</span>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-700">Número de cuenta</span>
              <input value={accountNumber} inputMode="numeric" onChange={(e) => setAccountNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Solo dígitos" />
            </label>
          </div>
        )}

        {method === "qr" && (
          <div className="mt-4 space-y-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Imagen del QR (PNG/JPG/WEBP)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(f); }} className="text-xs" />
            </label>
            {qrPreview && <img src={qrPreview} alt="QR de pago" className="h-40 w-40 rounded border border-slate-300 object-contain" />}
          </div>
        )}

        {method !== "none" && (
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
            <span>
              Autorizo que estos datos de pago se compartan con <strong>mi inquilino</strong> únicamente para
              facilitarle el pago del canon y se incluyan en los recordatorios. Entiendo que ArriendoSeguro no recauda
              ni custodia el dinero. Soy responsable de la veracidad de los datos.
            </span>
          </label>
        )}

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="text-sm font-medium text-slate-800">
            Avisar al inquilino con cuántos días de anticipación
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={daysBefore}
                onChange={(e) => setDaysBefore(Math.max(1, Math.min(30, Number(e.target.value) || 3)))}
                className="w-24 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
              <span className="text-xs text-slate-600">días antes de cada vencimiento (por defecto 3).</span>
            </div>
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Al guardar, el inquilino recibirá recordatorios automáticos (esos días antes y el día del vencimiento) con
            tu método de pago y un enlace para subir su soporte; tú confirmas cuando recibas el pago.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="mt-4 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar y activar recordatorios"}
        </button>
        {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
      </section>
      </RequiresSavedContract>
    </main>
  );
}
