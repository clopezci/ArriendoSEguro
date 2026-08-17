"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TenantPromoFooter } from "@/components/marketing/tenant-promo-footer";

type Info = {
  landlordName: string;
  periodLabel: string;
  dueDate: string;
  expectedAmount: number;
  method: "account" | "qr" | "none";
  qrUrl: string | null;
  account: { bank?: string; accountType?: string; accountNumber?: string } | null;
};

export default function PagoPublicoPage() {
  const token = String(useParams<{ token: string }>().token);
  const [state, setState] = useState<"loading" | "usable" | "expired" | "used" | "error" | "done">("loading");
  const [info, setInfo] = useState<Info | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pazBusy, setPazBusy] = useState(false);
  const [pazDone, setPazDone] = useState(false);

  async function requestPazYSalvo() {
    setPazBusy(true);
    try {
      const res = await fetch("/api/contracts/paz-y-salvo/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = (await res.json()) as { success?: boolean };
      setPazDone(Boolean(res.ok && j.success));
    } catch {
      /* silencioso */
    } finally {
      setPazBusy(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/upload/info?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = (await res.json()) as { success?: boolean; usable?: boolean; state?: string; info?: Info };
      if (!res.ok || !j.success) {
        setState("error");
        return;
      }
      if (!j.usable) {
        setState(j.state === "used" ? "used" : "expired");
        return;
      }
      setInfo(j.info ?? null);
      if (j.info) setAmount(String(j.info.expectedAmount || ""));
      setState("usable");
    } catch {
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!file) {
      setError("Adjunta la foto o PDF de tu comprobante.");
      return;
    }
    if (!paidDate) {
      setError("Indica la fecha en que pagaste.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // 1) Firma de subida. 2) PUT del archivo. 3) Confirmación.
      const signRes = await fetch("/api/payments/upload/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      const sign = (await signRes.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!signRes.ok || !sign.success || !sign.uploadUrl || !sign.storagePath) {
        setError(sign.errors?.[0]?.message ?? "No se pudo preparar la subida.");
        return;
      }
      const put = await fetch(sign.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) {
        setError("No se pudo subir el archivo. Revisa tu conexión.");
        return;
      }
      const subRes = await fetch("/api/payments/upload/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          storagePath: sign.storagePath,
          amountPaid: Number(amount.replace(/[^\d]/g, "")) || 0,
          paidDate,
          fileName: file.name,
        }),
      });
      const sub = (await subRes.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!subRes.ok || !sub.success) {
        setError(sub.errors?.[0]?.message ?? "No se pudo registrar el pago.");
        return;
      }
      setState("done");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-5">
      <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_12px_30px_rgba(109,40,217,0.12)]">
        <h1 className="text-lg font-bold text-slate-900">Pago de tu arriendo</h1>

        {state === "loading" && <p className="mt-2 text-sm text-slate-600">Cargando…</p>}
        {state === "error" && <p className="mt-2 text-sm text-rose-700">No pudimos cargar el enlace.</p>}
        {state === "expired" && <p className="mt-2 text-sm text-amber-800">Este enlace ya no está disponible o expiró. Pídele al arrendador uno nuevo.</p>}
        {state === "used" && <p className="mt-2 text-sm text-emerald-800">Este enlace ya se usó. ¡Gracias!</p>}

        {state === "done" && (
          <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            ¡Listo! Registramos tu pago y avisamos al arrendador para que lo confirme. Gracias.
          </div>
        )}

        {state === "usable" && info && (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Arrendador: <strong>{info.landlordName}</strong>
            </p>
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-sm text-slate-800">
              <p>
                Periodo: <strong>{info.periodLabel}</strong>
              </p>
              <p>Vence: {info.dueDate}</p>
              <p>
                Valor: <strong>${(info.expectedAmount || 0).toLocaleString("es-CO")}</strong>
              </p>
            </div>

            {info.method === "qr" && info.qrUrl && (
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-600">Escanea para pagar:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={info.qrUrl} alt="Código QR de pago" className="mx-auto mt-1 h-44 w-44 rounded border border-slate-300 object-contain" />
              </div>
            )}
            {info.method === "account" && info.account && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                <p className="text-xs text-slate-600">Paga a la cuenta:</p>
                <p className="font-medium">
                  {info.account.bank} · {info.account.accountType}
                </p>
                <p className="font-mono">{info.account.accountNumber}</p>
              </div>
            )}
            {info.method === "none" && (
              <p className="mt-3 text-xs text-slate-600">Acuerda el medio de pago directamente con tu arrendador.</p>
            )}

            {/* Aviso ANTIFRAUDE: el QR/cuenta los pone el arrendador; el inquilino
                debe verificar que correspondan al dueño antes de pagar. */}
            {(info.method === "qr" || info.method === "account") && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900">
                <p className="font-semibold">⚠️ Antes de pagar, verifica a quién le pagas</p>
                <p className="mt-0.5">
                  Confirma que {info.method === "qr" ? "el QR" : "la cuenta"} corresponda a{" "}
                  <strong>{info.landlordName || "el arrendador"}</strong>, el dueño del inmueble. Si tienes cualquier
                  duda, valídalo directamente con él/ella por un medio que ya conozcas antes de transferir.
                  ArriendoSeguro no genera ni administra estos datos: los registra el arrendador.
                </p>
              </div>
            )}

            <hr className="my-4 border-slate-200" />
            <p className="text-sm font-semibold text-slate-900">Sube tu comprobante</p>
            <div className="mt-2 space-y-3">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
                aria-label="Comprobante de pago"
              />
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Valor que pagaste (COP)</span>
                <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Fecha de pago</span>
                <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              {error && <p className="text-sm text-rose-700">{error}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Ya pagué — enviar soporte"}
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              ArriendoSeguro no recauda ni custodia tu dinero. Tu pago se confirma cuando el arrendador lo verifica.
            </p>

            {/* Cierre del arriendo: el inquilino solicita su paz y salvo + recomendación. */}
            <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
              <p className="text-xs font-semibold text-violet-900">¿Ya terminaste tu arriendo?</p>
              <p className="mt-0.5 text-[11px] text-slate-600">Pídele a tu arrendador tu <b>paz y salvo</b>, una <b>carta de recomendación</b> y el <b>acta de entrega y devolución</b>. Le llega el aviso con el enlace para generarlos.</p>
              {pazDone ? (
                <p className="mt-2 text-[11px] font-semibold text-emerald-700">✓ Solicitud enviada a tu arrendador.</p>
              ) : (
                <button type="button" onClick={() => void requestPazYSalvo()} disabled={pazBusy} className="mt-2 rounded-lg bg-[#5646E5] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  {pazBusy ? "Enviando…" : "Solicitar cierre del arriendo"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <TenantPromoFooter variant="landlord" />
    </main>
  );
}
