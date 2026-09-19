import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAgency } from "@/lib/agencies/agencyStore";
import { isIdentityEnabledForAgency } from "@/domain/agencies/types";
import { createOrUpdateSubmission } from "@/lib/agencies/intakeStore";
import { verifyIdentity, isIdentityConfigured } from "@/lib/identity/hubClient";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const MAX_JSON_BYTES = 12_000_000;

const schema = z.object({
  fullName: z.string().trim().min(3, "Nombre completo requerido.").max(160),
  documentType: z.string().trim().min(1).max(20).optional().default("CC"),
  documentNumber: z.string().trim().min(3, "Documento requerido.").max(30),
  city: z.string().trim().min(2, "Ciudad requerida.").max(80),
  email: z.string().trim().email("Correo inválido."),
  phone: z.string().trim().min(7, "Teléfono requerido.").max(20),
  propertyHint: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
  /** Respuestas a los campos personalizados de la agencia (key → valor). */
  custom: z.record(z.string(), z.string().max(500)).optional(),
  /** Datos de estudio (opcionales). */
  income: z.number().int().min(0).max(1_000_000_000).optional(),
  contractType: z.string().trim().max(60).optional(),
  hasCodebtor: z.boolean().optional(),
  canonReference: z.number().int().min(0).max(1_000_000_000).optional(),
  // Identidad opcional (si el solicitante sube fotos).
  fotoCedula: z.string().min(10).optional(),
  selfie: z.string().min(10).optional(),
});

/**
 * POST /api/public/agency/[agencyId]/intake — recepción PÚBLICA de solicitudes
 * (auto-diligenciamiento del inquilino). Sin sesión, con rate-limit. Si vienen
 * fotos, corre identidad y guarda el resumen. Dedup por documento.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "No disponible." }] }, { status: 503 });

  const rl = await checkRateLimit(`intake:${clientIpFromRequest(request)}`, RATE_LIMIT_RULES.leads);
  if (!rl.ok) {
    const { body, headers } = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(body, { status: 429, headers });
  }

  const agency = await getAgency(firestore, agencyId);
  if (!agency || agency.status !== "active") {
    return NextResponse.json({ success: false, errors: [{ field: "agency", message: "Agencia no disponible." }] }, { status: 404 });
  }

  const raw = await request.text();
  if (raw.length > MAX_JSON_BYTES) {
    return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Datos demasiado grandes." }] }, { status: 413 });
  }
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  const d = parsed.data;

  // Campos personalizados: solo se guardan los definidos por la agencia; se
  // valida que los obligatorios vengan con valor.
  const defs = agency.intakeFields ?? [];
  const custom: Record<string, string> = {};
  for (const f of defs) {
    const val = (d.custom?.[f.key] ?? "").toString().trim();
    if (val) custom[f.key] = val.slice(0, 500);
    else if (f.required) {
      return NextResponse.json({ success: false, errors: [{ field: `custom.${f.key}`, message: `El campo "${f.label}" es obligatorio.` }] }, { status: 422 });
    }
  }

  // Identidad opcional.
  let identity;
  if (d.fotoCedula && d.selfie && isIdentityConfigured() && isIdentityEnabledForAgency(agency)) {
    const r = await verifyIdentity({
      cedula: d.documentNumber.replace(/\D/g, ""),
      fotoCedula: d.fotoCedula,
      selfie: d.selfie,
      nivel: "alto",
      subCuenta: { id: agencyId, nombre: agency.name, escalamientoEmail: agency.escalationEmail },
    });
    if (r.available) {
      identity = {
        approved: r.approved,
        confianza: r.confianza ?? null,
        nombreRegistrado: r.nombreRegistrado ?? null,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  const { deduped } = await createOrUpdateSubmission(firestore, agencyId, {
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
    custom: Object.keys(custom).length ? custom : undefined,
    study: {
      ...(typeof d.income === "number" ? { income: d.income } : {}),
      ...(d.contractType ? { contractType: d.contractType } : {}),
      ...(typeof d.hasCodebtor === "boolean" ? { hasCodebtor: d.hasCodebtor } : {}),
      ...(typeof d.canonReference === "number" ? { canonReference: d.canonReference } : {}),
    },
    identity,
    source: "web",
  });

  return NextResponse.json({ success: true, deduped });
}
