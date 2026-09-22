import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getExternalConfig, setExternalConfig } from "@/lib/agencies/externalStudy";
import { validateOutboundUrl } from "@/lib/security/outbound-url";

export const runtime = "nodejs";

/** GET — configuración de estudio externo (SIN la llave). */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const config = await getExternalConfig(gate.firestore, agencyId);
  return NextResponse.json({ success: true, config });
}

const schema = z.object({
  endpoint: z.string().trim().max(500).url("Endpoint inválido.").optional().or(z.literal("")),
  scorePath: z.string().trim().max(100).optional(),
  apiKey: z.string().trim().max(500).optional(),
});

/** PUT — guarda endpoint/scorePath y (si viene) cifra la nueva API key. */
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
  // Anti-SSRF: el servidor hace fetch a este endpoint con la API key → exige https y bloquea red interna.
  if (parsed.data.endpoint) {
    const check = validateOutboundUrl(parsed.data.endpoint);
    if (!check.ok) {
      return NextResponse.json({ success: false, errors: [{ field: "endpoint", message: check.error }] }, { status: 422 });
    }
  }
  const result = await setExternalConfig(gate.firestore, agencyId, parsed.data);
  if (!result.ok) {
    const msg = result.error === "secrets_not_configured" ? "Falta configurar el cifrado del servidor (AGENCY_SECRETS_KEY)." : "No se pudo guardar la llave.";
    return NextResponse.json({ success: false, errors: [{ field: "server", message: msg }] }, { status: 503 });
  }
  const config = await getExternalConfig(gate.firestore, agencyId);
  return NextResponse.json({ success: true, config });
}
