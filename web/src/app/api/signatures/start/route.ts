import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  startSignatureRequestSchema,
  type StartSignatureResponse,
} from "@/domain/contracts/api-types";
import { requiredParties, SIGNATURE_TOKEN_HOURS } from "@/domain/signatures/signatureRules";
import { generateSignatureToken } from "@/domain/signatures/generateSignatureToken";
import { sendSignatureEmail } from "@/features/signatures/sendSignatureEmail";
import { auditEvent } from "@/features/contracts/audit-server";
import type { SignaturePartyType } from "@/domain/signatures/types";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import {
  getAnyValidPlusEntitlementForUser,
  getAnyValidDemoEntitlementForUser,
} from "@/domain/platform-payments/entitlements";
import { freeTierEnabled } from "@/lib/config";

export const runtime = "nodejs";

type PartyPerson = { fullName: string; email: string; documentType: string; documentNumber: string };
type ContractVersionDoc = {
  contractId: string;
  contractPayload?: {
    landlord: PartyPerson;
    tenant: PartyPerson;
    solidaryCoDebtor?: PartyPerson;
    solidaryCoDebtors?: PartyPerson[];
    hasSolidaryCoDebtor: boolean;
  };
  documentHash?: string;
};

/** Lista efectiva de codeudores: prioriza la lista; cae al singular. */
function codebtorsOf(payload: NonNullable<ContractVersionDoc["contractPayload"]>): PartyPerson[] {
  if (payload.solidaryCoDebtors && payload.solidaryCoDebtors.length > 0) return payload.solidaryCoDebtors;
  if (payload.hasSolidaryCoDebtor && payload.solidaryCoDebtor) return [payload.solidaryCoDebtor];
  return [];
}

function personForParty(
  payload: NonNullable<ContractVersionDoc["contractPayload"]>,
  party: SignaturePartyType,
): PartyPerson | null {
  if (party === "landlord") return payload.landlord;
  if (party === "tenant") return payload.tenant;
  const codebtors = codebtorsOf(payload);
  // "solidaryCoDebtor" → índice 0; "solidaryCoDebtor_N" → índice N-1.
  const index = party === "solidaryCoDebtor" ? 0 : Number(party.slice("solidaryCoDebtor_".length)) - 1;
  return index >= 0 && index < codebtors.length ? codebtors[index] : null;
}

