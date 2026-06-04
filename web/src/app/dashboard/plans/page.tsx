"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { canSeeInternalDashboardTools } from "@/lib/dashboard/internal-tools";
import { freeTierEnabled } from "@/lib/config";
import {
  CONTRACT_EARLY_BIRD_PRICE_COP,
  CONTRACT_LIST_PRICE_COP,
  formatCopPlain,
  PER_CONTRACT_PAYMENT_NOTICE,
} from "@/lib/product-pricing";
import { ReferralPanel } from "@/components/referrals/referral-panel";
import {
  referralDiscountedCheckoutCop,
  type ReferralStatus,
} from "@/domain/referrals/referrals";
import { useCallback, useEffect, useMemo, useState } from "react";

type EntitlementsResponse = {
  success: boolean;
  plusActive?: boolean;
  demoActive?: boolean;
  plusEntitlement?: { id: string; contractsUsed: number; maxContractsAllowed: number } | null;
  demoEntitlement?: { id: string } | null;
};

type ActivePricing = { checkoutCop: number; listCompareCop: number };

export default function PlansPage() {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<ActivePricing | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);
  const [referral, setReferral] = useState<{
    status: ReferralStatus | null;
    enabled: boolean;
    discountPercent: number;
  } | null>(null);
  const internal = canSeeInternalDashboardTools(user?.email ?? null);

  const baseCheckoutCop = pricing?.checkoutCop ?? CONTRACT_EARLY_BIRD_PRICE_COP;
  const listCompareCop = pricing?.listCompareCop ?? CONTRACT_LIST_PRICE_COP;

  // Descuento por referido aprobado (si el programa está habilitado).
  const referralDiscount = referral
    ? referralDiscountedCheckoutCop(
        baseCheckoutCop,
        { enabled: referral.enabled, discountPercent: referral.discountPercent },
        referral.status,
      )
    : { finalCop: baseCheckoutCop, applied: false, discountPercent: 0 };
  const checkoutCop = referralDiscount.finalCop;

  const pricingLine = useMemo(() => {
    if (checkoutCop < listCompareCop) {
      return {
        showStrikethrough: true as const,
        subtitle: "Precio promocional mientras aplique la configuración vigente.",
      };
    }
    return {
      showStrikethrough: false as const,
      subtitle: "Precio vigente en la plataforma (sin comparación con lista).",
    };
  }, [checkoutCop, listCompareCop]);

  const loadAccess = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/access/entitlements/me", {
      headers: { ...(await buildAuthHeaders(user)) },
    });
    const data = (await res.json()) as EntitlementsResponse;
    if (res.ok && data.success) setEntitlements(data);
  }, [user]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/platform-payments/active-pricing");
        const j = (await res.json()) as { success?: boolean; checkoutCop?: number; listCompareCop?: number };
        if (
          res.ok &&
          j.success &&
          typeof j.checkoutCop === "number" &&
          typeof j.listCompareCop === "number"
        ) {
          setPricing({ checkoutCop: j.checkoutCop, listCompareCop: j.listCompareCop });
        }
      } catch {
        /* respaldo: constantes locales */
      }
    })();
  }, []);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  // Estado de referido del usuario (para aplicar el descuento si está aprobado).
  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const res = await fetch("/api/referrals/me", { headers: { ...(await buildAuthHeaders(user)) } });
        const j = (await res.json()) as {
          success?: boolean;
          myReferralStatus?: ReferralStatus | null;
          program?: { enabled?: boolean; discountPercent?: number };
        };
        if (res.ok && j.success) {
          setReferral({
            status: j.myReferralStatus ?? null,
            enabled: Boolean(j.program?.enabled),
            discountPercent: Number(j.program?.discountPercent ?? 0),
          });
        }
      } catch {
        /* sin red: sin descuento */
      }
    })();
  }, [user]);

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
      setMsg("Orden creada. Completa el pago para activar Plan Plus.");
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
        emailDelivery?: "ok" | "failed" | "skipped";
        errors?: { message?: string }[];
      };
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message ?? "No se pudo activar Plan Plus de prueba.");
      }
      let line =
        data.status === "already_exists"
          ? "Ya tenías un Plan Plus activo disponible para pruebas."
          : "Plan Plus de prueba activado correctamente.";
      if (data.emailDelivery && data.emailDelivery !== "ok") {
        line +=
          " El correo de confirmación no salió bien; revisa el proveedor de correo del servidor si esperabas un mensaje en la bandeja.";
      }
      setMsg(line);
      await loadAccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error activando Plan Plus de prueba.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Planes</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          {freeTierEnabled
            ? "Generar tu contrato es gratis. Con Plan Plus desbloqueas la firma electrónica, el inventario, los pagos y todo el respaldo. El cobro es solo por uso de la plataforma; no procesamos ni depositamos tu canon."
            : "El cobro es solo por uso de la plataforma; no procesamos ni depositamos tu canon de arriendo."}
        </p>
      </header>

      {internal && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-amber-400/45 bg-amber-50 p-3 text-xs text-amber-800">
          <span className="font-medium text-amber-800">Interno:</span>
          <button
            type="button"
            onClick={() => void loadAccess()}
            className="rounded border border-amber-600/50 px-2 py-1 hover:bg-amber-50"
          >
            Actualizar estado
          </button>
          <button
            type="button"
            onClick={() => void activateManualPlusForCurrentUser()}
            disabled={loading || !user?.email}
            className="rounded border border-amber-600/50 px-2 py-1 hover:bg-amber-50"
          >
            Activar Plan Plus de prueba
          </button>
        </div>
      )}

      <ReferralPanel />

      {msg && (
        <p className="rounded border border-emerald-500/40 bg-emerald-900/20 p-2 text-sm text-emerald-700">{msg}</p>
      )}
      {error && (
        <p className="rounded border border-rose-600/40 bg-rose-900/20 p-2 text-sm text-rose-700">{error}</p>
      )}

      <div className={`grid gap-6 ${freeTierEnabled ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {freeTierEnabled && (
          <article className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
            <h2 className="text-xl font-semibold text-slate-900">Gratis</h2>
            <p className="mt-2 text-lg font-semibold text-slate-800">$0</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Sin costo</p>
            <p className="mt-2 text-sm text-slate-600">
              Crea e imprime tu contrato de arrendamiento. Sale con una marca discreta
              «arriendoseguro.app» y recomendaciones; es utilizable.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>Contrato de arrendamiento (generar e imprimir)</li>
              <li>Con o sin codeudor</li>
              <li>Guías y blog</li>
            </ul>
            <p className="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-800">
              La firma electrónica, el inventario, los pagos, las novedades, las alertas y la reputación se activan con
              Plan Plus.
            </p>
          </article>
        )}

        <article className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold text-slate-900">Plan Plus</h2>
          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            {referralDiscount.applied ? (
              <>
                <span className="text-sm text-slate-500 line-through">{formatCopPlain(baseCheckoutCop)} COP</span>
                <span className="text-lg font-semibold text-emerald-700">{formatCopPlain(checkoutCop)} COP</span>
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                  Referido -{referralDiscount.discountPercent}%
                </span>
              </>
            ) : pricingLine.showStrikethrough ? (
              <>
                <span className="text-sm text-slate-500 line-through">{formatCopPlain(listCompareCop)} COP</span>
                <span className="text-lg font-semibold text-violet-700">{formatCopPlain(checkoutCop)} COP</span>
              </>
            ) : (
              <span className="text-lg font-semibold text-violet-700">{formatCopPlain(checkoutCop)} COP</span>
            )}
          </p>
          <p className="mt-1 text-xs font-medium text-violet-800">
            {referralDiscount.applied
              ? "Descuento por referido aprobado aplicado a tu Plan Plus."
              : pricingLine.subtitle}
          </p>
          <p className="mt-2 text-sm text-slate-600">Pago único por contrato gestionado en la plataforma. Sin mensualidades.</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{PER_CONTRACT_PAYMENT_NOTICE}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>Contrato de arrendamiento</li>
            <li>Opción con o sin codeudor</li>
            <li>Firma electrónica simple</li>
            <li>Inventario guiado</li>
            <li>Acta de entrega</li>
            <li>Calendario de pagos</li>
            <li>Registro de pagos con soporte</li>
            <li>Recordatorios</li>
            <li>Anexos</li>
          </ul>
          <button
            type="button"
            onClick={() => void createPlusOrder()}
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] hover:bg-violet-500 disabled:opacity-50"
          >
            Activar Plan Plus
          </button>
          {checkoutUrl && (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-center text-sm text-sky-700 underline"
            >
              Ir al checkout seguro (externo)
            </a>
          )}
          {internal && process.env.NODE_ENV !== "production" && orderId && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void mockApproveOrder()}
                disabled={loading}
                className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-700"
              >
                Mock approve
              </button>
              <button
                type="button"
                onClick={() => void checkOrderStatus()}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800"
              >
                Consultar orden
              </button>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-300 bg-white/65 p-6 opacity-95 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
          <h2 className="text-xl font-semibold text-slate-900">Aliados (opcional)</h2>
          <p className="mt-2 text-sm font-medium uppercase tracking-wide text-slate-500">Servicios de terceros</p>
          <p className="mt-4 text-sm text-slate-600">
            No es un plan: son servicios de aliados con <strong>costo aparte</strong> que tú decides tomar según tu
            necesidad. Por ejemplo:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Seguro de arrendamiento</li>
            <li>Estudio de crédito</li>
            <li>Autenticación notarial</li>
            <li>Cobranza</li>
            <li>Asesoría jurídica</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Los presta y cobra directamente el aliado, bajo sus condiciones. Se habilitan progresivamente.
          </p>
          <button
            type="button"
            disabled
            className="mt-6 w-full cursor-not-allowed rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-500"
          >
            Próximamente
          </button>
        </article>
      </div>

      <div className="rounded-xl border border-slate-300 bg-slate-100/60 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Tu estado actual</p>
        <p className="mt-1">Plan Plus activo: {entitlements?.plusActive ? "Sí" : "No"}</p>
        <p>Modo demo activo: {entitlements?.demoActive ? "Sí" : "No"}</p>
        {entitlements?.plusEntitlement && (
          <p>
            Uso Plus: {entitlements.plusEntitlement.contractsUsed}/
            {entitlements.plusEntitlement.maxContractsAllowed}
          </p>
        )}
      </div>
    </section>
  );
}
