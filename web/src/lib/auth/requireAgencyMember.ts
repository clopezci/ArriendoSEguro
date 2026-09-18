import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAgency } from "@/lib/agencies/agencyStore";
import { isAgencyMemberEmail, type Agency } from "@/domain/agencies/types";

type AuthedUser = { uid: string; email: string; decoded: DecodedIdToken };

function jsonError(field: string, message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, errors: [{ field, message }] }, { status });
}

/**
 * Guard de acceso a una agencia. Concede acceso si el usuario es miembro de la
 * agencia (`memberEmails`), su `ownerUid`, o admin interno (para gestión y
 * concierge). NO ampliar `requireContractParticipant` para esto: la
 * autorización por participante es estrictamente por correo en el contrato.
 *
 * Devuelve el `firestore` y la `agency` ya cargados para no re-consultar.
 */
export async function requireAgencyMember(
  request: Request,
  agencyId: string,
): Promise<
  | { ok: true; user: AuthedUser; firestore: Firestore; agency: Agency; isAdmin: boolean }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return { ok: false, response: jsonError("server", "Firestore no configurado.", 503) };
  }

  if (!agencyId) {
    return { ok: false, response: jsonError("agencyId", "Falta el identificador de la agencia.", 422) };
  }

  const agency = await getAgency(firestore, agencyId);
  if (!agency) {
    return { ok: false, response: jsonError("agencyId", "Agencia no encontrada.", 404) };
  }

  const isAdmin = await isInternalAdminEmailAsync(auth.user.email);
  const isMember = isAgencyMemberEmail(agency, auth.user.email) || agency.ownerUid === auth.user.uid;

  if (!isMember && !isAdmin) {
    return { ok: false, response: jsonError("auth", "No autorizado para esta agencia.", 403) };
  }

  if (agency.status !== "active" && !isAdmin) {
    return { ok: false, response: jsonError("auth", "La agencia está suspendida.", 403) };
  }

  return { ok: true, user: auth.user, firestore, agency, isAdmin };
}
