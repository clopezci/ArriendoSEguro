import { type DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import type { PersonParty, ResidentialLeaseContractInput } from "@/domain/contracts/types";

export type ContractParticipantRole = "landlord" | "tenant" | "solidaryCoDebtor";

const IDENTITY_BODY_KEYS = ["reportedByUserId", "reportedByEmail", "reportedByRole"] as const;

declare global {
  var __TEST_GET_AUTH_USER__:
    | ((request: Request) => Promise<{ uid: string; email: string; decoded: DecodedIdToken } | null>)
    | undefined;
  var __TEST_REQUIRE_AUTH_USER__:
    | ((request: Request) => Promise<
        | { ok: true; user: { uid: string; email: string; decoded: DecodedIdToken } }
        | { ok: false; response: NextResponse }
      >)
    | undefined;
}

/**
 * Pruebas mínimas esperadas (manual / QA):
 * 1. Sin encabezado Authorization → 401.
 * 2. Token inválido → 401.
 * 3. Usuario con token válido pero email no coincide con ninguna parte del contrato → 403.
 * 4. Body con reportedByUserId de otro usuario → se ignora; se usa identidad del token.
 * 5. Pago con monto y fecha pero sin soporte válido → no `reported_paid` (pending_support o reported_without_support).
 * 6. Archivo con extensión no permitida → 422 (supportValidation) y evento de auditoría.
 */
export function requestClientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export function requestUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}

function bearerTokenFromRequest(request: Request): string | null {
  const h = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

export function bodyContainsIgnoredIdentityFields(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const o = body as Record<string, unknown>;
  return IDENTITY_BODY_KEYS.some((k) => k in o);
}

/**
 * Resuelve el email del usuario autenticado (token y, si falta, perfil en Auth Admin).
 */
export async function getAuthenticatedUser(request: Request): Promise<{
  uid: string;
  email: string;
  decoded: DecodedIdToken;
} | null> {
  if (globalThis.__TEST_GET_AUTH_USER__) {
    return globalThis.__TEST_GET_AUTH_USER__(request);
  }
  const token = bearerTokenFromRequest(request);
  const auth = getAdminAuth();
  if (!token || !auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    let email = (decoded.email ?? "").trim();
    if (!email) {
      const rec = await auth.getUser(decoded.uid);
      email = (rec.email ?? "").trim();
    }
    if (!email) return null;
    return { uid: decoded.uid, email: email.toLowerCase(), decoded };
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(request: Request): Promise<
  | { ok: true; user: { uid: string; email: string; decoded: DecodedIdToken } }
  | { ok: false; response: NextResponse }
> {
  if (globalThis.__TEST_REQUIRE_AUTH_USER__) {
    return globalThis.__TEST_REQUIRE_AUTH_USER__(request);
  }
  const auth = getAdminAuth();
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "server", message: "Autenticación no disponible en el servidor (Firebase Admin)." }] },
        { status: 503 },
      ),
    };
  }
  const token = bearerTokenFromRequest(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "auth", message: "Se requiere un token de sesión válido." }] },
        { status: 401 },
      ),
    };
  }
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "auth", message: "Token inválido o expirado." }] },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}

export function resolveEmailRoleInContract(
  userEmail: string,
  contractPayload: ResidentialLeaseContractInput | undefined,
  hasSolidaryCoDebtor: boolean,
): ContractParticipantRole | null {
  const e = userEmail.trim().toLowerCase();
  const land = contractPayload?.landlord as PersonParty | undefined;
  const ten = contractPayload?.tenant as PersonParty | undefined;
  const co = contractPayload?.solidaryCoDebtor as PersonParty | undefined;
  const l = (land?.email ?? "").trim().toLowerCase();
  const t = (ten?.email ?? "").trim().toLowerCase();
  const c = (co?.email ?? "").trim().toLowerCase();
  if (l && e === l) return "landlord";
  if (t && e === t) return "tenant";
  if (hasSolidaryCoDebtor && c && e === c) return "solidaryCoDebtor";
  return null;
}

