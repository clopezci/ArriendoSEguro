import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";
import { checkRateLimit, RATE_LIMIT_RULES, clientIpFromRequest } from "@/lib/security/rate-limit";
import { oneClickPage } from "@/lib/payments/oneClickPage";

export const runtime = "nodejs";

/**
 * El ARRENDADOR ACEPTA (1 clic, sin login) la conciliación registrada por el
 * inquilino. Detiene los recordatorios automáticos de ese pago.
 */
export async function GET(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) return oneClickPage("Demasiadas solicitudes", "Espera un momento e inténtalo de nuevo.", false);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return oneClickPage("Enlace inválido", "El enlace no es válido.", false);
  const firestore = getAdminFirestore();
  if (!firestore) return oneClickPage("No disponible", "El servicio no está disponible ahora.", false);

  const snap = await firestore.collection("scheduled_payments").where("escConciliationOwnerToken", "==", token).limit(1).get().catch(() => null);
  if (!snap || snap.empty) return oneClickPage("Enlace no encontrado", "No encontramos esta conciliación. Es posible que ya se haya procesado.", false);
  const docRef = snap.docs[0].ref;
  const now = new Date().toISOString();
  await docRef.set({ escConciliationStatus: "accepted", escConciliationAcceptedAt: now, updatedAt: now }, { merge: true });

  auditEvent("payment_conciliation_accepted", { contractId: (snap.docs[0].data() as { contractId?: string }).contractId ?? "" });
  return oneClickPage("Conciliación aceptada", "Pausamos los recordatorios automáticos de este pago. Gestiona el acuerdo con tu inquilino directamente.", true);
}
