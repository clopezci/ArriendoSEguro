import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import {
  createProperty,
  deleteProperty,
  getProperty,
  listProperties,
  updateProperty,
  type PropertyInput,
} from "@/lib/agencies/agencyStore";

export const runtime = "nodejs";

const propertySchema = z.object({
  alias: z.string().trim().max(80).optional(),
  address: z.string().trim().min(3, "Dirección requerida.").max(200),
  city: z.string().trim().min(2).max(80),
  department: z.string().trim().min(2).max(80),
  type: z.string().trim().min(2).max(60),
  registryNumber: z.string().trim().max(60).optional().default(""),
  commercialValue: z.number().int().min(0).max(1_000_000_000_000).optional(),
  commercialValueUnknown: z.boolean().optional(),
  defaultRent: z.number().int().min(0).max(1_000_000_000).optional(),
});

function toInput(input: z.infer<typeof propertySchema>): PropertyInput {
  return {
    ...(input.alias ? { alias: input.alias } : {}),
    address: input.address,
    city: input.city,
    department: input.department,
    type: input.type,
    registryNumber: input.registryNumber ?? "",
    ...(typeof input.commercialValue === "number" ? { commercialValue: input.commercialValue } : {}),
    ...(input.commercialValueUnknown ? { commercialValueUnknown: true } : {}),
    ...(typeof input.defaultRent === "number" ? { defaultRent: input.defaultRent } : {}),
  };
}

function validationError(issues: { field: string; message: string }[]) {
  return NextResponse.json({ success: false, errors: issues }, { status: 422 });
}

/** GET — lista de inmuebles de la agencia. */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const properties = await listProperties(gate.firestore, agencyId);
  return NextResponse.json({ success: true, properties });
}

/** POST — crea un inmueble reutilizable. */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError([{ field: "body", message: "JSON inválido." }]);
  }
  const parsed = propertySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
  }
  const property = await createProperty(gate.firestore, agencyId, toInput(parsed.data));
  return NextResponse.json({ success: true, property });
}

const patchSchema = z.object({ id: z.string().trim().min(1) }).and(propertySchema);

/** PATCH — actualiza un inmueble ({ id, ...property }). */
export async function PATCH(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;

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
  const existing = await getProperty(gate.firestore, parsed.data.id);
  if (!existing || existing.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "id", message: "Inmueble no encontrado." }] }, { status: 404 });
  }
  await updateProperty(gate.firestore, parsed.data.id, toInput(parsed.data));
  return NextResponse.json({ success: true });
}

/** DELETE ?id=... — elimina un inmueble. */
export async function DELETE(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return validationError([{ field: "id", message: "Falta id." }]);
  const existing = await getProperty(gate.firestore, id);
  if (!existing || existing.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "id", message: "Inmueble no encontrado." }] }, { status: 404 });
  }
  await deleteProperty(gate.firestore, id);
  return NextResponse.json({ success: true });
}
