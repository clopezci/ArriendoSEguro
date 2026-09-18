import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import {
  createLandlord,
  deleteLandlord,
  getLandlord,
  listLandlords,
  updateLandlord,
} from "@/lib/agencies/agencyStore";
import type { PersonParty } from "@/domain/contracts/types";

export const runtime = "nodejs";

const partySchema = z.object({
  fullName: z.string().trim().min(3, "Nombre completo requerido.").max(160),
  documentType: z.string().trim().min(1).max(20),
  documentNumber: z.string().trim().min(3, "Documento inválido.").max(30),
  city: z.string().trim().min(2).max(80),
  email: z.string().trim().email("Correo inválido."),
  phone: z.string().trim().min(7, "Teléfono inválido.").max(20),
  notificationAddress: z.string().trim().max(200).optional().default(""),
});

function toParty(input: z.infer<typeof partySchema>): PersonParty {
  return {
    fullName: input.fullName,
    documentType: input.documentType,
    documentNumber: input.documentNumber,
    city: input.city,
    email: input.email,
    phone: input.phone,
    notificationAddress: input.notificationAddress ?? "",
  };
}

function validationError(issues: { field: string; message: string }[]) {
  return NextResponse.json({ success: false, errors: issues }, { status: 422 });
}

/** GET — lista de arrendadores de la agencia. */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const landlords = await listLandlords(gate.firestore, agencyId);
  return NextResponse.json({ success: true, landlords });
}

/** POST — crea un arrendador reutilizable. */
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
  const parsed = partySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
  }
  const landlord = await createLandlord(gate.firestore, agencyId, toParty(parsed.data));
  return NextResponse.json({ success: true, landlord });
}

const patchSchema = z.object({ id: z.string().trim().min(1) }).and(partySchema);

/** PATCH — actualiza un arrendador ({ id, ...party }). */
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
  const existing = await getLandlord(gate.firestore, parsed.data.id);
  if (!existing || existing.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "id", message: "Arrendador no encontrado." }] }, { status: 404 });
  }
  await updateLandlord(gate.firestore, parsed.data.id, toParty(parsed.data));
  return NextResponse.json({ success: true });
}

/** DELETE ?id=... — elimina un arrendador. */
export async function DELETE(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return validationError([{ field: "id", message: "Falta id." }]);
  const existing = await getLandlord(gate.firestore, id);
  if (!existing || existing.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "id", message: "Arrendador no encontrado." }] }, { status: 404 });
  }
  await deleteLandlord(gate.firestore, id);
  return NextResponse.json({ success: true });
}
