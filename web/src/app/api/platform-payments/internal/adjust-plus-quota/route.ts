import { NextResponse } from "next/server";
import { z } from "zod";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import {
  adjustTesterPlusQuotaByEmail,
  TESTER_PLUS_MAX_ADD_SLOTS,
  TESTER_PLUS_MAX_EXPEDIENTES,
} from "@/domain/platform-payments/adjust-tester-plus-quota";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("set_max"),
    email: z.string().email(),
    maxContractsAllowed: z.number().int().min(1).max(TESTER_PLUS_MAX_EXPEDIENTES),
  }),
  z.object({
    mode: z.literal("add_slots"),
    email: z.string().email(),
    slots: z.number().int().min(1).max(TESTER_PLUS_MAX_ADD_SLOTS),
  }),
]);

function isInternalEnabled() {
  return process.env.NODE_ENV === "development" || process.env.ADMIN_INTERNAL_ENABLED === "true";
}

async function isAllowedAdmin(email: string): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  return isInternalAdminEmailAsync(email);
}

export async function POST(request: Request) {
  if (!isInternalEnabled()) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No disponible." }] }, { status: 404 });
  }

  const authUser = await requireAuthenticatedUser(request);
  if (!authUser.ok) return authUser.response;
  if (!(await isAllowedAdmin(authUser.user.email))) {
    return NextResponse.json(
      { success: false, errors: [{ field: "auth", message: "No autorizado para operación interna." }] },
      { status: 403 },
    );
  }

  const firestore = getAdminFirestore();
  const auth = getAdminAuth();
  if (!firestore || !auth) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "body", message: "JSON inválido." }] },
      { status: 422 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const emailLc = parsed.data.email.trim().toLowerCase();
  let userId = "";
  try {
    const u = await auth.getUserByEmail(emailLc);
    userId = u.uid;
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: [{ field: "email", message: "Usuario no encontrado en Auth. Debe registrarse primero." }],
      },
      { status: 404 },
    );
  }

  const result = await adjustTesterPlusQuotaByEmail({
    firestore,
    userId,
    requestedBy: authUser.user.email.trim().toLowerCase(),
    mode: parsed.data.mode === "set_max" ? "set_max" : "add_slots",
    maxContractsAllowed: parsed.data.mode === "set_max" ? parsed.data.maxContractsAllowed : undefined,
    slots: parsed.data.mode === "add_slots" ? parsed.data.slots : undefined,
  });

  if (!result.ok) {
    if (result.reason === "nothing_to_do") {
      return NextResponse.json(
        {
          success: false,
          errors: [
            {
              field: "quota",
              message: "Ya estaba ese límite; no hay cambios. Si tienes varios Plus, revisa cuál fila se prioriza en soporte.",
            },
          ],
        },
        { status: 422 },
      );
    }
    if (result.reason === "no_plus_entitlement") {
      return NextResponse.json(
        {
          success: false,
          errors: [
            {
              field: "access",
              message:
                "No hay Plan Plus vigente para aumentar cupos (o ya expiró). Primero usa «Otorgar Plus».",
            },
          ],
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Solicitud inválida." }] },
      { status: 422 },
    );
  }

  return NextResponse.json({
    success: true,
    entitlementId: result.entitlementId,
    userId: result.userId,
    userEmail: result.userEmail,
    previousMax: result.previousMax,
    newMax: result.newMax,
    contractsUsed: result.contractsUsed,
    status: result.status,
    previousStatus: result.previousStatus,
  });
}
