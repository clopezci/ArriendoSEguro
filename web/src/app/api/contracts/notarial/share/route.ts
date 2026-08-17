import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";
import {
  NOTARIAL_SHARES_COLLECTION,
  NOTARIAL_SHARE_TTL_DAYS,
  newNotarialShareToken,
  isNotarialShareUsable,
  notarialShareRoleLabel,
  type NotarialShareDoc,
} from "@/domain/contracts/notarialShare";

export const runtime = "nodejs";

/**
 * POST: el DUEÑO (parte del contrato, sesión) crea un enlace para que el inquilino
 * firme con el Estado y suba el PDF autenticado sin cuenta. Devuelve la URL.
 * GET (público): info mínima del enlace por `?token=` para pintar la página del
 * inquilino (nombre, inmueble, versión, vigencia). No expone PII sensible.
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }
    const body = (await request.json().catch(() => null)) as
      | { contractId?: string; contractVersionId?: string; role?: "tenant" | "solidaryCoDebtor" }
      | null;
    const contractId = body?.contractId?.trim() ?? "";
    const contractVersionId = body?.contractVersionId?.trim() ?? "";
    const role = body?.role === "solidaryCoDebtor" ? "solidaryCoDebtor" : "tenant";
    if (!contractId || !contractVersionId) {
      return NextResponse.json({ success: false, errors: [{ field: "input", message: "Faltan datos del contrato." }] }, { status: 422 });
    }

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId });
    if (!participant.ok) return participant.response;

    const versionSnap = await firestore.collection("contract_versions").doc(contractVersionId).get();
    if (!versionSnap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "Versión no encontrada." }] }, { status: 404 });
    }
    const version = versionSnap.data() as { contractId?: string; contractPayload?: ResidentialLeaseContractInput };
    if (version.contractId !== contractId) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] }, { status: 422 });
    }
    const payload = version.contractPayload;
    const person = role === "tenant" ? payload?.tenant : payload?.solidaryCoDebtor;
    const inviteeName = (person?.fullName ?? "").trim();
    const inviteePhone = (person?.phone ?? "").trim();
    const propertyLabel = (payload?.property?.address ?? "").trim();

    const now = new Date();
    const token = newNotarialShareToken();
    const expiresAt = new Date(now.getTime() + NOTARIAL_SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const doc: NotarialShareDoc = {
      token,
      contractId,
      contractVersionId,
      role,
      inviteeName,
      inviteePhone,
      propertyLabel,
      inviterUid: participant.user.uid,
      inviterEmail: participant.user.email,
      status: "active",
      lastUploadedAnnexId: null,
      lastUploadedAt: null,
      createdAt: now.toISOString(),
      expiresAt,
    };
    await firestore.collection(NOTARIAL_SHARES_COLLECTION).doc(token).set(doc);

    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const url = `${base}/notaria/${token}`;
    return NextResponse.json({
      success: true,
      url,
      token,
      inviteeName,
      inviteePhone,
      propertyLabel,
      roleLabel: notarialShareRoleLabel(role),
      expiresAt,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("notarial/share POST", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo generar el enlace." }] }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }
    const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
    if (!token) {
      return NextResponse.json({ success: false, errors: [{ field: "token", message: "Falta el token." }] }, { status: 422 });
    }
    const snap = await firestore.collection(NOTARIAL_SHARES_COLLECTION).doc(token).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "token", message: "Enlace no encontrado." }] }, { status: 404 });
    }
    const doc = snap.data() as NotarialShareDoc;
    const usable = isNotarialShareUsable(doc, Date.now());
    return NextResponse.json({
      success: true,
      share: {
        contractId: doc.contractId,
        contractVersionId: doc.contractVersionId,
        role: doc.role,
        roleLabel: notarialShareRoleLabel(doc.role),
        inviteeName: doc.inviteeName,
        propertyLabel: doc.propertyLabel,
        expired: !usable,
        alreadyUploaded: Boolean(doc.lastUploadedAt),
        lastUploadedAt: doc.lastUploadedAt ?? null,
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("notarial/share GET", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo leer el enlace." }] }, { status: 500 });
  }
}
