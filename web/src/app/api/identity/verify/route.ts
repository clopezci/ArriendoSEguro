import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { verifyIdentity, isIdentityConfigured } from "@/lib/identity/hubClient";

export const runtime = "nodejs";
const MAX_JSON_BYTES = 12_000_000; // ~12MB (dos fotos en base64)

const schema = z.object({
  cedula: z.string().trim().min(3).max(30),
  fotoCedula: z.string().min(10),
  selfie: z.string().min(10).optional(),
  nivel: z.enum(["basico", "medio", "alto", "maximo"]).optional(),
  accion: z.string().trim().max(40).optional(),
});

/**
 * POST /api/identity/verify — verifica identidad contra el hub externo.
 * Requiere sesión. La API key nunca sale del servidor. Reutilizable en toda la app.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  if (!isIdentityConfigured()) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "El módulo de identidad no está configurado (falta ArriendoSeguro_API_KEY)." }] },
      { status: 503 },
    );
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
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const result = await verifyIdentity(parsed.data);
  if (!result.available) {
    const msg = result.error === "not_configured" ? "Módulo de identidad no configurado." : "No se pudo consultar el servicio de identidad.";
    return NextResponse.json({ success: false, result, errors: [{ field: "identity", message: msg }] }, { status: 502 });
  }
  return NextResponse.json({ success: true, result });
}
