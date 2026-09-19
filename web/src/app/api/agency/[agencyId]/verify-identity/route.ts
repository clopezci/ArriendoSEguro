import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { verifyIdentity, isIdentityConfigured } from "@/lib/identity/hubClient";
import { isIdentityEnabledForAgency } from "@/domain/agencies/types";

export const runtime = "nodejs";
const MAX_JSON_BYTES = 12_000_000;

const schema = z.object({
  cedula: z.string().trim().min(3).max(30),
  fotoCedula: z.string().min(10),
  selfie: z.string().min(10).optional(),
  nivel: z.enum(["basico", "medio", "alto", "maximo"]).optional(),
});

/**
 * POST /api/agency/[agencyId]/verify-identity — verificación SIN asociar a
 * contrato (solo consultar), pero dentro del contexto de la agencia: pasa la
 * subCuenta (con el correo de escalamiento) y respeta el interruptor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  if (!isIdentityConfigured()) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Módulo de identidad no configurado." }] }, { status: 503 });
  }
  if (!isIdentityEnabledForAgency(gate.agency)) {
    return NextResponse.json({ success: false, errors: [{ field: "identity", message: "La agencia tiene desactivado el módulo de identidad." }] }, { status: 409 });
  }

  const raw = await request.text();
  if (raw.length > MAX_JSON_BYTES) {
    return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Imágenes demasiado grandes." }] }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }

  const result = await verifyIdentity({
    ...parsed.data,
    subCuenta: { id: agencyId, nombre: gate.agency.name, escalamientoEmail: gate.agency.escalationEmail },
  });
  if (!result.available) {
    return NextResponse.json({ success: false, result, errors: [{ field: "identity", message: "No se pudo consultar el servicio de identidad." }] }, { status: 502 });
  }
  return NextResponse.json({ success: true, result });
}
