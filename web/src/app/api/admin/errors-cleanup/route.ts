import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmail } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ERROR_EVENTS_COLLECTION } from "@/lib/observability/observability";
import { isBenignClientError } from "@/lib/observability/ignore-noise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Limpieza RETROACTIVA de `error_events`: borra los eventos cuyo mensaje HOY se
 * considera ruido benigno (`isBenignClientError`) pero que se registraron ANTES
 * de que existiera el filtro (extensiones cripto, Google Translate mutando el
 * DOM, webkit.messageHandlers de navegadores in-app, etc.). La ingesta ya los
 * descarta, así que no vuelven. Solo admin interno. Devuelve qué borró.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!isInternalAdminEmail(auth.user.email)) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "firestore no configurado" }, { status: 503 });
  }

  const snap = await firestore.collection(ERROR_EVENTS_COLLECTION).limit(1000).get();
  const removed: { message: string; count: number }[] = [];
  const kept: { message: string; count: number }[] = [];
  let batch = firestore.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    const d = doc.data() as { message?: string; count?: number };
    const message = String(d.message ?? "");
    if (isBenignClientError(message)) {
      batch.delete(doc.ref);
      pending += 1;
      removed.push({ message: message.slice(0, 160), count: Number(d.count) || 0 });
      if (pending >= 400) {
        await batch.commit();
        batch = firestore.batch();
        pending = 0;
      }
    } else {
      kept.push({ message: message.slice(0, 160), count: Number(d.count) || 0 });
    }
  }
  if (pending > 0) await batch.commit();

  return NextResponse.json({
    success: true,
    scanned: snap.size,
    removedCount: removed.length,
    removed,
    keptCount: kept.length,
    kept,
  });
}
