import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getAutomationConfig, setAutomationConfig } from "@/lib/agencies/automation";

export const runtime = "nodejs";

/** GET — configuración de automatización (SIN el secreto). */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const config = await getAutomationConfig(gate.firestore, agencyId);
  return NextResponse.json({ success: true, config });
}

const schema = z.object({
  webhookUrl: z.string().trim().max(500).url("URL inválida.").optional().or(z.literal("")),
  webhookSecret: z.string().trim().max(200).optional(),
});

/** PUT — guarda la URL del webhook y (si viene) cifra el secreto. */
export async function PUT(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
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
  const result = await setAutomationConfig(gate.firestore, agencyId, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Falta configurar el cifrado del servidor (AGENCY_SECRETS_KEY)." }] }, { status: 503 });
  }
  const config = await getAutomationConfig(gate.firestore, agencyId);
  return NextResponse.json({ success: true, config });
}
