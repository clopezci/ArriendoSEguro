import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  saveDraftVersionRequestSchema,
  type SaveDraftVersionResponse,
} from "@/domain/contracts/api-types";
import { validateContractData } from "@/domain/contracts/validateContractData";
import { generateDocumentHash } from "@/domain/contracts/hash";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";
const MAX_JSON_BYTES = 256_000;

/** Emails de las partes del payload (minúscula), para validar pertenencia. */
function payloadPartyEmails(payload: {
  landlord?: { email?: string };
  tenant?: { email?: string };
  solidaryCoDebtor?: { email?: string };
  solidaryCoDebtors?: { email?: string }[];
}): string[] {
  const list = [payload?.landlord?.email, payload?.tenant?.email, payload?.solidaryCoDebtor?.email];
  for (const c of payload?.solidaryCoDebtors ?? []) list.push(c?.email);
  return list.map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean);
}

export async function POST(request: Request) {
  try {
    // Autenticación: solo usuarios con sesión válida pueden guardar versiones.
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
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

    // Solvencia (ingreso ≥ canon), reforzada en el servidor. Los ingresos vienen
    // en `body.solvency` SOLO para validar y NO se persisten (no se escriben en
    // `contract_versions`). Si no vienen, no se fuerza aquí (el cliente ya bloquea).
    const rent = body.contractPayload.lease.monthlyRent;
    if (rent > 0 && body.solvency) {
      const solvencyIssues: { field: string; message: string }[] = [];
      const t = body.solvency.tenantMonthlyIncome;
      if (typeof t === "number" && t > 0 && t < rent) {
        solvencyIssues.push({ field: "tenant.income", message: "El ingreso del arrendatario es inferior al canon." });
      }
      (body.solvency.codebtorMonthlyIncomes ?? []).forEach((inc, i) => {
        if (typeof inc === "number" && inc > 0 && inc < rent) {
          solvencyIssues.push({ field: `codebtor.income[${i}]`, message: "El ingreso de un codeudor es inferior al canon." });
        }
      });
      if (solvencyIssues.length > 0) {
        return NextResponse.json<SaveDraftVersionResponse>(
          { success: false, errors: solvencyIssues },
          { status: 422 },
        );
      }
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
    const userEmail = auth.user.email.trim().toLowerCase();
    const contractRef = firestore.collection("contracts").doc(body.contractDraftId);
    const contractSnap = await contractRef.get();

    const contractId = contractRef.id;
    let versionNumber = 1;
    const contractVersionRef = firestore.collection("contract_versions").doc();

    if (!contractSnap.exists) {
      // Crear: cualquier usuario autenticado crea SU expediente; queda registrado
      // como dueño (`createdByUid`) para proteger futuras actualizaciones. No se
      // exige coincidencia de correo aquí (cubre apoderado/demo donde el correo
      // del creador puede no ser el del arrendador del contrato).
      await contractRef.set({
        draftId: body.contractDraftId,
        status: "draft",
        hasSolidaryCoDebtor: body.hasSolidaryCoDebtor,
        currentVersionId: contractVersionRef.id,
        renewalReminderEnabled: body.renewalReminderEnabled ?? true,
        createdByUid: auth.user.uid,
        createdByEmail: userEmail,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        generatedAt: body.generatedAt,
      });
    } else {
      // Actualizar: solo el creador (o, en expedientes legados sin creador
      // registrado, una parte del contrato) puede guardar una nueva versión.
      const data = contractSnap.data() as { currentVersionNumber?: number; createdByUid?: string } | undefined;
      const isCreator = data?.createdByUid && data.createdByUid === auth.user.uid;
      const isLegacyParticipant = !data?.createdByUid && payloadPartyEmails(body.contractPayload).includes(userEmail);
      if (!isCreator && !isLegacyParticipant) {
        return NextResponse.json<SaveDraftVersionResponse>(
          { success: false, errors: [{ field: "auth", message: "No autorizado para modificar este expediente." }] },
          { status: 403 },
        );
      }
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

