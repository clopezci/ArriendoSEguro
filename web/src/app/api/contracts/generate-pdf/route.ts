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
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";
const MAX_JSON_BYTES = 16_000;

type ContractVersionDoc = {
  contractId: string;
  versionNumber?: number;
  html?: string;
  documentHash?: string;
  pdfUrl?: string;
};

/**
 * TODO(auth): validar sesión server-side y permisos por expediente.
 */
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

    const generatedAt = new Date().toISOString();
    const pdfBytes = await renderContractPdfFromHtml({
      html: version.html,
      contractId,
      contractVersionId,
      versionNumber: version.versionNumber ?? 1,
      documentHash: version.documentHash,
      generatedAt,
    });

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

    auditEvent("contract_pdf_generated", { contractId, contractVersionId });
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

