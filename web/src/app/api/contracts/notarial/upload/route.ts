import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { notarialUploadIdsSchema } from "@/domain/contracts/api-types";
import {
  buildNotarialAuthenticationAnnex,
  notarialAuthenticationAnnexId,
} from "@/domain/contracts/annexes/renderAnnex";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";
import { persistContractPdfAsset } from "@/domain/contracts/persistContractPdfAsset";
import { auditEvent } from "@/features/contracts/audit-server";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import {
  NOTARIAL_SHARES_COLLECTION,
  isNotarialShareUsable,
  type NotarialShareDoc,
} from "@/domain/contracts/notarialShare";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;

type UploadJson =
  | { success: true; annexId: string; pdfUrl: string | null; uploadedAt: string }
  | { success: false; errors: { field: string; message: string }[] };

export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<UploadJson>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const contractIdRaw = String(form.get("contractId") ?? "").trim();
    const contractVersionIdRaw = String(form.get("contractVersionId") ?? "").trim();
    const idsParsed = notarialUploadIdsSchema.safeParse({
      contractId: contractIdRaw,
      contractVersionId: contractVersionIdRaw,
    });
    if (!idsParsed.success) {
      return NextResponse.json<UploadJson>(
        {
          success: false,
          errors: idsParsed.error.issues.map((i) => ({ field: i.path.join(".") || "form", message: i.message })),
        },
        { status: 422 },
      );
    }
    const { contractId, contractVersionId } = idsParsed.data;
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json<UploadJson>(
        { success: false, errors: [{ field: "file", message: "Debes adjuntar un archivo PDF." }] },
        { status: 422 },
      );
    }

    const mime = (file.type ?? "").toLowerCase();
    if (mime && mime !== "application/pdf") {
      return NextResponse.json<UploadJson>(
        { success: false, errors: [{ field: "file", message: "Solo se acepta PDF (application/pdf)." }] },
        { status: 422 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json<UploadJson>(
        {
          success: false,
          errors: [{ field: "file", message: `El archivo supera el máximo de ${MAX_BYTES / 1024 / 1024} MB.` }],
        },
        { status: 413 },
      );
    }

    // Autorización: (a) por SESIÓN (parte del contrato) o (b) por ENLACE que el
    // dueño compartió con el inquilino (token). El token acota la subida a esta
    // misma versión del contrato.
    const shareToken = String(form.get("shareToken") ?? "").trim();
    let resolvedRole = "";
    let shareRef: FirebaseFirestore.DocumentReference | null = null;
    if (shareToken) {
      shareRef = firestore.collection(NOTARIAL_SHARES_COLLECTION).doc(shareToken);
      const shareSnap = await shareRef.get();
      const share = shareSnap.exists ? (shareSnap.data() as NotarialShareDoc) : null;
      if (!share || !isNotarialShareUsable(share, Date.now()) || share.contractId !== contractId || share.contractVersionId !== contractVersionId) {
        return NextResponse.json<UploadJson>(
          { success: false, errors: [{ field: "shareToken", message: "El enlace no es válido o ya venció." }] },
          { status: 403 },
        );
      }
      resolvedRole = share.role;
    } else {
      const participant = await requireContractParticipant(request, firestore, contractId, {
        kind: "by_version",
        contractVersionId,
      });
      if (!participant.ok) return participant.response;
      resolvedRole = participant.role;
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json<UploadJson>(
        { success: false, errors: [{ field: "file", message: "El archivo no parece un PDF válido." }] },
        { status: 422 },
      );
    }

    const versionRef = firestore.collection("contract_versions").doc(contractVersionId);
    const versionSnap = await versionRef.get();
    if (!versionSnap.exists) {
      return NextResponse.json<UploadJson>(
        { success: false, errors: [{ field: "contractVersionId", message: "Versión no encontrada." }] },
        { status: 404 },
      );
    }
    const version = versionSnap.data() as { contractId?: string; contractPayload?: ResidentialLeaseContractInput };
    if (version.contractId !== contractId) {
      return NextResponse.json<UploadJson>(
        { success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] },
        { status: 422 },
      );
    }

    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    const draftId = (contractSnap.data() as { draftId?: string } | undefined)?.draftId;
    const leaseProcessId = (draftId && String(draftId).trim()) || contractId;

    const uploadedAt = new Date().toISOString();
    const annexId = notarialAuthenticationAnnexId(contractId, contractVersionId);

    const annex = buildNotarialAuthenticationAnnex({
      contractId,
      contractVersionId,
      leaseProcessId,
      uploadedAtIso: uploadedAt,
      uploadedByRole: resolvedRole,
    });

    const persisted = await persistContractPdfAsset({
      pdfBytes: buf,
      storageObjectPath: `contracts/${contractId}/annexes/${annexId}.pdf`,
      annexFirestoreDocId: annexId,
    });

    await firestore.collection("contract_annexes").doc(annexId).set({
      ...annex,
      pdfUrl: persisted.pdfUrl,
      pdfStoragePath: persisted.pdfStoragePath,
      notarialSourceFilename: file.name.slice(0, 240),
      updatedAt: uploadedAt,
    });

    const prevPayload = (version.contractPayload ?? {}) as ResidentialLeaseContractInput;
    const mergedPayload: ResidentialLeaseContractInput = {
      ...prevPayload,
      notarization: {
        ...(prevPayload.notarization ?? {}),
        wantsNotarization: true,
        uploadedDocumentRef: persisted.pdfStoragePath,
        uploadedAt,
      },
    };

    await versionRef.set(
      {
        contractPayload: mergedPayload,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // Si vino por enlace compartido, deja rastro en el doc del enlace.
    if (shareRef) {
      await shareRef.set({ lastUploadedAnnexId: annexId, lastUploadedAt: uploadedAt }, { merge: true });
    }

    auditEvent("notarial_authentication_pdf_uploaded", {
      contractId,
      contractVersionId,
      role: resolvedRole,
      via: shareToken ? "share_link" : "session",
      annexId,
      approxBytes: buf.length,
    });

    return NextResponse.json<UploadJson>({
      success: true,
      annexId,
      pdfUrl: persisted.pdfUrl,
      uploadedAt,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("contracts/notarial/upload", err);
    return NextResponse.json<UploadJson>(
      { success: false, errors: [{ field: "server", message: "No se pudo guardar el PDF autenticado." }] },
      { status: 500 },
    );
  }
}