export type ContractVersionContext = {
  contractId: string;
  contractVersionId: string;
  hasSolidaryCoDebtor: boolean;
  contractPayload: ResidentialLeaseContractInput | undefined;
};

export async function loadContractContextByVersionId(
  firestore: Firestore,
  contractVersionId: string,
  expectedContractId: string,
): Promise<ContractVersionContext | null> {
  const vSnap = await firestore.collection("contract_versions").doc(contractVersionId).get();
  if (!vSnap.exists) return null;
  const v = vSnap.data() as {
    contractId?: string;
    contractPayload?: ResidentialLeaseContractInput;
    hasSolidaryCoDebtor?: boolean;
  };
  if (v?.contractId !== expectedContractId) return null;
  return {
    contractId: expectedContractId,
    contractVersionId,
    hasSolidaryCoDebtor: Boolean(v?.hasSolidaryCoDebtor),
    contractPayload: v?.contractPayload,
  };
}

/**
 * Carga el contrato y la versión actual para mapear emails de las partes.
 */
export async function loadCurrentContractContext(
  firestore: Firestore,
  contractId: string,
): Promise<ContractVersionContext | null> {
  const cSnap = await firestore.collection("contracts").doc(contractId).get();
  if (!cSnap.exists) return null;
  const c = cSnap.data() as { currentVersionId?: string } | undefined;
  const currentVersionId = c?.currentVersionId;
  if (!currentVersionId) return null;
  const vSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
  if (!vSnap.exists) return null;
  const v = vSnap.data() as {
    contractId?: string;
    contractPayload?: ResidentialLeaseContractInput;
    hasSolidaryCoDebtor?: boolean;
  };
  if (v?.contractId !== contractId) return null;
  return {
    contractId,
    contractVersionId: currentVersionId,
    hasSolidaryCoDebtor: Boolean(v?.hasSolidaryCoDebtor),
    contractPayload: v?.contractPayload,
  };
}

/**
 * @param _userId — reservado para futuras asociaciones por UID; hoy se usa email vía getUser o token.
 */
export async function getUserRoleInContract(
  firestore: Firestore,
  _userId: string,
  email: string,
  contractId: string,
): Promise<ContractParticipantRole | null> {
  const ctx = await loadCurrentContractContext(firestore, contractId);
  if (!ctx) return null;
  return resolveEmailRoleInContract(email, ctx.contractPayload, ctx.hasSolidaryCoDebtor);
}

export async function getUserRoleInContractFromVersion(
  firestore: Firestore,
  email: string,
  contractId: string,
  contractVersionId: string,
): Promise<ContractParticipantRole | null> {
  const ctx = await loadContractContextByVersionId(firestore, contractVersionId, contractId);
  if (!ctx) return null;
  return resolveEmailRoleInContract(email, ctx.contractPayload, ctx.hasSolidaryCoDebtor);
}

export async function requireContractParticipant(
  request: Request,
  firestore: Firestore,
  contractId: string,
  mode: { kind: "by_version"; contractVersionId: string } | { kind: "current" },
): Promise<
  | {
      ok: true;
      user: { uid: string; email: string; decoded: DecodedIdToken };
      role: ContractParticipantRole;
    }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  const cSnap = await firestore.collection("contracts").doc(contractId).get();
  if (!cSnap.exists) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] },
        { status: 404 },
      ),
    };
  }

  const role =
    mode.kind === "by_version"
      ? await getUserRoleInContractFromVersion(
          firestore,
          auth.user.email,
          contractId,
          mode.contractVersionId,
        )
      : await getUserRoleInContract(firestore, auth.user.uid, auth.user.email, contractId);

  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          errors: [{ field: "auth", message: "Tu usuario no está asociado a este contrato como parte permitida." }],
        },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user: auth.user, role };
}
