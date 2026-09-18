import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  addCredits,
  createAgency,
  getCredits,
  listAllAgencies,
  updateAgency,
} from "@/lib/agencies/agencyStore";

export const runtime = "nodejs";

function serverError(status = 500, message = "Error del servidor.") {
  return NextResponse.json({ success: false, errors: [{ field: "server", message }] }, { status });
}

function validationError(issues: { field: string; message: string }[]) {
  return NextResponse.json({ success: false, errors: issues }, { status: 422 });
}

/** GET /api/admin/agencies — lista todas las agencias con su saldo de créditos. */
export async function GET(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return serverError(503, "Firestore no configurado.");

  try {
    const agencies = await listAllAgencies(firestore);
    const withCredits = await Promise.all(
      agencies.map(async (a) => ({ ...a, credits: (await getCredits(firestore, a.id)).balance })),
    );
    return NextResponse.json({ success: true, agencies: withCredits });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("admin/agencies GET", err);
    return serverError();
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto.").max(120),
  nit: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().email("Correo inválido."),
  contactPhone: z.string().trim().max(30).optional(),
  memberEmails: z.array(z.string().trim().email()).max(50).optional(),
});

/** POST /api/admin/agencies — crea una agencia. */
export async function POST(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return serverError(503, "Firestore no configurado.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError([{ field: "body", message: "JSON inválido." }]);
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
  }

  try {
    const agency = await createAgency(firestore, {
      name: parsed.data.name,
      nit: parsed.data.nit,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      memberEmails: parsed.data.memberEmails,
      ownerUid: gate.user.uid,
    });
    return NextResponse.json({ success: true, agency });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("admin/agencies POST", err);
    return serverError();
  }
}

const patchSchema = z.object({
  agencyId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  nit: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().max(30).optional(),
  memberEmails: z.array(z.string().trim().email()).max(50).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  /** Créditos a sumar al saldo (paquete asignado manualmente por admin). */
  addCredits: z.number().int().min(1).max(100000).optional(),
});

/** PATCH /api/admin/agencies — actualiza una agencia y/o suma créditos. */
export async function PATCH(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return serverError(503, "Firestore no configurado.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError([{ field: "body", message: "JSON inválido." }]);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
  }

  const { agencyId, addCredits: creditsToAdd, ...patch } = parsed.data;
  try {
    const hasPatch = Object.values(patch).some((v) => v !== undefined);
    if (hasPatch) await updateAgency(firestore, agencyId, patch);
    let balance: number | undefined;
    if (typeof creditsToAdd === "number") balance = await addCredits(firestore, agencyId, creditsToAdd);
    return NextResponse.json({ success: true, ...(balance !== undefined ? { credits: balance } : {}) });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("admin/agencies PATCH", err);
    return serverError();
  }
}
