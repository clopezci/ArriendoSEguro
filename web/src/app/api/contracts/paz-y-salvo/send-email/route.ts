import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { sendEmail } from "@/services/email/sendEmail";
import { auditEvent } from "@/features/contracts/audit-server";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

/**
 * Envía por CORREO al inquilino (email registrado) el mismo texto del paz y salvo
 * y/o la recomendación que el dueño acaba de compartir por WhatsApp. El dueño es
 * el autor del texto; aquí solo lo hacemos llegar también por correo.
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { contractId?: string; label?: string; text?: string } | null;
    const contractId = body?.contractId?.trim() ?? "";
    const label = (body?.label ?? "documento").trim() || "documento";
    const text = (body?.text ?? "").trim();
    if (!contractId || !text) return NextResponse.json({ success: false, errors: [{ field: "input", message: "Faltan datos." }] }, { status: 422 });

    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    const currentVersionId = (contractSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId ?? "";
    if (!currentVersionId) return NextResponse.json({ success: false, errors: [{ field: "version", message: "El contrato no tiene versión guardada." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;

    const versionSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (versionSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const tenantEmail = (payload?.tenant?.email ?? "").trim();
    if (!tenantEmail) return NextResponse.json({ success: false, errors: [{ field: "email", message: "El inquilino no tiene correo registrado." }] }, { status: 422 });

    const subject = `Tu ${label} del arriendo`;
    const html = `<p>Tu arrendador te comparte tu <strong>${escapeHtml(label)}</strong>:</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;color:#0f172a;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">${escapeHtml(text)}</pre>`;
    const r = await sendEmail({
      to: tenantEmail,
      subject,
      html,
      text,
      templateCode: "pazYSalvoDoc",
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    });
    // Marca de "gestionado" para el chulo verde del hub.
    await contractSnap.ref.set({ pazYSalvoSentAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    auditEvent("paz_y_salvo_emailed", { contractId, label, delivery: r.status });
    return NextResponse.json({ success: true, delivery: r.status });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("paz-y-salvo/send-email", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo enviar el correo." }] }, { status: 500 });
  }
}
