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
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { auditEvent } from "@/features/contracts/audit-server";
import type { SignaturePartyType } from "@/domain/signatures/types";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import {
  getActivePlusEntitlementForUser,
  getActiveDemoEntitlementForUser,
} from "@/domain/platform-payments/entitlements";
import { getContractLifecycle } from "@/lib/contracts/lifecycle";
import { CONTRACT_LIFECYCLE_COLLECTION } from "@/domain/contracts/contractLifecycle";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import { unifiedInviteFlowEnabled } from "@/lib/config";
import { PARTY_INVITES_COLLECTION, isInviteOpenForUpload, normalizeEmail, type PartyInviteDoc } from "@/domain/party-invite/partyInvite";

/**
 * Rediseño #3 (flag): busca el token de la INVITACIÓN de datos de una parte, para
 * que el correo de firma apunte al MISMO enlace que ya usó (menos confusión). Solo
 * afecta la URL del correo; el registro de firma no cambia. Devuelve null si no hay
 * invitación (p. ej. el dueño escribió los datos) → se usa el enlace /firma normal.
 */
async function inviteInfoForParty(
  firestore: FirebaseFirestore.Firestore,
  contractId: string,
  party: SignaturePartyType,
  email: string,
): Promise<{ url: string | null; phone: string | null }> {
  const role = party === "tenant" ? "tenant" : party.startsWith("solidaryCoDebtor") ? "solidaryCoDebtor" : null;
  if (!role) return { url: null, phone: null };
  const slot = party === "solidaryCoDebtor" ? 0 : party.startsWith("solidaryCoDebtor_") ? Number(party.split("_")[1]) - 1 : 0;
  try {
    const snap = await firestore
      .collection(PARTY_INVITES_COLLECTION)
      .where("contractDraftId", "==", contractId)
      .where("role", "==", role)
      .get();
    // No exigimos que siga "abierta": tras completar/firmar puede cerrarse, pero
    // su `contribution.phone` sigue siendo el mejor teléfono conocido de la parte.
    const match = snap.docs
      .map((d) => d.data() as PartyInviteDoc)
      .find(
        (inv) =>
          normalizeEmail(inv.inviteeEmail) === normalizeEmail(email) &&
          (role === "tenant" || (inv.codebtorSlot ?? 0) === slot),
      );
    if (!match) return { url: null, phone: null };
    const now = Date.now();
    const url = isInviteOpenForUpload(match, now)
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invitacion/${match.token}`
      : null;
    const phone = (match.contribution?.phone ?? "").trim() || null;
    return { url, phone };
  } catch {
    return { url: null, phone: null };
  }
}

export const runtime = "nodejs";

type PartyPerson = { fullName: string; email: string; documentType: string; documentNumber: string; phone?: string };
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

    // Gate de pago POR CONTRATO. TODOS los contratos son de pago (el modelo
    // "generar gratis" es contexto viejo): firmar SIEMPRE consume un cupo Plus
    // del DUEÑO del contrato, UNA sola vez por contrato (idempotente vía
    // `contract_lifecycle`), sin depender del flag de free-tier. Antes (a) solo
    // se cobraba con el free-tier ENCENDIDO —así que apagarlo dejaba firmar
    // gratis— y (b) solo se comprobaba "¿tiene algún Plus?", y un Plus ya
    // consumido seguía contando, permitiendo firmar contratos ilimitados tras
    // pagar 1. El cupo lo aporta el creador del borrador, no quien inicia la
    // ronda (que puede ser el inquilino). Demo/tester y contrato-gratis-por-
    // referidos siguen funcionando (ambos otorgan un entitlement válido).
    {
      const life = await getContractLifecycle(firestore, contractId);
      const alreadyPaidForThisContract =
        life.entitlementConsumed === true || life.started === true || Boolean(life.unlockedByAdminAt);
      if (!alreadyPaidForThisContract) {
        const draftSnap = await firestore.collection("contract_drafts").doc(contractId).get();
        const ownerUid =
          (draftSnap.data() as { ownerUid?: string } | undefined)?.ownerUid ?? participant.user.uid;
        const lifecycleRef = firestore.collection(CONTRACT_LIFECYCLE_COLLECTION).doc(contractId);
        const nowISO = new Date().toISOString();

        const demo = await getActiveDemoEntitlementForUser(firestore, ownerUid);
        if (demo) {
          // Tester/demo: permite firmar y marca el contrato como consumido para
          // no volver a preguntar (sin bloquearlo como definitivo).
          await lifecycleRef.set(
            {
              contractId,
              entitlementConsumed: true,
              entitlementVia: "demo",
              updatedAt: nowISO,
              updatedAtServer: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        } else {
          const entitlement = await getActivePlusEntitlementForUser(firestore, ownerUid);
          if (!entitlement) {
            return NextResponse.json<StartSignatureResponse>(
              {
                success: false,
                errors: [
                  {
                    field: "plus_required",
                    message:
                      "Para firmar este contrato necesitas un cupo de Plan Plus. Cada contrato usa un cupo; el dueño debe activarlo en «Planes» antes de firmar.",
                  },
                ],
              },
              { status: 402 },
            );
          }
          const nextUsed = entitlement.contractsUsed + 1;
          const nextStatus = nextUsed >= entitlement.maxContractsAllowed ? "used" : "active";
          await firestore.collection("access_entitlements").doc(entitlement.id).set(
            { contractsUsed: nextUsed, status: nextStatus, updatedAt: nowISO, updatedAtServer: FieldValue.serverTimestamp() },
            { merge: true },
          );
          // Firmar deja el contrato en firme (consumido y bloqueado), como
          // "Iniciar contrato definitivo": cierra el abuso de pagar-borrar-rehacer.
          await lifecycleRef.set(
            {
              contractId,
              started: true,
              startedAt: nowISO,
              startedByUid: ownerUid,
              entitlementConsumed: true,
              entitlementVia: "signature_start",
              updatedAt: nowISO,
              updatedAtServer: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          await auditPlatformPaymentEvent(firestore, "access_entitlement_used", {
            entitlementId: entitlement.id,
            userId: ownerUid,
            contractsUsed: nextUsed,
            via: "signature_start",
          });
        }
      }
    }

    const parties = requiredParties(codebtorsOf(version.contractPayload).length);
    const existingSignatures = await firestore
      .collection("signatures")
      .where("contractId", "==", contractId)
      .get();
    const nowISO = new Date().toISOString();
    // Cancela pendientes de OTRAS versiones (el documento cambió).
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
          d.ref.set({ signatureStatus: "cancelled", updatedAt: nowISO }, { merge: true }),
        ),
    );

    // Idempotencia: agrupamos las firmas EXISTENTES de esta versión por parte.
    // Al reenviar, reutilizamos una fila por parte (regenerando el token) y
    // cancelamos los duplicados; a quien ya firmó no se le reenvía. Antes cada
    // clic creaba filas nuevas → "faltan 9 cuando solo son 3".
    type SigSnap = FirebaseFirestore.QueryDocumentSnapshot;
    const byParty = new Map<string, SigSnap[]>();
    for (const d of existingSignatures.docs) {
      const row = d.data() as { contractVersionId?: string };
      if (row.contractVersionId !== contractVersionId) continue;
      const arr = byParty.get((d.data() as { partyType?: string }).partyType ?? "") ?? [];
      arr.push(d);
      byParty.set((d.data() as { partyType?: string }).partyType ?? "", arr);
    }
    const recency = (d: SigSnap) => {
      const r = d.data() as { signedAt?: string; sentAt?: string; createdAt?: string };
      return r.signedAt ?? r.sentAt ?? r.createdAt ?? "";
    };

    auditEvent("signature_round_started", { contractId, contractVersionId, parties: parties.length });
    const signatures: Array<{
      partyType: SignaturePartyType;
      signerEmail: string;
      signatureStatus: "sent" | "signed";
      tokenExpiresAt: string;
      sentAt: string;
      emailMode: "real" | "mock" | "failed" | "skipped";
      signingUrl?: string;
    }> = [];
    const now = new Date();

    for (const party of parties) {
      const person = personForParty(version.contractPayload, party);
      if (!person) continue;

      const existingForParty = (byParty.get(party) ?? []).slice();
      const signedDoc = existingForParty.find(
        (d) => (d.data() as { signatureStatus?: string }).signatureStatus === "signed",
      );

      // Ya firmó: conservamos su firma, cancelamos duplicados y NO reenviamos.
      if (signedDoc) {
        await Promise.all(
          existingForParty
            .filter((d) => d.id !== signedDoc.id)
            .map((d) => d.ref.set({ signatureStatus: "cancelled", updatedAt: nowISO }, { merge: true })),
        );
        const row = signedDoc.data() as { signerEmail?: string; tokenExpiresAt?: string; signedAt?: string };
        signatures.push({
          partyType: party,
          signerEmail: row.signerEmail ?? person.email.trim().toLowerCase(),
          signatureStatus: "signed",
          tokenExpiresAt: row.tokenExpiresAt ?? nowISO,
          sentAt: row.signedAt ?? nowISO,
          emailMode: "skipped",
        });
        continue;
      }

      // No firmó: reutilizamos una fila (la más reciente) y cancelamos el resto.
      // Si no había ninguna, creamos una nueva.
      const sorted = existingForParty.sort((a, b) => (recency(b) > recency(a) ? 1 : -1));
      const signatureRef = sorted[0]?.ref ?? firestore.collection("signatures").doc();
      await Promise.all(
        sorted.slice(1).map((d) => d.ref.set({ signatureStatus: "cancelled", updatedAt: nowISO }, { merge: true })),
      );
      const isReused = Boolean(sorted[0]);
      const { token, tokenHash } = generateSignatureToken(signatureRef.id);
      const tokenExpiresAt = new Date(now.getTime() + SIGNATURE_TOKEN_HOURS * 60 * 60 * 1000).toISOString();
      const sentAt = new Date().toISOString();
      const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/firma/${token}`;

      await signatureRef.set(
        {
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
          ...(isReused ? {} : { createdAt: sentAt }),
          updatedAt: sentAt,
        },
        { merge: true },
      );

      auditEvent("signature_request_created", { contractId, contractVersionId, partyType: party });
      // Invitación de la contraparte (si la hubo): nos da (a) el MISMO enlace que
      // usó para completar datos —para que firme ahí, con el flag— y (b) su teléfono
      // completado (`contribution.phone`), respaldo por si el payload no lo trae.
      const inviteInfo =
        party !== "landlord"
          ? await inviteInfoForParty(firestore, contractId, party, person.email)
          : { url: null, phone: null };
      // Rediseño #3 (flag): la contraparte vuelve al MISMO enlace de invitación que
      // ya usó para completar datos; ahí firma. Si no hay invitación, va a /firma.
      const emailUrl = unifiedInviteFlowEnabled && inviteInfo.url ? inviteInfo.url : signingUrl;
      // Teléfono para el WhatsApp: el del contrato o, si falta, el de la invitación.
      const waPhone = (person.phone ?? "").trim() || inviteInfo.phone || "";
      // El ARRENDADOR (dueño) NO se invita a sí mismo: firma directo en la app
      // (endpoint signatures/sign-owner, identidad por sesión). Solo se invita por
      // correo/WhatsApp a las contrapartes (inquilino/codeudor).
      let emailMode: "real" | "mock" | "failed" | "skipped" = "skipped";
      if (party !== "landlord") {
        const emailResult = await sendSignatureEmail({
          to: person.email,
          signerName: person.fullName,
          partyType: party,
          signingUrl: emailUrl,
          tokenExpiresAt,
          contractId,
          // Este es el correo de la RONDA DE FIRMA: usa la plantilla de firma
          // (unificada: "completa lo que falte y firma en el mismo enlace"), NO la de
          // "solo completar datos" (que prometía otro correo y confundía). El enlace
          // ya apunta a /invitacion (flag) o /firma.
          useInviteTemplate: false,
          inviterName: version.contractPayload.landlord.fullName,
        });
        emailMode = emailResult.mode;
        auditEvent(emailResult.delivered ? "signature_email_sent" : "signature_email_failed", {
          contractId,
          partyType: party,
          mode: emailResult.mode,
        });
        // Refuerzo por WhatsApp del aviso "ya puedes firmar" (complemento del correo;
        // solo sale si el canal de WhatsApp está encendido). Best-effort. Sin SMS.
        await sendPhoneNotice({
          to: waPhone,
          message: `Ya puedes firmar tu contrato de arriendo en ArriendoSeguro. Fírmalo aquí: ${emailUrl}`,
          templateCode: "signatureWa",
          relatedEntityType: "contract",
          relatedEntityId: contractId,
        });
      } else {
        auditEvent("signature_owner_signs_in_app", { contractId, partyType: party });
      }

      signatures.push({
        partyType: party,
        signerEmail: person.email.trim().toLowerCase(),
        signatureStatus: "sent",
        tokenExpiresAt,
        sentAt,
        emailMode,
        // Modo prueba: si el correo no se entregó de verdad, devolvemos el enlace
        // para poder probar el flujo sin Resend. Con correo real NO se expone.
        // El dueño (emailMode "skipped") firma en la app, no necesita enlace.
        ...(emailMode === "real" || emailMode === "skipped" ? {} : { signingUrl }),
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

