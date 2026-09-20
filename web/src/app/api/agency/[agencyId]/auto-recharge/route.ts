import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { updateAgency } from "@/lib/agencies/agencyStore";
import { getAgencyPlan } from "@/domain/agencies/plans";

export const runtime = "nodejs";

/** GET — configuración de auto-recarga (plan Ilimitado) de la agencia. */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const ar = gate.agency.autoRecharge;
  return NextResponse.json({
    success: true,
    autoRecharge: {
      enabled: ar?.enabled === true,
      planCode: ar?.planCode ?? "",
      thresholdCredits: ar?.thresholdCredits ?? 3,
    },
  });
}

const schema = z.object({
  enabled: z.boolean(),
  planCode: z.string().trim().min(1).max(40),
  thresholdCredits: z.number().int().min(0).max(100),
});

/**
 * PUT — activa/ajusta la auto-recarga asistida. Cuando el saldo baja del umbral,
 * se genera automáticamente una orden del plan elegido y se avisa a la agencia.
 */
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

  // Si se activa, el plan debe existir.
  if (parsed.data.enabled) {
    const plan = await getAgencyPlan(gate.firestore, parsed.data.planCode);
    if (!plan) {
      return NextResponse.json({ success: false, errors: [{ field: "planCode", message: "Plan no disponible." }] }, { status: 404 });
    }
  }

  // Conserva cualquier pendingOrderId existente (no lo pisamos al reconfigurar).
  const prev = gate.agency.autoRecharge;
  await updateAgency(gate.firestore, agencyId, {
    autoRecharge: {
      enabled: parsed.data.enabled,
      planCode: parsed.data.planCode,
      thresholdCredits: parsed.data.thresholdCredits,
      ...(prev?.pendingOrderId !== undefined ? { pendingOrderId: prev.pendingOrderId } : {}),
    },
  });
  return NextResponse.json({ success: true });
}
