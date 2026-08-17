import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";
import { appConfig } from "@/lib/config";
import { PARTY_INVITE_SUPPORTS_COLLECTION } from "@/domain/party-invite/inviteSupports";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron: sobre contratos CERRADOS, (a) recuerda al dueño en la ventana de gracia
 * si aún no eligió, y (b) pasados los 7 días PURGA fotos y soportes para liberar
 * la BD. Borra SOLO archivos bajo prefijos conocidos (fotos de inventario y
 * soportes de invitación) — NUNCA el contrato ni los anexos. Idempotente
 * (`purgedAt`). No toca contratos con custodia en la nube.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();

    const now = new Date();
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const snap = await firestore.collection("contracts").where("status", "==", "closed").limit(3000).get();
    let purged = 0;
    let reminded = 0;

    for (const doc of snap.docs) {
      const c = doc.data() as {
        currentVersionId?: string;
        draftId?: string;
        retentionChoice?: string;
        custodyPaidAt?: string | null;
        purgeScheduledAt?: string | null;
        purgedAt?: string | null;
        closureRemindersSent?: { r1?: string; r2?: string };
      };
      // La custodia en la nube protege de la purga SOLO si ya se pagó.
      if (c.retentionChoice === "cloud" && c.custodyPaidAt) continue;
      if (c.purgedAt) continue; // ya purgado
      const purgeAt = c.purgeScheduledAt ? Date.parse(c.purgeScheduledAt) : NaN;
      if (!Number.isFinite(purgeAt)) continue;

      // ¿Aún necesita decidir/pagar? (indeciso, o eligió nube pero no ha pagado)
      const needsAction = c.retentionChoice === "undecided" || (c.retentionChoice === "cloud" && !c.custodyPaidAt);

      // (a) Ventana de gracia: recordar al dueño si aún debe actuar.
      if (now.getTime() < purgeAt) {
        if (!needsAction) continue; // ya descargó: no molestar
        const daysLeft = Math.max(0, Math.ceil((purgeAt - now.getTime()) / (1000 * 60 * 60 * 24)));
        const sent = c.closureRemindersSent ?? {};
        let which: "r1" | "r2" | null = null;
        if (!sent.r1) which = "r1";
        else if (!sent.r2 && daysLeft <= 2) which = "r2";
        if (!which) continue;
        const vSnap = await firestore.collection("contract_versions").doc(c.currentVersionId ?? "").get();
        const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
        const phone = (payload?.landlord?.phone ?? "").trim();
        const address = (payload?.property?.address ?? "").trim();
        const link = `${base}/dashboard/contracts/${doc.id}/cerrar`;
        await sendPhoneNotice({
          to: phone,
          message: `Cerraste el contrato${address ? ` de ${address}` : ""}. En ${daysLeft} día(s) eliminaremos las fotos y soportes. Descarga tu expediente o elige guardarlo en la nube: ${link}`,
          templateCode: "closureReminderWa",
          relatedEntityType: "contract",
          relatedEntityId: doc.id,
        });
        await doc.ref.set({ closureRemindersSent: { ...sent, [which]: now.toISOString() }, updatedAt: now.toISOString() }, { merge: true });
        reminded += 1;
        continue;
      }

      // (b) Venció la gracia → PURGA fotos + soportes (solo prefijos conocidos).
      const draftId = (c.draftId && String(c.draftId).trim()) || doc.id;
      if (bucketName) {
        const bucket = getStorage().bucket(bucketName);
        // Fotos de inventario (todas las actas del contrato).
        const invs = await firestore.collection("inventories").where("contractId", "==", doc.id).limit(20).get().catch(() => null);
        for (const inv of invs?.docs ?? []) {
          await bucket.deleteFiles({ prefix: `inventories/${inv.id}/` }).catch(() => {});
        }
        // Todo lo PESADO bajo prefijos conocidos (NUNCA la carpeta annexes/ ni el
        // PDF del contrato): soportes de invitación, comprobantes de pago y
        // soportes de ingresos del inquilino/codeudor.
        await bucket.deleteFiles({ prefix: `contracts/${draftId}/invite-supports/` }).catch(() => {});
        await bucket.deleteFiles({ prefix: `contracts/${doc.id}/payment-supports/` }).catch(() => {});
        await bucket.deleteFiles({ prefix: `contracts/${doc.id}/tenant-supports/` }).catch(() => {});
        await bucket.deleteFiles({ prefix: `contracts/${doc.id}/codebtor-supports/` }).catch(() => {});
      }
      // Referencias en Firestore de esos soportes (metadatos livianos).
      const sup = await firestore.collection(PARTY_INVITE_SUPPORTS_COLLECTION).where("contractDraftId", "==", draftId).limit(200).get().catch(() => null);
      await Promise.all((sup?.docs ?? []).map((d) => d.ref.delete().catch(() => {})));
      for (const subName of ["codebtor_supports", "tenant_supports"]) {
        const subSnap = await firestore.collection("contracts").doc(doc.id).collection(subName).limit(300).get().catch(() => null);
        await Promise.all((subSnap?.docs ?? []).map((d) => d.ref.delete().catch(() => {})));
      }

      await doc.ref.set({ purgedAt: now.toISOString(), updatedAt: now.toISOString() }, { merge: true });
      auditEvent("contract_media_purged", { contractId: doc.id, invSupportsDeleted: sup?.size ?? 0 });
      purged += 1;
    }

    return NextResponse.json({ success: true, purged, reminded });
  } catch (err) {
    await logServerError("contracts/purge-closed/send-due", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo ejecutar la purga." }] }, { status: 500 });
  }
}
