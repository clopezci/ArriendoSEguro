import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import { isInviteOpenForUpload, normalizeEmail } from "@/domain/party-invite/partyInvite";
import { codebtorPartyType, SIGNATURE_TOKEN_HOURS } from "@/domain/signatures/signatureRules";
import { canBeSigned, nextSignatureStatusOnOpen } from "@/domain/signatures/signatureStatus";
import { generateSignatureToken } from "@/domain/signatures/generateSignatureToken";
import type { SignaturePartyType, SignatureStatus } from "@/domain/signatures/types";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().trim().min(10).max(200) });

/**
 * Rediseño #3 "un solo enlace": puente invitación → firma. Dada una invitación
 * de datos ya OTP-verificada, si la ronda de firma YA está abierta para esa parte
 * (el dueño activó/pagó e inició la firma), acuña un token de firma NUEVO para el
 * registro `signatures` de esa parte y devuelve la URL `/firma/{token}`. No toca
 * el motor de firma ni el cobro: solo permite firmar desde el mismo enlace de la
 * invitación. Si la ronda aún no está abierta, devuelve `ready:false`.
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ ok: false, error: "Servidor no configurado." }, { status: 503 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 422 });
    }

    const invite = await getInvite(firestore, parsed.data.token);
    const now = Date.now();
    if (!invite || !isInviteOpenForUpload(invite, now)) {
      return NextResponse.json({ ok: false, error: "Enlace no válido o vencido." }, { status: 404 });
    }
    if (!invite.otpVerifiedAt) {
      // La identidad se prueba con el OTP de la invitación (igual que para enviar datos).
      return NextResponse.json({ ok: false, error: "Verifica primero tu código." }, { status: 403 });
    }

    const contractId = invite.contractDraftId;
    const partyType: SignaturePartyType =
      invite.role === "tenant" ? "tenant" : codebtorPartyType(invite.codebtorSlot ?? 0);

    // Versión vigente del contrato: solo se firma la última.
    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    const currentVersionId = (contractSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId ?? null;

    // Firma de esta parte en la versión vigente.
    const sigSnap = await firestore.collection("signatures").where("contractId", "==", contractId).get();
    const mine = sigSnap.docs.filter((d) => {
      const s = d.data() as { partyType?: string; contractVersionId?: string };
      return s.partyType === partyType && (!currentVersionId || s.contractVersionId === currentVersionId);
    });

    if (mine.length === 0) {
      // La ronda de firma aún no está abierta para esta parte (el dueño no ha
      // activado/iniciado la firma). Se firmará más tarde desde este mismo enlace.
      return NextResponse.json({ ok: true, ready: false, reason: "not_started" });
    }

    // Si hay varias, prioriza la ya firmada o la más reciente.
    mine.sort((a, b) => {
      const sa = (a.data() as { signatureStatus?: string }).signatureStatus === "signed" ? 1 : 0;
      const sb = (b.data() as { signatureStatus?: string }).signatureStatus === "signed" ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return String((b.data() as { updatedAt?: string }).updatedAt ?? "").localeCompare(
        String((a.data() as { updatedAt?: string }).updatedAt ?? ""),
      );
    });
    const ref = mine[0].ref;
    const data = mine[0].data() as { signatureStatus?: SignatureStatus; signerEmail?: string };
    const status = (data.signatureStatus ?? "pending") as SignatureStatus;

    // Coherencia: el correo de la firma debe corresponder al de la invitación.
    if (normalizeEmail(data.signerEmail) && normalizeEmail(data.signerEmail) !== normalizeEmail(invite.inviteeEmail)) {
      return NextResponse.json({ ok: true, ready: false, reason: "email_mismatch" });
    }

    if (status === "signed") {
      return NextResponse.json({ ok: true, ready: false, signed: true, reason: "already_signed" });
    }
    if (!(canBeSigned(status) || status === "expired")) {
      return NextResponse.json({ ok: true, ready: false, reason: "not_available" });
    }

    // Acuña un token de firma NUEVO para este registro (el anterior queda invalidado).
    const { token, tokenHash } = generateSignatureToken(ref.id);
    const tokenExpiresAt = new Date(now + SIGNATURE_TOKEN_HOURS * 60 * 60 * 1000).toISOString();
    await ref.set(
      {
        tokenHash,
        tokenExpiresAt,
        signatureStatus: nextSignatureStatusOnOpen(status === "expired" ? "sent" : status),
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true },
    );

    auditEvent("party_invite_sign_session_minted", { contractId, partyType });
    return NextResponse.json({ ok: true, ready: true, signUrl: `/firma/${token}` });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[/api/party-invite/sign-session]", err);
    return NextResponse.json({ ok: false, error: "No se pudo preparar la firma." }, { status: 500 });
  }
}
