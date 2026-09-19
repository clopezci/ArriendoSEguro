import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { requiredParties, SIGNATURE_TOKEN_HOURS } from "@/domain/signatures/signatureRules";
import { generateSignatureToken } from "@/domain/signatures/generateSignatureToken";
import { sendSignatureEmail } from "@/features/signatures/sendSignatureEmail";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import type { SignaturePartyType } from "@/domain/signatures/types";
import { getContractLifecycle } from "@/lib/contracts/lifecycle";
import { CONTRACT_LIFECYCLE_COLLECTION } from "@/domain/contracts/contractLifecycle";
import { consumeCredit } from "@/lib/agencies/agencyStore";
import { CONTRACTS_COLLECTION, CONTRACT_VERSIONS_COLLECTION } from "@/lib/agencies/agencyContracts";

type PartyPerson = { fullName: string; email: string; documentType: string; documentNumber: string; phone?: string };
type Payload = {
  landlord: PartyPerson;
  tenant: PartyPerson;
  solidaryCoDebtor?: PartyPerson;
  solidaryCoDebtors?: PartyPerson[];
  hasSolidaryCoDebtor: boolean;
};

function codebtorsOf(p: Payload): PartyPerson[] {
  if (p.solidaryCoDebtors && p.solidaryCoDebtors.length > 0) return p.solidaryCoDebtors;
  if (p.hasSolidaryCoDebtor && p.solidaryCoDebtor) return [p.solidaryCoDebtor];
  return [];
}

function personForParty(p: Payload, party: SignaturePartyType): PartyPerson | null {
  if (party === "landlord") return p.landlord;
  if (party === "tenant") return p.tenant;
  const cods = codebtorsOf(p);
  const index = party === "solidaryCoDebtor" ? 0 : Number(party.slice("solidaryCoDebtor_".length)) - 1;
  return index >= 0 && index < cods.length ? cods[index] : null;
}

export type SendResult = {
  contractId: string;
  ok: boolean;
  sent?: number;
  creditConsumed?: boolean;
  error?: string;
};

/**
 * Envía la ronda de firma de UN contrato de agencia. A diferencia del flujo
 * normal, aquí TODAS las partes (incluido el arrendador) firman por enlace, y el
 * cobro es UN crédito de la agencia (idempotente por `contract_lifecycle`).
 *
 * Devuelve `error: "no_credits"` si no hay saldo (no envía nada). No lanza.
 */
export async function sendAgencySignaturesForContract(
  firestore: Firestore,
  agencyId: string,
  contractId: string,
  actorUid: string,
): Promise<SendResult> {
  try {
    const contractRef = firestore.collection(CONTRACTS_COLLECTION).doc(contractId);
    const contractSnap = await contractRef.get();
    const contract = contractSnap.exists ? (contractSnap.data() as Record<string, unknown>) : null;
    if (!contract || contract.agencyId !== agencyId) return { contractId, ok: false, error: "not_found" };
    if (contract.status === "signed") return { contractId, ok: false, error: "already_signed" };

    // Identidad: si se corrió una verificación y quedó REPROBADA, no se envía a
    // firma (protección antifraude). Si no hay verificación, no bloquea (Fase 1).
    const idCheck = contract.identityCheck as { approved?: boolean } | undefined;
    if (idCheck && idCheck.approved === false) return { contractId, ok: false, error: "identity_failed" };

    const versionId = (contract.currentVersionId as string) ?? "";
    const versionRef = firestore.collection(CONTRACT_VERSIONS_COLLECTION).doc(versionId);
    const versionSnap = await versionRef.get();
    const version = versionSnap.exists ? (versionSnap.data() as { documentHash?: string; contractPayload?: Payload }) : null;
    if (!version?.contractPayload || !version.documentHash) return { contractId, ok: false, error: "no_version" };

    // Cobro idempotente: 1 crédito por contrato. Si ya se consumó (o el contrato
    // ya se inició), no se vuelve a cobrar (permite reenviar sin doble cobro).
    const life = await getContractLifecycle(firestore, contractId);
    const alreadyPaid = life.entitlementConsumed === true || life.started === true || Boolean(life.unlockedByAdminAt);
    let creditConsumed = false;
    if (!alreadyPaid) {
      const res = await consumeCredit(firestore, agencyId);
      if (!res.ok) return { contractId, ok: false, error: "no_credits" };
      creditConsumed = true;
      const nowISO = new Date().toISOString();
      await firestore.collection(CONTRACT_LIFECYCLE_COLLECTION).doc(contractId).set(
        {
          contractId,
          started: true,
          startedAt: nowISO,
          startedByUid: actorUid,
          entitlementConsumed: true,
          entitlementVia: "agency_credit",
          agencyId,
          updatedAt: nowISO,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const payload = version.contractPayload;
    const parties = requiredParties(codebtorsOf(payload).length);
    const existing = await firestore.collection("signatures").where("contractId", "==", contractId).get();
    const byParty = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const d of existing.docs) {
      const key = (d.data() as { partyType?: string }).partyType ?? "";
      const arr = byParty.get(key) ?? [];
      arr.push(d);
      byParty.set(key, arr);
    }

    const now = new Date();
    let sent = 0;
    for (const party of parties) {
      const person = personForParty(payload, party);
      if (!person?.email) continue;

      const forParty = byParty.get(party) ?? [];
      const signed = forParty.find((d) => (d.data() as { signatureStatus?: string }).signatureStatus === "signed");
      if (signed) continue; // ya firmó: no reenviar

      const signatureRef = forParty[0]?.ref ?? firestore.collection("signatures").doc();
      const isReused = Boolean(forParty[0]);
      // Cancela duplicados no firmados de esta parte.
      await Promise.all(
        forParty.slice(1).map((d) => d.ref.set({ signatureStatus: "cancelled", updatedAt: now.toISOString() }, { merge: true })),
      );

      const { token, tokenHash } = generateSignatureToken(signatureRef.id);
      const tokenExpiresAt = new Date(now.getTime() + SIGNATURE_TOKEN_HOURS * 60 * 60 * 1000).toISOString();
      const sentAt = new Date().toISOString();
      const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/firma/${token}`;

      await signatureRef.set(
        {
          id: signatureRef.id,
          contractId,
          contractVersionId: versionId,
          leaseProcessId: contractId,
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
          viaAgency: agencyId,
          ...(isReused ? {} : { createdAt: sentAt }),
          updatedAt: sentAt,
        },
        { merge: true },
      );

      const emailResult = await sendSignatureEmail({
        to: person.email,
        signerName: person.fullName,
        partyType: party,
        signingUrl,
        tokenExpiresAt,
        contractId,
        useInviteTemplate: false,
        inviterName: payload.landlord.fullName,
      });
      if (emailResult.delivered) sent += 1;

      await sendPhoneNotice({
        to: (person.phone ?? "").trim(),
        message: `Ya puedes firmar tu contrato de arriendo en ArriendoSeguro. Fírmalo aquí: ${signingUrl}`,
        templateCode: "signatureWa",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
    }

    await Promise.all([
      contractRef.set({ status: "signature_in_progress", agencyStatus: "sent", updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      versionRef.set({ status: "ready_for_signature", signingRoundStartedAt: now.toISOString(), signingSnapshotDocumentHash: version.documentHash, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    ]);

    return { contractId, ok: true, sent, creditConsumed };
  } catch (err) {
    return { contractId, ok: false, error: err instanceof Error ? err.message : "send_failed" };
  }
}
