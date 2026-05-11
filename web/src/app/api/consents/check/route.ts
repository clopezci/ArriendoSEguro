import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { hasActiveConsent } from "@/lib/firebase/consents";
import { CONSENT_CURRENT_VERSION } from "@/domain/consents/consentVersions";

export const runtime = "nodejs";

/**
 * Indica si el usuario autenticado tiene consentimiento vigente para la
 * versión actual del aviso de privacidad. Se usa al inicio del wizard del
 * contrato para evitar que un usuario que creó cuenta antes de implementar
 * esta funcionalidad siga sin aceptar el tratamiento de datos.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  try {
    const has = await hasActiveConsent(firestore, auth.user.uid, CONSENT_CURRENT_VERSION);
    return NextResponse.json({
      success: true,
      hasActiveConsent: has,
      currentVersion: CONSENT_CURRENT_VERSION,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: [{ field: "server", message: "No se pudo verificar el consentimiento." }],
      },
      { status: 500 },
    );
  }
}
