import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  generateContractPdfRequestSchema,
  type GenerateContractPdfResponse,
} from "@/domain/contracts/api-types";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";
import { auditEvent } from "@/features/contracts/audit-server";
import { formatAppDateTime } from "@/lib/datetime/appTime";
import { logServerError } from "@/lib/observability/observability";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { userHasPlusOrDemo } from "@/lib/auth/contractPlusGate";
import { getResolvedFreeTier } from "@/domain/platform-payments/free-tier";
import { applyFreeTierWatermark, type FreeTierCtaOptions } from "@/domain/contracts/freeTierWatermark";
import { getPlanPlusPricingForPublicPages } from "@/domain/platform-payments/plan-plus-pricing";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";
// El PDF se renderiza con pdf-lib (JS puro, sin navegador headless): es rápido
// (milisegundos para un contrato de texto). Damos headroom por si el contrato es
// muy largo o la subida a Storage tarda; muy por debajo del riesgo de timeout.
export const maxDuration = 60;
const MAX_JSON_BYTES = 16_000;

type ContractVersionDoc = {
  contractId: string;
  versionNumber?: number;
  html?: string;
  documentHash?: string;
  pdfUrl?: string;
};

/** Autenticación: valida participante del contrato (`requireContractParticipant`) más abajo. */
export async function POST(request: Request) {
  try {
    auditEvent("contract_pdf_generation_requested");
    const len = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(len) && len > MAX_JSON_BYTES) {
      return NextResponse.json<GenerateContractPdfResponse>(
        { success: false, errors: [{ field: "payload", message: "Solicitud demasiado grande." }] },
        { status: 413 },
      );
    }

    const raw = await request.text();
    if (raw.length > MAX_JSON_BYTES) {
      return NextResponse.json<GenerateContractPdfResponse>(
        { success: false, errors: [{ field: "payload", message: "Solicitud demasiado grande." }] },
        { status: 413 },
      );
    }

    const parsed = generateContractPdfRequestSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) {
      return NextResponse.json<GenerateContractPdfResponse>(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 422 },
      );
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<GenerateContractPdfResponse>(
        { success: false, errors: [{ field: "server", message: "Firestore no está configurado." }] },
        { status: 503 },
      );
    }

    const { contractId, contractVersionId } = parsed.data;
    const contractRef = firestore.collection("contracts").doc(contractId);
    const versionRef = firestore.collection("contract_versions").doc(contractVersionId);
    const [contractSnap, versionSnap] = await Promise.all([contractRef.get(), versionRef.get()]);

    if (!contractSnap.exists) {
      return NextResponse.json<GenerateContractPdfResponse>(
        { success: false, errors: [{ field: "contractId", message: "Contrato no existe." }] },
        { status: 404 },
      );
    }
    if (!versionSnap.exists) {
      return NextResponse.json<GenerateContractPdfResponse>(
        {
          success: false,
          errors: [{ field: "contractVersionId", message: "Versión contractual no existe." }],
        },
        { status: 404 },
      );
    }

    const version = versionSnap.data() as ContractVersionDoc | undefined;
    if (!version || version.contractId !== contractId) {
      return NextResponse.json<GenerateContractPdfResponse>(
        {
          success: false,
          errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }],
        },
        { status: 422 },
      );
    }
    if (!version.html || !version.documentHash) {
      return NextResponse.json<GenerateContractPdfResponse>(
        {
          success: false,
          errors: [{ field: "html", message: "La versión no tiene HTML o hash para PDF." }],
        },
        { status: 422 },
      );
    }

    // Autenticación (cierra hueco previo): solo una parte del contrato descarga.
    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!participant.ok) return participant.response;

    // La versión guardada es limpia. Si el usuario NO es Plus (tier gratis),
    // el PDF de descarga sale con marca de agua + CTA. Plus/demo lo descargan limpio.
    let htmlForPdf = version.html;
    if ((await getResolvedFreeTier(firestore)).enabled && !(await userHasPlusOrDemo(firestore, participant.user.uid))) {
      const payload = (versionSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)
        ?.contractPayload;
      const total =
        (Number(payload?.lease?.monthlyRent) || 0) * (Number(payload?.lease?.termMonths) || 0);
      let plusPriceCop = 0;
      try {
        plusPriceCop = Number((await getPlanPlusPricingForPublicPages(firestore)).checkoutCop) || 0;
      } catch {
        /* sin precio: el CTA usa el copy genérico */
      }
      const opts: FreeTierCtaOptions = { totalContractCop: total, plusPriceCop };
      htmlForPdf = applyFreeTierWatermark(version.html, opts);
    }

    const generatedAt = new Date().toISOString();

    // Sello INFORMATIVO del estado de firma: refleja en el PDF quién ha firmado
    // al momento de generarlo. NO cambia la validez ni el hash del documento: la
    // constancia con plena validez (fecha, IP, hash) es el Anexo de Evidencia.
    try {
      const sigSnap = await firestore
        .collection("signatures")
        .where("contractId", "==", contractId)
        .where("contractVersionId", "==", contractVersionId)
        .get();
      const byParty = new Map<string, { status: string; signedAt: string | null }>();
      sigSnap.docs.forEach((d) => {
        const s = d.data() as { partyType?: string; signatureStatus?: string; signedAt?: string };
        if (!s.partyType || s.signatureStatus === "cancelled") return;
        const cur = byParty.get(s.partyType);
        const better = !cur || (s.signatureStatus === "signed" && cur.status !== "signed");
        if (better) byParty.set(s.partyType, { status: s.signatureStatus ?? "", signedAt: s.signedAt ?? null });
      });
      const roleLabel = (t: string): string =>
        t === "landlord" ? "EL ARRENDADOR" : t === "tenant" ? "EL ARRENDATARIO" : t.startsWith("solidaryCoDebtor") ? "EL CODEUDOR SOLIDARIO" : t;
      const order = (t: string) => (t === "landlord" ? 0 : t === "tenant" ? 1 : 2);
      const parties = [...byParty.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
      if (parties.length > 0) {
        const rows = parties
          .map((t) => {
            const r = byParty.get(t)!;
            const estado =
              r.status === "signed"
                ? `Firmado electronicamente${r.signedAt ? " el " + formatAppDateTime(r.signedAt) : ""}`
                : "Pendiente de firma";
            return `<p>${roleLabel(t)}: ${estado}</p>`;
          })
          .join("");
        const stamp =
          `<h3>Estado de la firma electronica (informativo)</h3>` +
          `<p>Reflejo generado el ${formatAppDateTime(generatedAt)} (hora de Colombia, GMT-5). Este recuadro es solo informativo: la constancia con plena validez legal (fecha, IP y hash de cada firma) es el Anexo de Evidencia de Firma Electronica, que hace parte integral de este contrato (Ley 527 de 1999).</p>` +
          rows;
        const idx = htmlForPdf.lastIndexOf("</article>");
        htmlForPdf = idx >= 0 ? htmlForPdf.slice(0, idx) + stamp + htmlForPdf.slice(idx) : htmlForPdf.replace("</body>", stamp + "</body>");
      }
    } catch {
      /* si falla la consulta de firmas, el PDF sale sin el sello informativo */
    }

    const renderStartedAt = Date.now();
    const pdfBytes = await renderContractPdfFromHtml({
      html: htmlForPdf,
      contractId,
      contractVersionId,
      versionNumber: version.versionNumber ?? 1,
      documentHash: version.documentHash,
      generatedAt,
    });
    const renderMs = Date.now() - renderStartedAt;

    let pdfUrl = "";
    let pdfStoragePath = "";
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();

    if (bucketName) {
      const objectPath = `contracts/${contractId}/versions/${contractVersionId}.pdf`;
      const bucket = getStorage().bucket(bucketName);
      const file = bucket.file(objectPath);
      await file.save(Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        resumable: false,
        metadata: { cacheControl: "private,max-age=3600" },
      });
      const signed = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      });
      pdfUrl = signed[0] ?? "";
      pdfStoragePath = `gs://${bucketName}/${objectPath}`;
    } else {
      const localDir = path.join(process.cwd(), "tmp", "generated-pdfs");
      await mkdir(localDir, { recursive: true });
      const localPath = path.join(localDir, `${contractVersionId}.pdf`);
      await writeFile(localPath, Buffer.from(pdfBytes));
      pdfStoragePath = localPath;
      pdfUrl = `/api/contracts/pdf/${contractVersionId}`;
    }

    await versionRef.set(
      {
        pdfUrl,
        pdfStoragePath,
        pdfGeneratedAt: generatedAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await contractRef.set(
      {
        generatedPdfUrl: pdfUrl,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    auditEvent("contract_pdf_generated", { contractId, contractVersionId, renderMs, pdfBytes: pdfBytes.length });
    return NextResponse.json<GenerateContractPdfResponse>({
      success: true,
      pdfUrl,
      contractId,
      contractVersionId,
      versionNumber: version.versionNumber ?? 1,
      documentHash: version.documentHash,
      pdfGeneratedAt: generatedAt,
    });
  } catch (error) {
    auditEvent("contract_pdf_generation_failed");
    await logServerError("contracts/generate-pdf", error);
    console.error("contracts/generate-pdf error", error);
    const detail = error instanceof Error ? error.message : "";
    const exposeDetail = process.env.NODE_ENV !== "production" && detail.length > 0;
    const userMessage = exposeDetail
      ? `No se pudo generar el PDF del contrato (${detail}).`
      : "No se pudo generar el PDF del contrato. Inténtalo nuevamente; si persiste, escríbenos.";
    return NextResponse.json<GenerateContractPdfResponse>(
      {
        success: false,
        errors: [{ field: "server", message: userMessage }],
      },
      { status: 500 },
    );
  }
}

