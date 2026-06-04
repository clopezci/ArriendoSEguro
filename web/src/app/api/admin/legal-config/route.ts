import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  LEGAL_CONFIG_COLLECTION,
  LEGAL_CONFIG_DOC_ID,
  getLegalConfig,
} from "@/domain/legal/legalConfig";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }
  const config = await getLegalConfig(firestore);
  const currentYear = new Date().getUTCFullYear();
  return NextResponse.json({ success: true, config, currentYear, confirmedThisYear: config.ipcConfirmedForYear === currentYear });
}

const patchSchema = z.object({
  /** Si solo se confirma (la cifra sigue vigente), no hace falta enviar valores. */
  confirmOnly: z.boolean().optional(),
  ipcPercent: z.number().positive().max(100).optional(),
  ipcPreviousYear: z.number().int().min(2000).max(2100).optional(),
  ipcAppliesToYear: z.number().int().min(2000).max(2100).optional(),
  ipcSource: z.string().max(200).optional(),
});

export async function PATCH(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: [{ field: "body", message: "Datos inválidos." }] },
      { status: 422 },
    );
  }
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const nowIso = now.toISOString();

  // Tanto guardar un nuevo valor como "confirmar que sigue vigente" marcan el
  // año como atendido → corta el recordatorio anual.
  const update: Record<string, unknown> = {
    ipcConfirmedForYear: currentYear,
    ipcUpdatedAt: nowIso,
    ipcUpdatedByEmail: gate.user.email,
    updatedAtServer: FieldValue.serverTimestamp(),
  };
  if (!parsed.data.confirmOnly) {
    if (parsed.data.ipcPercent != null) update.ipcPercent = parsed.data.ipcPercent;
    if (parsed.data.ipcPreviousYear != null) update.ipcPreviousYear = parsed.data.ipcPreviousYear;
    if (parsed.data.ipcAppliesToYear != null) update.ipcAppliesToYear = parsed.data.ipcAppliesToYear;
    if (parsed.data.ipcSource != null) update.ipcSource = parsed.data.ipcSource;
  }

  await firestore.collection(LEGAL_CONFIG_COLLECTION).doc(LEGAL_CONFIG_DOC_ID).set(update, { merge: true });
  auditEvent("legal_config_updated", {
    byEmail: gate.user.email,
    confirmOnly: Boolean(parsed.data.confirmOnly),
    ipcPercent: parsed.data.ipcPercent ?? null,
    year: currentYear,
  });

  const config = await getLegalConfig(firestore);
  return NextResponse.json({ success: true, config, currentYear });
}
