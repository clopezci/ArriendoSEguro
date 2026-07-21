"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Info = {
  success?: boolean;
  orderId?: string;
  amountCop?: number;
  status?: string;
  llave?: string;
  merchantName?: string;
  internalMode?: boolean;
  devSimulate?: boolean;
  adminConfirm?: boolean;
  error?: string;
};

export default function BrebPaymentPage() {
  const reference = String(useParams<{ reference: string }>().reference);
  const [redirect, setRedirect] = useState("/dashboard/plans");
  const { user, loading } = useAuth();

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("redirect");
    if (r) setRedirect(r);
  }, []);
  const [info, setInfo] = useState<Info | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/platform-payments/breb/info?reference=${encodeURIComponent(reference)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as Info;
      if (!res.ok || !j.success) {
        setError(j.error === "forbidden" ? "Esta orden no es tuya." : "No se pudo cargar la orden.");
        return;
      }
      setInfo(j);
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }, [reference, user]);

  useEffect(() => {
    void load();
  }, [load]);

  // QR con un payload representativo (llave · monto · referencia). El QR real
  // EMVCo lo entrega el proveedor cuando está integrado; aquí sirve para el pago
  // por llave/escaneo en modo interno.
  useEffect(() => {
    if (!info?.llave) return;
    void (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const payload = `BREB|llave:${info.llave}|monto:${info.amountCop}|ref:${reference}`;
        setQr(await QRCode.toDataURL(payload, { margin: 1, width: 240 }));
      } catch {
        setQr("");
      }
    })();
  }, [info?.llave, info?.amountCop, reference]);

  // Sondeo del estado: cuando la orden quede aprobada, volvemos al flujo.
  useEffect(() => {
    if (!user || !info?.orderId || paid) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/platform-payments/order-status?orderId=${encodeURIComponent(info.orderId!)}`, {
          headers: { ...(await buildAuthHeaders(user)) },
        });
        const j = (await res.json()) as { order?: { status?: string } };
        if (j.order?.status === "approved") {
          setPaid(true);
          setTimeout(() => { window.location.href = redirect; }, 1200);
          return;
        }
      } catch {
        /* reintenta */
      }
      if (!cancelled) setTimeout(() => void tick(), 4000);
    };
    const t = setTimeout(() => void tick(), 4000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [user, info?.orderId, paid, redirect]);

  async function simulatePaid() {
    if (!user || !info?.orderId) return;
    try {
      const res = await fetch("/api/platform-payments/mock-approve", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ orderId: info.orderId }),
      });
      if (res.ok) {
        setPaid(true);
        setTimeout(() => { window.location.href = redirect; }, 1000);
      }
    } catch {
      /* no-op */
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-5 p-6 text-slate-900">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Pago con Bre-B</p>
        <h1 className="text-2xl font-bold">Paga desde tu app bancaria</h1>
      </header>

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {!loading && !user && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Inicia sesión para ver esta orden de pago.
        </p>
      )}
      {error && <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {paid && (
        <p className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          ¡Pago confirmado! Te llevamos de vuelta…
        </p>
      )}

      {info?.success && !paid && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 text-center shadow-sm">
            <p className="text-sm text-slate-600">Vas a pagar a</p>
            <p className="text-lg font-bold text-[#17151F]">{info.merchantName}</p>
            <p className="mt-1 text-3xl font-black text-emerald-700">${(info.amountCop ?? 0).toLocaleString("es-CO")}</p>
            {info.llave ? (
              <p className="mt-2 text-sm text-slate-700">
                Llave Bre-B: <span className="font-mono font-bold">{info.llave}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-rose-600">Aún no hay una llave Bre-B configurada.</p>
            )}
            {qr && (
              <div className="mt-3 flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Código QR Bre-B" className="h-52 w-52" />
                <p className="text-[11px] text-slate-500">Escanea con tu app bancaria</p>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">Referencia: {reference}</p>
          </section>

          <ol className="list-decimal space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-4 pl-8 text-sm text-slate-700">
            <li>Abre la app de tu banco o billetera y entra a <strong>Bre-B</strong>.</li>
            <li>Escanea el QR, o paga a la <strong>llave</strong> de arriba por el valor exacto.</li>
            <li>Al confirmarse el pago, esta página te llevará de vuelta automáticamente.</li>
          </ol>

          {(info.devSimulate || info.adminConfirm) && (
            <button
              type="button"
              onClick={() => void simulatePaid()}
              className="w-full rounded-2xl border-2 border-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              {info.adminConfirm
                ? "Confirmar pago recibido (soy el comercio)"
                : "Simular pago aprobado (solo pruebas)"}
            </button>
          )}
          {info.adminConfirm && (
            <p className="text-center text-[11px] text-slate-500">
              Solo tú (comercio) ves este botón. Confírmalo cuando el pago Bre-B llegue a tu cuenta.
            </p>
          )}

          <p className="text-center text-[11px] text-slate-400">
            ArriendoSeguro no procesa ni custodia tu dinero; Bre-B mueve el pago directo entre cuentas.
          </p>
        </>
      )}
    </main>
  );
}
