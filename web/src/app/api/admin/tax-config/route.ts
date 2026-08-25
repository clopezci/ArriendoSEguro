import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getTaxConfig, saveTaxConfig } from "@/lib/tax/serverTaxConfig";
import { ivaResponsableThresholdCop } from "@/domain/tax/taxConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json({ success: false, error: "server_not_configured" }, { status: 503 });
}

/** Lee la config tributaria (solo admin interno). */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!(await isInternalAdminEmailAsync(auth.user.email))) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return unavailable();
  const config = await getTaxConfig(firestore);
  return NextResponse.json({ success: true, config, thresholdCop: ivaResponsableThresholdCop(config) });
}

const patchSchema = z.object({
  ivaResponsable: z.boolean().optional(),
  ivaRate: z.number().min(0).max(100).optional(),
  uvtValue: z.number().min(1000).max(1_000_000).optional(),
  uvtYear: z.number().int().min(2020).max(2100).optional(),
  regime: z.enum(["no_responsable", "responsable", "simple"]).optional(),
});

/** Actualiza la config tributaria (solo admin interno). */
export async function PUT(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!(await isInternalAdminEmailAsync(auth.user.email))) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return unavailable();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  // Si el admin activa/desactiva manualmente el IVA, limpiamos la marca de
  // auto-activación (para no confundir el origen).
  const patch = { ...parsed.data } as Record<string, unknown>;
  if (typeof parsed.data.ivaResponsable === "boolean") patch.autoActivatedAt = "";
  const config = await saveTaxConfig(firestore, patch, auth.user.email);
  return NextResponse.json({ success: true, config, thresholdCop: ivaResponsableThresholdCop(config) });
}
