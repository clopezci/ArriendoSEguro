import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { requiredDocLabel } from "@/domain/party-invite/requiredDocs";
import { PARTY_INVITES_COLLECTION, isInviteOpenForUpload, type PartyInviteDoc } from "@/domain/party-invite/partyInvite";
import { PARTY_INVITE_SUPPORTS_COLLECTION } from "@/domain/party-invite/inviteSupports";
import type { ResidentialLeaseContractInput, PersonParty } from "@/domain/contracts/types";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reconciliación de "Soportes de ingresos": cruza, por cada parte
 * (inquilino/codeudor), lo que el dueño EXIGIÓ (`party_invites.requiredDocs`), lo
 * que YA SE SUBIÓ por el enlace (`party_invite_supports`, por `docKey`) y lo que
 * el dueño ya VALIDÓ manualmente (`document_manual_reviews`, key `support:{id}`).
 * Así la página deja de mostrar todo "pendiente" y refleja el estado real.
 */
type UploadedDoc = { id: string; docKey?: string; fileName: string };

function personSlots(payload: ResidentialLeaseContractInput | undefined): Array<{ role: "tenant" | "solidaryCoDebtor"; slot: number | null; person?: PersonParty }> {
  const out: Array<{ role: "tenant" | "solidaryCoDebtor"; slot: number | null; person?: PersonParty }> = [];
  out.push({ role: "tenant", slot: null, person: payload?.tenant });
  const many = payload?.solidaryCoDebtors ?? [];
  if (many.length > 0) {
    many.forEach((p, i) => out.push({ role: "solidaryCoDebtor", slot: i, person: p }));
  } else if (payload?.solidaryCoDebtor) {
    out.push({ role: "solidaryCoDebtor", slot: 0, person: payload.solidaryCoDebtor });
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const contractId = new URL(request.url).searchParams.get("contractId")?.trim() ?? "";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!contractSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
    const contract = contractSnap.data() as { currentVersionId?: string; draftId?: string } | undefined;
    const currentVersionId = contract?.currentVersionId ?? "";
    if (!currentVersionId) return NextResponse.json({ success: false, errors: [{ field: "version", message: "El contrato no tiene versión guardada." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;
    const isOwner = participant.role === "landlord";

    const draftId = (contract?.draftId && String(contract.draftId).trim()) || contractId;
    const versionSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (versionSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;

    // Invitaciones del borrador (traen requiredDocs, teléfono y token del enlace).
    const invitesSnap = await firestore.collection(PARTY_INVITES_COLLECTION).where("contractDraftId", "==", draftId).limit(30).get().catch(() => null);
    const invites = (invitesSnap?.docs ?? []).map((d) => d.data() as PartyInviteDoc);
    const inviteFor = (role: string, slot: number | null): PartyInviteDoc | undefined => {
      const wanted = role === "tenant" ? 0 : slot ?? 0;
      return invites.find((iv) => iv.role === role && (iv.codebtorSlot ?? 0) === wanted);
    };

    // Documentos subidos por enlace (todos los del borrador).
    const supSnap = await firestore.collection(PARTY_INVITE_SUPPORTS_COLLECTION).where("contractDraftId", "==", draftId).limit(200).get().catch(() => null);
    const uploadsByKey = new Map<string, UploadedDoc[]>(); // `${role}:${slot}` -> docs
    for (const d of supSnap?.docs ?? []) {
      const x = d.data() as { id?: string; role?: string; codebtorSlot?: number; docKey?: string; fileName?: string };
      const k = `${x.role ?? ""}:${x.role === "tenant" ? 0 : x.codebtorSlot ?? 0}`;
      const arr = uploadsByKey.get(k) ?? [];
      arr.push({ id: x.id ?? d.id, docKey: x.docKey, fileName: x.fileName ?? "documento" });
      uploadsByKey.set(k, arr);
    }

    // Validaciones manuales del dueño (scope = draftId, key = `support:{id}`).
    const revSnap = await firestore.collection("document_manual_reviews").where("scope", "==", draftId).limit(500).get().catch(() => null);
    const reviewedKeys = new Set(
      (revSnap?.docs ?? [])
        .map((d) => d.data() as { key?: string; reviewed?: boolean })
        .filter((r) => r.reviewed !== false && typeof r.key === "string")
        .map((r) => r.key as string),
    );
    const isValidated = (supportId: string) => reviewedKeys.has(`support:${supportId}`);

    const base = appConfig.publicUrl.replace(/\/$/, "");
    const parties = personSlots(payload).map((slotDef) => {
      const inv = inviteFor(slotDef.role, slotDef.slot);
      const required = (inv?.requiredDocs ?? []).map((key) => ({ key, label: requiredDocLabel(key) }));
      const k = `${slotDef.role}:${slotDef.role === "tenant" ? 0 : slotDef.slot ?? 0}`;
      const uploaded = uploadsByKey.get(k) ?? [];
      const usedIds = new Set<string>();
      const requiredDocs = required.map((rd) => {
        const hit = uploaded.find((u) => u.docKey === rd.key && !usedIds.has(u.id));
        if (hit) usedIds.add(hit.id);
        return {
          key: rd.key,
          label: rd.label,
          uploaded: Boolean(hit),
          validated: hit ? isValidated(hit.id) : false,
          supportId: hit?.id ?? null,
          fileName: hit?.fileName ?? "",
        };
      });
      // Subidos que NO corresponden a un exigido (adicionales / "no exigidos").
      const extras = uploaded
        .filter((u) => !usedIds.has(u.id))
        .map((u) => ({ id: u.id, fileName: u.fileName, validated: isValidated(u.id), docLabel: u.docKey ? requiredDocLabel(u.docKey) : "" }));
      const pendingCount = requiredDocs.filter((d) => !d.uploaded).length;
      const inviteUrl = inv && isInviteOpenForUpload(inv, Date.now()) ? `${base}/invitacion/${inv.token}` : null;
      return {
        role: slotDef.role,
        slot: slotDef.slot,
        name: (slotDef.person?.fullName ?? "").trim(),
        email: (slotDef.person?.email ?? inv?.inviteeEmail ?? "").trim(),
        phone: isOwner ? (slotDef.person?.phone ?? inv?.contribution?.phone ?? "").trim() : "",
        requiredDocs,
        extras,
        pendingCount,
        requiredTotal: requiredDocs.length,
        allRequiredPresent: requiredDocs.length > 0 && pendingCount === 0,
        inviteUrl,
        inviteExpired: Boolean(inv) && !inviteUrl,
      };
    });

    return NextResponse.json({ success: true, draftId, viewerRole: participant.role, parties });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("party-invite/support/reconcile", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo reconciliar los soportes." }] }, { status: 500 });
  }
}
