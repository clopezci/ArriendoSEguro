import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico de correo (solo admin): últimos envíos registrados en `email_logs`
 * con su estado (`sent`/`failed`/`mock`), proveedor y mensaje de error. Sirve
 * para saber si un correo salió (Resend lo aceptó) o falló, sin entrar a Firestore.
 */
export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const snap = await firestore
    .collection("email_logs")
    .orderBy("createdAt", "desc")
    .limit(60)
    .get()
    .catch(() => null);

  const logs = (snap?.docs ?? []).map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      to: String(x.to ?? ""),
      subject: String(x.subject ?? ""),
      templateCode: String(x.templateCode ?? ""),
      provider: String(x.provider ?? ""),
      status: String(x.status ?? ""),
      relatedEntityType: x.relatedEntityType ? String(x.relatedEntityType) : null,
      relatedEntityId: x.relatedEntityId ? String(x.relatedEntityId) : null,
      errorMessage: x.errorMessage ? String(x.errorMessage) : null,
      createdAt: x.createdAt ? String(x.createdAt) : null,
    };
  });

  // Conteo rápido por estado (últimos 60) para un vistazo veloz.
  const summary = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ success: true, logs, summary });
}
