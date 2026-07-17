import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import {
  createCertificate,
  listCertificatesForOwner,
  CERTIFICATE_TTL_DAYS,
} from "@/lib/reputation/certificate-store";

export const runtime = "nodejs";

/** Certificados de reputación del usuario autenticado (los suyos). */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const certs = await listCertificatesForOwner(firestore, auth.user.uid);
  return NextResponse.json({
    success: true,
    certificates: certs.map((c) => ({
      token: c.token,
      createdAt: c.createdAt,
      expiresAt: c.expiresAt,
      revoked: c.revoked,
      viewCount: c.viewCount ?? 0,
    })),
  });
}

/**
 * Crea un certificado del titular sobre SU PROPIA reputación. El correo del
 * titular se toma del usuario autenticado: nadie puede generar el de otra
 * persona (garantía de consentimiento del titular, Ley 1581/2012).
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const email = (auth.user.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ success: false, errors: [{ field: "email", message: "Tu cuenta no tiene correo asociado." }] }, { status: 422 });
  }
  const { token, expiresAt } = await createCertificate(firestore, {
    ownerUid: auth.user.uid,
    ownerEmail: email,
    ttlDays: CERTIFICATE_TTL_DAYS,
  });
  auditEvent("reputation_certificate_created", { ownerUid: auth.user.uid, expiresAt });
  return NextResponse.json({ success: true, token, expiresAt });
}
