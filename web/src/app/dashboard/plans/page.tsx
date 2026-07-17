"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { canSeeInternalDashboardTools } from "@/lib/dashboard/internal-tools";
import { useFreeTier } from "@/lib/useFreeTier";
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

type ActivePricing = {
  checkoutCop: number;
  listCompareCop: number;
  isPromo?: boolean;
  promoName?: string | null;
  promoMessage?: string | null;
};

type OrderLineItem = { code: string; label: string; amountCop: number };
type CartPreview = {
  lineItems: OrderLineItem[];
  totalCop: number;
  hasCostedClause: boolean;
};

export default function PlansPage() {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [orderId, setOrderId] = useState("");
  const [showRedirectConfirm, setShowRedirectConfirm] = useState(false);
  const [brebViaWompi, setBrebViaWompi] = useState(false);
  const [removingClause, setRemovingClause] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<ActivePricing | null>(null);
  const [leaseProcessId, setLeaseProcessId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartPreview | null>(null);
  const freeTier = useFreeTier();
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
        const j = (await res.json()) as {
          success?: boolean;
          checkoutCop?: number;
          listCompareCop?: number;
          isPromo?: boolean;
          promoName?: string | null;
          promoMessage?: string | null;
        };
        if (
          res.ok &&
          j.success &&
          typeof j.checkoutCop === "number" &&
          typeof j.listCompareCop === "number"
        ) {
          setPricing({
            checkoutCop: j.checkoutCop,
            listCompareCop: j.listCompareCop,
            isPromo: j.isPromo,
            promoName: j.promoName ?? null,
            promoMessage: j.promoMessage ?? null,
          });
        }
      } catch {
        /* respaldo: constantes locales */
      }
    })();
  }, []);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  // Carrito por contrato: si llegamos con `?contract=<id>`, mostramos el desglose
  // (Plan Plus + cláusula «Otra» si aplica) para ese expediente.
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const lease = new URLSearchParams(window.location.search).get("contract");
    if (!lease) return;
    setLeaseProcessId(lease);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/platform-payments/order-preview?leaseProcessId=${encodeURIComponent(lease)}`,
          { headers: { ...(await buildAuthHeaders(user)) } },
        );
        const j = (await res.json()) as {
          success?: boolean;
          lineItems?: OrderLineItem[];
          totalCop?: number;
          hasCostedClause?: boolean;
        };
        if (!cancelled && res.ok && j.success && Array.isArray(j.lineItems)) {
          setCart({
            lineItems: j.lineItems,
            totalCop: Number(j.totalCop) || 0,
            hasCostedClause: Boolean(j.hasCostedClause),
          });
        }
      } catch {
        /* sin red: se mostrará el precio simple del Plan Plus */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Retorno desde el Web Checkout de Wompi (`?order=<referencia>`). El webhook es
  // la fuente de verdad y otorga el acceso Plus; aquí solo reflejamos el estado:
  // sondeamos las entitlements unos segundos por si el webhook llega con retraso.
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("order") || params.get("mockOrder");
    if (!ref) return;
    // Contrato al que debemos DEVOLVER al usuario cuando el pago quede confirmado.
    const contract = params.get("contract");
    let cancelled = false;
    let attempts = 0;
    setMsg("Estamos confirmando tu pago. Esto puede tardar unos segundos…");
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      const res = await fetch("/api/access/entitlements/me", {
        headers: { ...(await buildAuthHeaders(user)) },
      }).catch(() => null);
      const data = res && res.ok ? ((await res.json()) as EntitlementsResponse) : null;
      if (data?.success) setEntitlements(data);
      if (data?.plusActive) {
        if (contract) {
          // Vuelve AUTOMÁTICAMENTE al paso donde iba (firma) para continuar.
          setMsg("¡Pago confirmado! Te llevamos de vuelta a tu contrato para continuar…");
          setTimeout(() => {
            if (!cancelled) window.location.href = `/dashboard/contracts/${encodeURIComponent(contract)}/preview?section=firma`;
          }, 1400);
        } else {
          setMsg("¡Pago confirmado! Tu Plan Plus ya está activo.");
        }
        return;
      }
      if (attempts >= 6) {
        setMsg(
          "Recibimos tu regreso del pago. Si ya pagaste y aún no ves el Plan Plus activo, espera un momento y actualiza esta página.",
        );
        return;
      }
      if (!cancelled) setTimeout(() => void tick(), 4000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  // Quitar la cláusula «Otra» en el último momento (antes de pagar): la borra del
  // contrato, cancela la revisión y evita el correo al abogado; luego recarga el
  // carrito para reflejar el nuevo total sin ese cargo.
  async function removeClause() {
    if (!user || !leaseProcessId) return;
    setRemovingClause(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/contracts/special-clause/remove", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: leaseProcessId }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) {
        setError(j.errors?.[0]?.message ?? "No se pudo quitar la cláusula.");
        return;
      }
      const pr = await fetch(`/api/platform-payments/order-preview?leaseProcessId=${encodeURIComponent(leaseProcessId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      const pj = (await pr.json()) as { success?: boolean; lineItems?: OrderLineItem[]; totalCop?: number; hasCostedClause?: boolean };
      if (pr.ok && pj.success && Array.isArray(pj.lineItems)) {
        setCart({ lineItems: pj.lineItems, totalCop: Number(pj.totalCop) || 0, hasCostedClause: Boolean(pj.hasCostedClause) });
      } else {
        setCart(null);
      }
      setMsg("Quitaste la cláusula personalizada. No se cobrará ni se enviará al abogado.");
    } catch {
      setError("Error de red al quitar la cláusula.");
    } finally {
      setRemovingClause(false);
    }
  }

  async function createPlusOrder(provider?: "breb") {
    if (!user) return;
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/platform-payments/create-order", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          planCode: "plus",
          ...(leaseProcessId ? { leaseProcessId } : {}),
          ...(provider ? { paymentProvider: provider } : {}),
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        orderId?: string;
        checkoutUrl?: string;
        errors?: { message: string }[];
      };
      if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message ?? "No se pudo crear orden.");
      setOrderId(data.orderId ?? "");
      const url = data.checkoutUrl ?? "";
      setCheckoutUrl(url);
      if (url) {
        if (provider === "breb") {
          // Bre-B usa nuestra propia página interna de QR/llave (mismo origen).
          window.location.href = url;
        } else {
          // En vez de dejar un enlace suelto abajo, mostramos la confirmación de
          // redirección al sitio externo de pago; al aceptar, redirige directo.
          setShowRedirectConfirm(true);
        }
      } else {
        setError("No recibimos el enlace de pago. Intenta de nuevo.");
      }
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
          {freeTier.enabled
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

      <div className={`grid gap-6 ${freeTier.enabled ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {freeTier.enabled && (
          <article className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
            <h2 className="text-xl font-semibold text-slate-900">{freeTier.label}</h2>
            <p className="mt-2 text-lg font-semibold text-slate-800">$0</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Sin costo</p>
            <p className="mt-2 text-sm text-slate-600">{freeTier.message}</p>
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
          {!referralDiscount.applied && pricing?.isPromo && pricing.promoMessage && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              🏷️ {pricing.promoMessage}
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">Precio de introducción por contrato: una <strong>fracción</strong> de lo que cuesta tu arriendo. Pago único, sin mensualidades.</p>
          <p className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            🎁 Tu <strong>segundo contrato puede ser GRATIS</strong> (con la firma incluida) si lo <strong>compartes con 3 personas y al menos 2 de ellas lo usan</strong> (crean su contrato).
          </p>
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
          {cart && cart.hasCostedClause && (
            <div className="mt-4 rounded-xl border border-violet-300 bg-violet-50/60 p-3 text-sm">
              <p className="mb-2 font-semibold text-slate-800">Tu carrito para este contrato</p>
              <ul className="space-y-1">
                {cart.lineItems.map((it) => (
                  <li key={it.code} className="flex items-center justify-between text-slate-700">
                    <span>{it.label}</span>
                    <span className="font-medium">{formatCopPlain(it.amountCop)} COP</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-violet-200 pt-2 text-slate-900">
                <span className="font-semibold">Total a pagar</span>
                <span className="text-base font-bold text-violet-700">{formatCopPlain(cart.totalCop)} COP</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Incluye la cláusula personalizada «Otra» que agregaste al contrato.
              </p>
              <button
                type="button"
                onClick={() => void removeClause()}
                disabled={removingClause}
                className="mt-2 text-xs font-semibold text-rose-600 underline disabled:opacity-50"
              >
                {removingClause ? "Quitando…" : "Quitar esta cláusula (mejor no la quiero)"}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => void createPlusOrder()}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-[#5646E5] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] hover:brightness-105 disabled:opacity-50"
          >
            {cart && cart.hasCostedClause
              ? `Pagar ${formatCopPlain(cart.totalCop)} COP`
              : "Activar Plan Plus"}
          </button>
          {process.env.NEXT_PUBLIC_BREB_ENABLED === "true" && (
            <button
              type="button"
              onClick={() => { setBrebViaWompi(true); void createPlusOrder(); }}
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <span aria-hidden="true">⚡</span> Pagar con Bre-B
            </button>
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
          <a
            href="/dashboard/aliados"
            className="mt-6 block w-full rounded-lg border border-violet-500 px-4 py-3 text-center text-sm font-semibold text-violet-700 hover:bg-violet-50"
          >
            Ver aliados disponibles
          </a>
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

      {/* Confirmación de redirección al sitio externo de pago (Wompi) */}
      {showRedirectConfirm && checkoutUrl && (
        <div role="dialog" aria-modal="true" aria-labelledby="pay-redirect-title" className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
          <button type="button" aria-label="Cancelar" className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => { setShowRedirectConfirm(false); setBrebViaWompi(false); }} />
          <div className="relative z-[101] w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(86,70,229,0.25)]">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-xl" aria-hidden="true">🔒</span>
              <h2 id="pay-redirect-title" className="text-lg font-black tracking-tight text-[#17151F]">Vas a un sitio de pago externo</h2>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Te llevaremos a <strong>Wompi</strong>, nuestra pasarela de pago segura, para completar tu compra.
              ArriendoSeguro <strong>no procesa ni guarda</strong> los datos de tu tarjeta. Al terminar, volverás
              automáticamente para continuar.
            </p>
            {brebViaWompi && (
              <p className="mt-2 rounded-xl border border-emerald-300 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800">
                ⚡ En la pasarela, elige <strong>Bre-B</strong> como método de pago para pagar al instante desde tu app bancaria.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowRedirectConfirm(false); setBrebViaWompi(false); }}
                className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = checkoutUrl; }}
                className="rounded-2xl bg-[#12B886] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:brightness-105 active:scale-95"
              >
                Ir al sitio de pago →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