export async function POST(request: Request) {
  try {
    const parsed = startSignatureRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json<StartSignatureResponse>(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 422 },
      );
    }

    // Autenticación: se valida participante del contrato con requireContractParticipant más abajo.
    const { contractId, contractVersionId } = parsed.data;
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<StartSignatureResponse>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const contractRef = firestore.collection("contracts").doc(contractId);
    const versionRef = firestore.collection("contract_versions").doc(contractVersionId);
    const [contractSnap, versionSnap] = await Promise.all([contractRef.get(), versionRef.get()]);
    if (!contractSnap.exists) {
      return NextResponse.json<StartSignatureResponse>(
        { success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] },
        { status: 404 },
      );
    }
    if (!versionSnap.exists) {
      return NextResponse.json<StartSignatureResponse>(
        { success: false, errors: [{ field: "contractVersionId", message: "Versión no encontrada." }] },
        { status: 404 },
      );
    }

    const contract = contractSnap.data() as { status?: string; draftId?: string } | undefined;
    const version = versionSnap.data() as ContractVersionDoc | undefined;
    if (!version || version.contractId !== contractId) {
      return NextResponse.json<StartSignatureResponse>(
        { success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] },
        { status: 422 },
      );
    }
    if (contract?.status === "signed") {
      return NextResponse.json<StartSignatureResponse>(
        { success: false, errors: [{ field: "contract", message: "El contrato ya está firmado." }] },
        { status: 422 },
      );
    }
    if (!version.documentHash) {
      return NextResponse.json<StartSignatureResponse>(
        { success: false, errors: [{ field: "documentHash", message: "La versión no tiene hash documental." }] },
        { status: 422 },
      );
    }
    if (!version.contractPayload) {
      return NextResponse.json<StartSignatureResponse>(
        { success: false, errors: [{ field: "contractPayload", message: "La versión no tiene payload." }] },
        { status: 422 },
      );
    }

    // Autenticación: solo una parte del contrato puede iniciar la firma.
    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!participant.ok) return participant.response;

    // Gate de pago: con el tier gratis activo, la firma electrónica es Plus
    // (o demo). Un contrato gratis se genera, pero firmar requiere Plus.
    if (freeTierEnabled) {
      const [plus, demo] = await Promise.all([
        getAnyValidPlusEntitlementForUser(firestore, participant.user.uid),
        getAnyValidDemoEntitlementForUser(firestore, participant.user.uid),
      ]);
      if (!plus && !demo) {
        return NextResponse.json<StartSignatureResponse>(
          {
            success: false,
            errors: [
              {
                field: "plus_required",
                message:
                  "La firma electrónica con validez y evidencia (Ley 527) es parte de Plan Plus. Actívalo para firmar tu contrato y guardar los soportes.",
              },
            ],
          },
          { status: 402 },
        );
      }
    }

    const parties = requiredParties(codebtorsOf(version.contractPayload).length);
    const existingSignatures = await firestore
      .collection("signatures")
      .where("contractId", "==", contractId)
      .get();
    await Promise.all(
      existingSignatures.docs
        .filter((d) => {
          const row = d.data() as { contractVersionId?: string; signatureStatus?: string };
          return (
            row.contractVersionId !== contractVersionId &&
            (row.signatureStatus === "pending" || row.signatureStatus === "sent" || row.signatureStatus === "opened")
          );
        })
        .map((d) =>
          d.ref.set({ signatureStatus: "cancelled", updatedAt: new Date().toISOString() }, { merge: true }),
        ),
    );

    auditEvent("signature_round_started", { contractId, contractVersionId, parties: parties.length });
    const signatures: Array<{
      partyType: SignaturePartyType;
      signerEmail: string;
      signatureStatus: "sent";
      tokenExpiresAt: string;
      sentAt: string;
      emailMode: "real" | "mock" | "failed" | "skipped";
      signingUrl?: string;
    }> = [];
    const now = new Date();

    for (const party of parties) {
      const person = personForParty(version.contractPayload, party);
      if (!person) continue;
      const signatureRef = firestore.collection("signatures").doc();
      const { token, tokenHash } = generateSignatureToken(signatureRef.id);
      const tokenExpiresAt = new Date(now.getTime() + SIGNATURE_TOKEN_HOURS * 60 * 60 * 1000).toISOString();
      const sentAt = new Date().toISOString();
      const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/firma/${token}`;

      await signatureRef.set({
        id: signatureRef.id,
        contractId,
        contractVersionId,
        leaseProcessId: contract?.draftId ?? contractId,
        leasePartyId: `${contractId}:${party}`,
        partyType: party,
        signerName: person.fullName,
        signerEmail: person.email.trim().toLowerCase(),
        signerDocument: `${person.documentType} ${person.documentNumber}`,
        signatureStatus: "sent",
        signatureMethod: "email_link",
        tokenHash,
        tokenExpiresAt,
        consentAccepted: false,
        signedAt: null,
        ipAddress: null,
        userAgent: null,
        sentAt,
        documentHash: version.documentHash,
        evidenceJson: null,
        createdAt: sentAt,
        updatedAt: sentAt,
      });

      auditEvent("signature_request_created", { contractId, contractVersionId, partyType: party });
      const emailResult = await sendSignatureEmail({
        to: person.email,
        signerName: person.fullName,
        partyType: party,
        signingUrl,
        tokenExpiresAt,
        contractId,
        useInviteTemplate: party !== "landlord",
        inviterName: version.contractPayload.landlord.fullName,
      });
      auditEvent(emailResult.delivered ? "signature_email_sent" : "signature_email_failed", {
        contractId,
        partyType: party,
        mode: emailResult.mode,
      });

      signatures.push({
        partyType: party,
        signerEmail: person.email.trim().toLowerCase(),
        signatureStatus: "sent",
        tokenExpiresAt,
        sentAt,
        emailMode: emailResult.mode,
        // Modo prueba: si el correo no se entregó de verdad, devolvemos el enlace
        // para poder probar el flujo sin Resend. Con correo real NO se expone.
        ...(emailResult.mode === "real" ? {} : { signingUrl }),
      });
    }

    await Promise.all([
      contractRef.set(
        {
          status: "signature_in_progress",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      versionRef.set(
        {
          status: "ready_for_signature",
          signingRoundStartedAt: new Date().toISOString(),
          signingSnapshotDocumentHash: version.documentHash,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
    ]);

    return NextResponse.json<StartSignatureResponse>({ success: true, signatures });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("signatures/start error", error);
    return NextResponse.json<StartSignatureResponse>(
      { success: false, errors: [{ field: "server", message: "No se pudo iniciar la ronda de firma." }] },
      { status: 500 },
    );
  }
}

