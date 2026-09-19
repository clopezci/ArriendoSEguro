import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAgency } from "@/lib/agencies/agencyStore";
import { createOrUpdateSubmission } from "@/lib/agencies/intakeStore";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Webhook NORMALIZADO de captura por WhatsApp. Provider-agnóstico: cualquier BSP
 * (360dialog, Cloud API, Wati…) o un relay del hub propio puede transformar la
 * respuesta del WhatsApp Flow a este JSON y postearlo aquí. Cae en la MISMA
 * bandeja `intake_submissions` que el auto-diligenciamiento web (source "whatsapp").
 *
 * Seguridad: header `x-webhook-secret` debe igualar `WHATSAPP_INTAKE_SECRET`.
 * Si esa variable no está configurada, el endpoint responde 503 (apagado).
 *
 * GET: handshake de verificación estilo Meta (echo de hub.challenge) para el
 * registro del webhook en Cloud API, usando `WHATSAPP_VERIFY_TOKEN`.
 */

const bodySchema = z.object({
  agencyId: z.string().trim().min(1),
  fullName: z.string().trim().min(3).max(160),
  documentType: z.string().trim().max(20).optional(),
  documentNumber: z.string().trim().min(3).max(30),
  city: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(20),
  propertyHint: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_INTAKE_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: "whatsapp_disabled" }, { status: 503 });
  }
  if (request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`wa-intake:${clientIpFromRequest(request)}`, RATE_LIMIT_RULES.leads);
  if (!rl.ok) {
    const { body, headers } = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(body, { status: 429, headers });
  }

  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, error: "server" }, { status: 503 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "bad_json" }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const agency = await getAgency(firestore, d.agencyId);
  if (!agency || agency.status !== "active") {
    return NextResponse.json({ success: false, error: "agency_unavailable" }, { status: 404 });
  }

  const { deduped } = await createOrUpdateSubmission(firestore, d.agencyId, {
    tenant: {
      fullName: d.fullName,
      documentType: d.documentType ?? "CC",
      documentNumber: d.documentNumber,
      city: d.city,
      email: d.email,
      phone: d.phone,
    },
    propertyHint: d.propertyHint,
    note: d.note,
    source: "whatsapp",
  });

  return NextResponse.json({ success: true, deduped });
}
