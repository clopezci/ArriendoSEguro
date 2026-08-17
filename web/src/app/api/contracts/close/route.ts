import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant, requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

/** Días de gracia antes de purgar fotos+soportes de un contrato cerrado. */
const GRACE_DAYS = 7;
/** Años de custodia en la nube si el usuario la elige. */
const CLOUD_YEARS = 5;

type Choice = "download" | "cloud" | "undecided";

/**
 * Cierre DEFINITIVO del contrato (lo hace el arrendador). Registra la decisión de
 * conservación (descargar / nube / decidir luego), captura EVIDENCIA del
 * consentimiento y programa la purga de fotos+soportes a 7 días. NO borra nada
 * aquí (eso lo hace el cron de purga). Conserva siempre el contrato, la
 * recomendación, el historial y la calificación.
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { contractId?: string; choice?: Choice; consentAccepted?: boolean } | null;
    const contractId = body?.contractId?.trim() ?? "";
    const choice: Choice = body?.choice === "download" || body?.choice === "cloud" ? body.choice : "undecided";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });
    if (!body?.consentAccepted) return NextResponse.json({ success: false, errors: [{ field: "consent", message: "Debes aceptar las condiciones de cierre." }] }, { status: 422 });

    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!contractSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
    const contract = contractSnap.data() as { currentVersionId?: string } | undefined;
    const currentVersionId = contract?.currentVersionId ?? "";
    if (!currentVersionId) return NextResponse.json({ success: false, errors: [{ field: "version", message: "El contrato no tiene versión guardada." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;
    if (participant.role !== "landlord") {
      return NextResponse.json({ success: false, errors: [{ field: "role", message: "Solo el arrendador (dueño) puede cerrar el contrato." }] }, { status: 403 });
    }

    const now = new Date();
    const closedAt = now.toISOString();
    const purgeAt = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    const cloudUntil = new Date(now); cloudUntil.setUTCFullYear(cloudUntil.getUTCFullYear() + CLOUD_YEARS);

    const consentText =
      choice === "cloud"
        ? `Cierro el contrato y elijo CUSTODIA EN LA NUBE de ArriendoSeguro por ${CLOUD_YEARS} años. Entiendo que se conservan el contrato, la recomendación, el historial y la calificación.`
        : `Cierro el contrato. Entiendo que en ${GRACE_DAYS} días se eliminarán las fotos y soportes, que es mi responsabilidad haber descargado mi información, y eximo a ArriendoSeguro de responsabilidad por ello (Ley 1581 de 2012). Se conservan el contrato, la recomendación, el historial y la calificación.`;

    await contractSnap.ref.set(
      {
        status: "closed",
        closedAt,
        retentionChoice: choice,
        // Purga programada solo cuando NO se eligió nube (descargar o indeciso).
        purgeScheduledAt: choice === "cloud" ? null : purgeAt.toISOString(),
        purgedAt: null,
        cloudRetentionUntil: choice === "cloud" ? cloudUntil.toISOString() : null,
        closureRemindersSent: {},
        closureEvidence: {
          choice,
          consentText,
          acceptedAt: closedAt,
          byUid: participant.user.uid,
          byEmail: participant.user.email,
          ipAddress: requestClientIp(request) ?? "unknown",
          userAgent: requestUserAgent(request) ?? "unknown",
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    auditEvent("contract_closed", { contractId, choice, purgeScheduledAt: choice === "cloud" ? null : purgeAt.toISOString() });

    return NextResponse.json({
      success: true,
      status: "closed",
      choice,
      purgeScheduledAt: choice === "cloud" ? null : purgeAt.toISOString(),
      cloudRetentionUntil: choice === "cloud" ? cloudUntil.toISOString() : null,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("contracts/close", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cerrar el contrato." }] }, { status: 500 });
  }
}
