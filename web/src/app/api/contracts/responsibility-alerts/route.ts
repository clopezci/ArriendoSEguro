import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { generateDocumentHash } from "@/domain/contracts/hash";
import {
  computeResponsibilitySignals,
  renderResponsibilityAlertsAnnexHtml,
  signalsForAudience,
  responsibilityIntro,
  type PropertyDocVerdict,
} from "@/domain/contracts/responsibilityAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Genera (o regenera) la "Constancia de alertas y responsabilidad" del contrato y
 * la CONGELA como anexo del expediente (colección `contract_annexes`, tipo
 * `responsibility_alerts`). Devuelve las señales para pintar el bloque del dueño.
 *
 * Los datos objetivos (nombres, dirección, canon) se leen de la versión firmable;
 * los del documento (adjunto/veredicto IA) y de ingresos vienen del flujo del
 * dueño, que ya los evaluó al revisar. Nunca bloquea; es evidencia orientativa.
 */
const schema = z.object({
  contractId: z.string().min(1),
  contractVersionId: z.string().min(1),
  actingAs: z.enum(["owner", "proxy"]).default("owner"),
  grantorName: z.string().max(160).optional(),
  hasPropertyDoc: z.boolean(),
  hasPoderDoc: z.boolean().default(false),
  propertyDocVerdict: z.enum(["match", "mismatch", "wrong_type", "unreadable", "skipped", "none"]).default("none"),
  aiAvailable: z.boolean().default(false),
  tenantIncomeCop: z.number().nonnegative().optional(),
  codebtorName: z.string().max(160).optional(),
  codebtorIncomeCop: z.number().nonnegative().optional(),
});

export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  const body = parsed.data;

  const participant = await requireContractParticipant(request, firestore, body.contractId, {
    kind: "by_version",
    contractVersionId: body.contractVersionId,
  });
  if (!participant.ok) return participant.response;

  const versionSnap = await firestore.collection("contract_versions").doc(body.contractVersionId).get();
  if (!versionSnap.exists) {
    return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "Versión no existe." }] }, { status: 404 });
  }
  const version = versionSnap.data() as {
    contractId?: string;
    versionNumber?: number;
    contractPayload?: {
      property?: { address?: string };
      landlord?: { fullName?: string };
      tenant?: { fullName?: string };
      lease?: { monthlyRent?: number };
    };
  } | undefined;
  if (version?.contractId !== body.contractId) {
    return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] }, { status: 422 });
  }

  const payload = version?.contractPayload ?? {};
  const landlordName = payload.landlord?.fullName ?? "";
  const tenantName = payload.tenant?.fullName ?? "";
  const propertyAddress = payload.property?.address ?? "";
  const canonCop = Number(payload.lease?.monthlyRent ?? 0) || 0;

  const signals = computeResponsibilitySignals({
    actingAs: body.actingAs,
    landlordName,
    grantorName: body.grantorName,
    propertyAddress,
    hasPropertyDoc: body.hasPropertyDoc,
    propertyDocVerdict: body.propertyDocVerdict as PropertyDocVerdict,
    aiAvailable: body.aiAvailable,
    hasPoderDoc: body.hasPoderDoc,
    canonCop,
    tenantName,
    tenantIncomeCop: body.tenantIncomeCop,
    codebtorName: body.codebtorName,
    codebtorIncomeCop: body.codebtorIncomeCop,
  });

  const now = new Date().toISOString();
  const html = renderResponsibilityAlertsAnnexHtml({
    contractId: body.contractId,
    contractVersionId: body.contractVersionId,
    propertyAddress,
    landlordName,
    tenantName,
    generatedAtIso: now,
    signals,
  });
  const documentHash = generateDocumentHash(html);
  const annexId = `annex_responsibility_${body.contractId}_${body.contractVersionId}`;

  await firestore.collection("contract_annexes").doc(annexId).set(
    {
      id: annexId,
      contractId: body.contractId,
      contractVersionId: body.contractVersionId,
      leaseProcessId: body.contractId,
      annexType: "responsibility_alerts",
      title: "Anexo — Constancia de alertas y responsabilidad",
      status: "generated",
      htmlContent: html,
      signalsJson: JSON.stringify(signals),
      pdfUrl: null,
      documentHash,
      createdAt: now,
      updatedAt: now,
      generatedAt: now,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  auditEvent("responsibility_alerts_generated", {
    contractId: body.contractId,
    contractVersionId: body.contractVersionId,
    signals: signals.length,
  });

  return NextResponse.json({
    success: true,
    intro: responsibilityIntro("owner"),
    signals: signalsForAudience(signals, "owner"),
    generatedAt: now,
  });
}
