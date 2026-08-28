import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { isWompiConfigured } from "@/domain/platform-payments/provider-factory";
import { findApprovedWompiTxByReference } from "@/domain/platform-payments/wompi-lookup";
import { settleApprovedPlatformOrder } from "@/domain/platform-payments/settle-order";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Barrido de RECONCILIACIÓN de órdenes que quedaron en "pending": red de
 * seguridad final por si el webhook de Wompi no llegó y el usuario tampoco
 * regresó a la página de retorno (cerró la pestaña, se le cortó, etc.). El
 * dinero YA está en Wompi; aquí solo sincronizamos nuestra base preguntándole a
 * Wompi por la referencia de cada orden pendiente y liquidando (idempotente) las
 * que estén APROBADAS. Nunca cobra ni mueve dinero: solo activa el acceso ya
 * pagado. Así ningún pago queda "perdido" aunque falle el webhook.
 *
 * Lo dispara el CRON diario (con CRON_SECRET) y también un admin interno a mano
 * (botón "Barrer órdenes pendientes" en /admin), para recuperar un caso al vuelo
 * sin tener que buscar el id de transacción en el panel de Wompi.
 */
const MAX_ORDERS = 40;
const MIN_AGE_MS = 2 * 60 * 1000; // <2 min: no tocar (evita carrera con el retorno del usuario)
const MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000; // >45 días: ignorar (checkout viejo abandonado)

async function isAuthorized(request: Request): Promise<boolean> {
  const gate = requireCronAuth(request);
  if (gate.ok) return true;
  const auth = await requireAuthenticatedUser(request);
  return auth.ok && (await isInternalAdminEmailAsync(auth.user.email));
}

async function sweep(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ success: false, errors: [{ field: "auth", message: "No autorizado." }] }, { status: 401 });
  }

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  if (!isWompiConfigured() || !(process.env.WOMPI_PRIVATE_KEY ?? "").trim()) {
    return NextResponse.json({ success: true, skipped: "wompi_no_configurado", checked: 0, settled: 0 });
  }

  const now = Date.now();
  let checked = 0;
  let settled = 0;
  let stillPending = 0;
  const settledIds: string[] = [];

  try {
    // Un solo filtro de igualdad (índice automático); el resto se filtra en memoria
    // para no exigir un índice compuesto.
    const snap = await firestore.collection("platform_orders").where("status", "==", "pending").limit(200).get();

    const candidates = snap.docs
      .map((d) => d.data() as { id: string; paymentProvider?: string; providerReference?: string; createdAt?: string })
      .filter((o) => (o.paymentProvider ?? "wompi") === "wompi" && Boolean(o.providerReference))
      .filter((o) => {
        const created = Date.parse(o.createdAt ?? "");
        if (!Number.isFinite(created)) return true; // sin fecha legible: revísala igual
        const age = now - created;
        return age >= MIN_AGE_MS && age <= MAX_AGE_MS;
      })
      .slice(0, MAX_ORDERS);

    for (const o of candidates) {
      checked += 1;
      try {
        const tx = await findApprovedWompiTxByReference(o.providerReference as string);
        if (!tx) {
          stillPending += 1;
          continue;
        }
        const result = await settleApprovedPlatformOrder(firestore, {
          provider: "wompi",
          providerReference: o.providerReference as string,
          providerPaymentId: tx.id,
          amountInCents: Number(tx.amount_in_cents ?? 0),
          currency: String(tx.currency ?? "COP"),
          method: String(tx.payment_method_type ?? "unknown"),
          rawEvent: JSON.stringify({ source: "sweep", tx }),
          nowMs: now,
        });
        const body = result.body as { status?: string; duplicated?: boolean };
        if (body?.status === "approved" || body?.duplicated) {
          settled += 1;
          settledIds.push(o.id);
        }
      } catch (err) {
        await logServerError("platform-payments/sweep-pending", err);
      }
    }

    if (settled > 0) {
      await auditPlatformPaymentEvent(firestore, "platform_payment_sweep_settled", {
        checked,
        settled,
        orderIds: settledIds.join(","),
      });
    }
    return NextResponse.json({ success: true, checked, settled, stillPending, settledIds });
  } catch (err) {
    await logServerError("platform-payments/sweep-pending", err);
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo barrer órdenes pendientes." }] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return sweep(request);
}
export async function GET(request: Request) {
  return sweep(request);
}
