import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";
import { checkRateLimit, RATE_LIMIT_RULES, clientIpFromRequest } from "@/lib/security/rate-limit";
import { oneClickPage } from "@/lib/payments/oneClickPage";

export const runtime = "nodejs";

/**
 * El ARRENDADOR registra (1 clic, sin login) el "retraso y cobro personal" tras
 * agotar el protocolo de recordatorios. Detiene los recordatorios automáticos de
 * ese pago y deja constancia de que continúa el proceso por sus medios.
 */
export async function GET(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) return oneClickPage("Demasiadas solicitudes", "Espera un momento e inténtalo de nuevo.", false);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return oneClickPage("Enlace inválido", "El enlace no es válido.", false);
  const firestore = getAdminFirestore();
  if (!firestore) return oneClickPage("No disponible", "El servicio no está disponible ahora.", false);

  const snap = await firestore.collection("scheduled_payments").where("escPersonalCollectionToken", "==", token).limit(1).get().catch(() => null);
  if (!snap || snap.empty) return oneClickPage("Enlace no encontrado", "No encontramos este pago. Es posible que ya se haya registrado.", false);
  const docRef = snap.docs[0].ref;
  const now = new Date().toISOString();
  await docRef.set({ escPersonalCollectionAt: now, status: "late", updatedAt: now }, { merge: true });

  auditEvent("payment_personal_collection_registered", { contractId: (snap.docs[0].data() as { contractId?: string }).contractId ?? "" });
  return oneClickPage("Registrado", "Anotamos el retraso y el cobro personal. Detenemos los recordatorios automáticos de este pago; continúa el proceso por tus medios.", true);
}
