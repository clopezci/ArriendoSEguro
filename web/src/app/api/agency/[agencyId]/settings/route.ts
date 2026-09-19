import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { updateAgency } from "@/lib/agencies/agencyStore";
import { effectiveAgencyDefaults } from "@/domain/agencies/types";

export const runtime = "nodejs";

/** GET — configuración editable por la agencia (marca + WhatsApp propio). */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  return NextResponse.json({
    success: true,
    logoUrl: gate.agency.logoUrl ?? "",
    whatsappNumber: gate.agency.whatsappNumber ?? "",
    name: gate.agency.name,
    defaults: effectiveAgencyDefaults(gate.agency),
  });
}

const schema = z.object({
  logoUrl: z.string().trim().max(500).url("URL de logo inválida.").optional().or(z.literal("")),
  whatsappNumber: z.string().trim().max(30).optional().or(z.literal("")),
  defaults: z
    .object({
      paymentSupportPolicy: z.enum(["none", "notifications", "notifications_and_upload"]).optional(),
      utilitiesResponsible: z.string().trim().max(80).optional(),
      utilitiesDetails: z.string().trim().max(300).optional(),
      adminFeesDetails: z.string().trim().max(300).optional(),
    })
    .optional(),
});

/** PATCH — actualiza logo y/o número de WhatsApp propio. */
export async function PATCH(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }

  const patch: { logoUrl?: string; whatsappNumber?: string; defaults?: typeof parsed.data.defaults } = {};
  if (parsed.data.logoUrl !== undefined) patch.logoUrl = parsed.data.logoUrl;
  if (parsed.data.whatsappNumber !== undefined) patch.whatsappNumber = parsed.data.whatsappNumber;
  if (parsed.data.defaults !== undefined) patch.defaults = parsed.data.defaults;
  await updateAgency(gate.firestore, agencyId, patch);
  return NextResponse.json({ success: true });
}
