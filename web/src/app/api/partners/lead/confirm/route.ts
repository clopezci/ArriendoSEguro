import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { PARTNER_LEADS_COLLECTION, deriveLeadOutcome, type LeadResponse } from "@/domain/partners/partners";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

function page(title: string, body: string, ok: boolean): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${title} · ArriendoSeguro</title>
    <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px}
    .c{max-width:420px;text-align:center;background:#fff;border:1px solid #cbd5e1;border-radius:18px;padding:28px}
    .b{width:48px;height:48px;margin:0 auto 14px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;background:${ok ? "#16a34a" : "#6d28d9"}}
    h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#475569;margin:0}</style></head>
    <body><div class="c"><div class="b">${ok ? "✓" : "ℹ"}</div><h1>${title}</h1><p>${body}</p></div></body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * Confirmación de resultado del referido (1 clic, sin login). El token define
 * quién confirma (aliado o usuario) y `outcome` el resultado. Cierra el ciclo
 * para el control de comisiones.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tok = url.searchParams.get("token") ?? "";
  const outcomeRaw = url.searchParams.get("outcome") ?? "";
  const outcome: LeadResponse | null = outcomeRaw === "taken" ? "taken" : outcomeRaw === "not_taken" ? "not_taken" : null;

  if (!tok || !outcome) return page("Enlace inválido", "El enlace de confirmación no es válido.", false);

  const firestore = getAdminFirestore();
  if (!firestore) return page("No disponible", "El servicio no está disponible en este momento.", false);

  // Buscar por token de aliado o de usuario.
  const [byPartner, byUser] = await Promise.all([
    firestore.collection(PARTNER_LEADS_COLLECTION).where("partnerToken", "==", tok).limit(1).get().catch(() => null),
    firestore.collection(PARTNER_LEADS_COLLECTION).where("userToken", "==", tok).limit(1).get().catch(() => null),
  ]);

  let role: "partner" | "user" | null = null;
  let docRef: FirebaseFirestore.DocumentReference | null = null;
  let data: Record<string, unknown> | null = null;
  if (byPartner && !byPartner.empty) {
    role = "partner";
    docRef = byPartner.docs[0].ref;
    data = byPartner.docs[0].data() as Record<string, unknown>;
  } else if (byUser && !byUser.empty) {
    role = "user";
    docRef = byUser.docs[0].ref;
    data = byUser.docs[0].data() as Record<string, unknown>;
  }

  if (!role || !docRef || !data) return page("Enlace no encontrado", "No encontramos esta solicitud. Es posible que ya haya expirado.", false);

  const field = role === "partner" ? "partnerResponse" : "userResponse";
  const now = new Date().toISOString();
  await docRef.set(
    {
      [field]: outcome,
      [`${field}At`]: now,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Estado derivado tras esta respuesta.
  const partnerResp = (role === "partner" ? outcome : (data.partnerResponse as LeadResponse | null)) ?? null;
  const userResp = (role === "user" ? outcome : (data.userResponse as LeadResponse | null)) ?? null;
  const derived = deriveLeadOutcome(partnerResp, userResp);
  await docRef.set({ status: derived.code }, { merge: true });

  auditEvent("partner_lead_confirmed", { role, outcome, status: derived.code });

  const taken = outcome === "taken";
  return page(
    taken ? "¡Gracias! Confirmado" : "Registrado",
    taken
      ? "Registramos que el servicio sí se tomó. ¡Gracias por confirmar!"
      : "Registramos que el servicio no se concretó. ¡Gracias por avisar!",
    true,
  );
}
