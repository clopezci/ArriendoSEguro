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
  const [payDay, setPayDay] = useState<number | null>(null);
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
      // Día de pago del canon definido en el contrato (para mostrar la relación
      // con los "días de aviso" y no confundir ambos números).
      const pd = Number(lv?.version?.contractPayload?.lease?.paymentDueDay);
      if (Number.isFinite(pd) && pd >= 1 && pd <= 31) setPayDay(pd);
      const sch = await fetch(
        `/api/payments/schedule/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(lv?.version?.id ?? lv?.contract?.currentVersionId ?? "")}`,
        { headers: { ...(await buildAuthHeaders(user)) } },
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
      // Vista previa INSTANTÁNEA con la imagen local (no depende de la URL firmada).
      try { setQrPreview(URL.createObjectURL(file)); } catch { /* noop */ }
      // Subida DIRECTA (proxy same-origin): sin PUT del navegador a Storage → sin
      // el "error de red"/CORS que dejaba el QR sin cargar.
      const q = new URLSearchParams({ contractId: id, filename: file.name || "qr.png", contentType: file.type || "image/png" });
      const res = await fetch(`/api/contracts/payment-qr/upload?${q.toString()}`, {
        method: "POST",
        headers: { "content-type": file.type || "image/png", ...(await buildAuthHeaders(user)) },
        body: file,
      });
      let j: { success?: boolean; storagePath?: string; errors?: { message?: string }[] } = {};
      try { j = (await res.json()) as typeof j; } catch { /* respuesta no-JSON */ }
      if (!res.ok || !j.success || !j.storagePath) {
        setMsg(j.errors?.[0]?.message ?? `No se pudo subir el QR (código ${res.status}).`);
        return;
      }
      setQrStoragePath(j.storagePath);
      setMsg("QR subido ✓. Recuerda guardar.");
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
            headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
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
    <div className="text-[#17151F]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/nuevo/gestionar/${id}/terminar`} className="flex items-center gap-2 text-sm font-semibold text-[#5646E5] hover:underline">← Volver</Link>
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
            <span className="mb-1 block text-sm text-slate-700">Imagen del QR (PNG/JPG/WEBP)</span>
            {/* Botón claro: el input nativo era un letrero diminuto que nadie
                identificaba como "elegir foto". */}
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#5646E5] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95 ${busy ? "cursor-not-allowed opacity-50" : ""}`}>
              {busy ? "Subiendo…" : qrPreview ? "📷 Cambiar foto del QR" : "📷 Elegir foto del QR"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQr(f); e.target.value = ""; }}
                className="sr-only"
              />
            </label>
            <p className="text-[11px] text-slate-500">Toma o elige una foto/captura de tu código QR de pago.</p>
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

        {payDay != null && (
          <div className="mt-4 rounded-2xl border border-[#5646E5]/20 bg-[#ECE9FB]/50 p-3 text-sm text-slate-700">
            📅 Según tu contrato, el inquilino paga el <strong>día {payDay}</strong> de cada mes. (Lo definiste en el paso de términos del contrato.)
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
              <span className="text-xs text-slate-600">días <strong>antes</strong> de cada vencimiento (no es el día de pago; por defecto 3).</span>
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

      <div className="mt-6 flex items-center justify-between gap-2">
        <Link href={`/nuevo/gestionar/${id}/terminar`} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5]">← Atrás</Link>
        <Link href={`/nuevo/gestionar/${id}/terminar`} className="rounded-2xl bg-[#FF6B4A] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 active:scale-95">Continuar →</Link>
      </div>
      </RequiresSavedContract>
      </div>
    </div>
  );
}
