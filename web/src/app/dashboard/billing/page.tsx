"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type EntitlementsResponse = {
  success: boolean;
  plusActive?: boolean;
  demoActive?: boolean;
  plusEntitlement?: { id: string; contractsUsed: number; maxContractsAllowed: number } | null;
  demoEntitlement?: { id: string } | null;
  errors?: { field: string; message: string }[];
};

export default function BillingPage() {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);
  const isLocalDev = process.env.NODE_ENV !== "production";
  const internalUiEnabled = isLocalDev || process.env.NEXT_PUBLIC_ADMIN_INTERNAL_ENABLED === "true";
  const internalAllowedEmails = (process.env.NEXT_PUBLIC_ADMIN_INTERNAL_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const canSeeInternalButton =
    internalUiEnabled &&
    (isLocalDev || (user?.email ? internalAllowedEmails.includes(user.email.toLowerCase()) : false));

  async function loadAccess() {
    if (!user) return;
    const res = await fetch("/api/access/entitlements/me", {
      headers: { ...(await buildAuthHeaders(user)) },
    });
    const data = (await res.json()) as EntitlementsResponse;
    if (res.ok && data.success) setEntitlements(data);
  }

  async function startDemo() {
    if (!user) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/access/demo/start", {
        method: "POST",
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const data = (await res.json()) as { success?: boolean; errors?: { message: string }[] };
      if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message ?? "No se pudo activar demo.");
      setMsg("Demo activado. Tus documentos demo deben llevar marca de agua de no validez.");
      await loadAccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al activar demo.");
    } finally {
      setLoading(false);
    }
  }

  async function createPlusOrder() {
    if (!user) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/platform-payments/create-order", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ planCode: "plus" }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        orderId?: string;
        checkoutUrl?: string;
        errors?: { message: string }[];
      };
      if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message ?? "No se pudo crear orden.");
      setOrderId(data.orderId ?? "");
      setCheckoutUrl(data.checkoutUrl ?? "");
      setMsg("Orden creada. Completa el checkout externo para activar Plan Plus.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear orden.");
    } finally {
      setLoading(false);
    }
  }

  async function mockApproveOrder() {
    if (!user || !orderId) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/platform-payments/mock-approve", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ orderId }),
      });
      const data = (await res.json()) as { success?: boolean; errors?: { message: string }[] };
      if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message ?? "No se pudo aprobar mock.");
      setMsg("Pago mock aprobado. Ya tienes Plan Plus activo para 1 expediente real.");
      await loadAccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en mock approve.");
    } finally {
      setLoading(false);
    }
  }

  async function checkOrderStatus() {
    if (!user || !orderId) return;
    const res = await fetch(`/api/platform-payments/order-status?orderId=${encodeURIComponent(orderId)}`, {
      headers: { ...(await buildAuthHeaders(user)) },
    });
    const data = (await res.json()) as {
      success?: boolean;
      order?: { status?: string };
      accessEntitlement?: { id?: string } | null;
      errors?: { message: string }[];
    };
    if (!res.ok || !data.success) {
      setError(data.errors?.[0]?.message ?? "No se pudo consultar estado.");
      return;
    }
    setMsg(
      `Estado orden: ${data.order?.status ?? "sin estado"}${data.accessEntitlement ? " · acceso plus activo" : ""}.`,
    );
    await loadAccess();
  }

  async function activateManualPlusForCurrentUser() {
    if (!user?.email) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/platform-payments/internal/grant-plus", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ email: user.email, validDays: 30 }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        status?: "created" | "already_exists";
        errors?: { message?: string }[];
      };
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message ?? "No se pudo activar Plan Plus de prueba.");
      }
      setMsg(
        data.status === "already_exists"
          ? "Ya tenías un Plan Plus activo disponible para pruebas."
          : "Plan Plus de prueba activado correctamente.",
      );
      await loadAccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error activando Plan Plus de prueba.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Facturación de Arriendo Seguro</h1>
      <p className="text-sm text-slate-300">
        Este módulo cobra solo el uso de la plataforma. No recauda ni procesa cánones de arriendo.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={loadAccess}
          className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-200"
        >
          Actualizar estado
        </button>
        {canSeeInternalButton && (
          <button
            type="button"
            onClick={activateManualPlusForCurrentUser}
            disabled={loading || !user?.email}
            className="rounded border border-amber-500 px-3 py-2 text-xs text-amber-200"
          >
            Activar Plan Plus de prueba
          </button>
        )}
      </div>

      {msg && <p className="rounded border border-emerald-600/40 bg-emerald-900/20 p-2 text-sm text-emerald-200">{msg}</p>}
      {error && <p className="rounded border border-rose-600/40 bg-rose-900/20 p-2 text-sm text-rose-200">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-lg font-semibold">Plan Básico Demo</h2>
          <p className="mt-1 text-violet-300">$0</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li>Explora cómo funciona.</li>
            <li>Documentos con marca de agua.</li>
            <li>No genera contratos reales.</li>
          </ul>
          <button
            type="button"
            onClick={startDemo}
            disabled={loading}
            className="mt-3 rounded bg-violet-600 px-3 py-2 text-sm text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
          >
            Probar demo
          </button>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-lg font-semibold">Plan Plus</h2>
          <p className="mt-1 text-violet-300">$39.900 COP</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li>Pago único por expediente.</li>
            <li>Sin mensualidades.</li>
            <li>Contrato, PDF, firma, inventario, acta, pagos y anexos.</li>
          </ul>
          <button
            type="button"
            onClick={createPlusOrder}
            disabled={loading}
            className="mt-3 rounded bg-violet-600 px-3 py-2 text-sm text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
          >
            Activar Plan Plus
          </button>
          {checkoutUrl && (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-sm text-sky-300 underline"
            >
              Ir a checkout externo
            </a>
          )}
          {process.env.NODE_ENV !== "production" && orderId && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={mockApproveOrder}
                disabled={loading}
                className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-200"
              >
                Mock approve
              </button>
              <button
                type="button"
                onClick={checkOrderStatus}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
              >
                Consultar orden
              </button>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-lg font-semibold">Plan Premium</h2>
          <p className="mt-1 text-violet-300">Próximamente</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li>Aliados para seguros y garantías.</li>
            <li>Cobranza y asesoría jurídica.</li>
            <li>Validaciones avanzadas.</li>
          </ul>
          <button
            type="button"
            disabled
            className="mt-3 cursor-not-allowed rounded border border-slate-700 px-3 py-2 text-sm text-slate-400"
          >
            Próximamente
          </button>
        </article>
      </div>

      <div className="rounded border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
        <p>Estado actual:</p>
        <p>- Demo activo: {entitlements?.demoActive ? "Sí" : "No"}</p>
        <p>- Plus activo: {entitlements?.plusActive ? "Sí" : "No"}</p>
        {entitlements?.plusEntitlement && (
          <p>
            - Uso Plus: {entitlements.plusEntitlement.contractsUsed}/{entitlements.plusEntitlement.maxContractsAllowed}
          </p>
        )}
      </div>
    </section>
  );
}

