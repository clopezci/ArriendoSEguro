"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";
import { OathEvidenceBadge } from "@/components/contracts/oath-evidence-badge";
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
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#37D0E8,#3A7BFF)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#3FD98A,#12B886)" }} />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/nuevo/gestionar/${id}/terminar`} className="flex items-center gap-2 text-sm font-semibold text-[#5646E5] hover:underline">← Termina tu contrato</Link>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Condiciones de pago</span>
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-none tracking-tight">¿Cómo te paga el inquilino?</h1>
        <p className="mt-3 text-lg text-slate-500">
          El calendario se arma solo con las fechas del contrato. Aquí eliges el <b>método</b> y los <b>días de aviso</b>.
        </p>
        <p className="mt-2 rounded-2xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-600">
          🔒 ArriendoSeguro <strong>no recauda ni custodia tu dinero</strong>: solo le recuerda al inquilino y guarda la constancia.
        </p>

      <RequiresSavedContract id={id}>
      <section className="mt-6 rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-700">Método de pago</legend>
          <div className="mt-2 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Método de pago">
            {([
              { v: "account", label: "🏦 Cuenta bancaria" },
              { v: "qr", label: "📱 Código QR" },
              { v: "none", label: "Ninguno" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={method === o.v}
                onClick={() => setMethod(o.v)}
                className={`rounded-2xl border-2 px-4 py-2.5 text-sm font-medium transition ${
                  method === o.v ? "border-[#5646E5] bg-[#ECE9FB] text-[#5646E5]" : "border-slate-200 bg-white text-slate-700 hover:border-[#5646E5]"
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
              <input value={bank} onChange={(e) => setBank(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] px-3 py-2 text-sm" placeholder="Ej. Bancolombia" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Tipo de cuenta</span>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className="w-full rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] px-3 py-2 text-sm">
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-700">Número de cuenta</span>
              <input value={accountNumber} inputMode="numeric" onChange={(e) => setAccountNumber(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] px-3 py-2 text-sm" placeholder="Solo dígitos" />
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
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
              <span>
                <strong>Autorización para compartir tus datos de pago.</strong>
                {!consent && (
                  <>
                    {" "}Autorizo que estos datos de pago se compartan con <strong>mi inquilino</strong> únicamente para
                    facilitarle el pago del canon y se incluyan en los recordatorios. Entiendo que ArriendoSeguro no
                    recauda ni custodia el dinero. Soy responsable de la veracidad de los datos.
                  </>
                )}
              </span>
            </label>
            <OathEvidenceBadge active={consent} oathId="payment_data_sharing_consent" contractDraftId={id} />
          </div>
        )}

        <div className="mt-4 rounded-lg border border-slate-200 bg-white/75 p-3">
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
          className="mt-5 w-full rounded-2xl bg-[#5646E5] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar y activar recordatorios"}
        </button>
        {msg && <p className="mt-2 text-sm font-medium text-emerald-700">{msg}</p>}
      </section>

      <div className="mt-6 flex justify-end">
        <Link href={`/nuevo/gestionar/${id}/terminar`} className="rounded-2xl bg-[#FF6B4A] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 active:scale-95">Continuar →</Link>
      </div>
      </RequiresSavedContract>
      </div>
    </div>
  );
}
