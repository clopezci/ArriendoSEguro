import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  saveDraftVersionRequestSchema,
  type SaveDraftVersionResponse,
} from "@/domain/contracts/api-types";
import { validateContractData } from "@/domain/contracts/validateContractData";
import { generateDocumentHash } from "@/domain/contracts/hash";

export const runtime = "nodejs";
const MAX_JSON_BYTES = 256_000;

/**
 * TODO(auth): validar sesión del usuario y dueño/participante del expediente.
 * TODO(access): validar paid/demo server-side.
 */
export async function POST(request: Request) {
  try {
    const len = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(len) && len > MAX_JSON_BYTES) {
      return NextResponse.json<SaveDraftVersionResponse>(
        { success: false, errors: [{ field: "payload", message: "Solicitud demasiado grande." }] },
        { status: 413 },
      );
    }

    const raw = await request.text();
    if (raw.length > MAX_JSON_BYTES) {
      return NextResponse.json<SaveDraftVersionResponse>(
        { success: false, errors: [{ field: "payload", message: "Solicitud demasiado grande." }] },
        { status: 413 },
      );
    }

    const json = JSON.parse(raw) as unknown;
    const parsed = saveDraftVersionRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json<SaveDraftVersionResponse>(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 },
      );
    }

    const body = parsed.data;
    const validation = validateContractData(body.contractPayload);
    if (!validation.ok) {
      return NextResponse.json<SaveDraftVersionResponse>(
        { success: false, errors: validation.issues },
        { status: 422 },
      );
    }

    const recomputed = generateDocumentHash(body.html);
    if (recomputed !== body.documentHash) {
      return NextResponse.json<SaveDraftVersionResponse>(
        {
          success: false,
          errors: [{ field: "documentHash", message: "Hash no coincide con el HTML recibido." }],
        },
        { status: 422 },
      );
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<SaveDraftVersionResponse>(
        {
          success: false,
          errors: [
            {
              field: "server",
              message: "Firestore no configurado. No se puede guardar versión en este entorno.",
            },
          ],
        },
        { status: 503 },
      );
    }

    const now = new Date().toISOString();
    const contractRef = firestore.collection("contracts").doc(body.contractDraftId);
    const contractSnap = await contractRef.get();

    const contractId = contractRef.id;
    let versionNumber = 1;
    const contractVersionRef = firestore.collection("contract_versions").doc();

    if (!contractSnap.exists) {
      await contractRef.set({
        draftId: body.contractDraftId,
        status: "draft",
        hasSolidaryCoDebtor: body.hasSolidaryCoDebtor,
        currentVersionId: contractVersionRef.id,
        renewalReminderEnabled: body.renewalReminderEnabled ?? true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        generatedAt: body.generatedAt,
      });
    } else {
      const data = contractSnap.data() as { currentVersionNumber?: number } | undefined;
      versionNumber = (data?.currentVersionNumber ?? 0) + 1;
    }

    await contractVersionRef.set({
      contractId,
      contractDraftId: body.contractDraftId,
      versionNumber,
      html: body.html,
      contractPayload: body.contractPayload,
      documentHash: body.documentHash,
      hasSolidaryCoDebtor: body.hasSolidaryCoDebtor,
      generatedAt: body.generatedAt,
      status: "draft",
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: now,
      immutable: true,
    });

    await contractRef.set(
      {
        status: "draft",
        currentVersionId: contractVersionRef.id,
        currentVersionNumber: versionNumber,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // Placeholder auditoría
    if (process.env.NODE_ENV !== "production") {
      console.info("[audit] contract_draft_version_saved", {
        contractId,
        versionNumber,
        contractVersionId: contractVersionRef.id,
      });
    }

    return NextResponse.json<SaveDraftVersionResponse>({
      success: true,
      contractId,
      contractVersionId: contractVersionRef.id,
      versionNumber,
      documentHash: body.documentHash,
      status: "draft",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("contracts/save-draft-version error", error);
    }
    return NextResponse.json<SaveDraftVersionResponse>(
      {
        success: false,
        errors: [{ field: "server", message: "No se pudo guardar la versión contractual." }],
      },
      { status: 500 },
    );
  }
}

