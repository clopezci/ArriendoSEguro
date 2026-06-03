import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, Timestamp, type QuerySnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { ERROR_EVENTS_COLLECTION, USER_REPORTS_COLLECTION } from "@/lib/observability/observability";
import { REPORT_STATUSES } from "@/lib/reports/report-categories";

export const runtime = "nodejs";

function iso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return "";
}

async function safe(fn: () => Promise<QuerySnapshot>): Promise<QuerySnapshot | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

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

  const [reportsSnap, errorsSnap] = await Promise.all([
    safe(() => firestore.collection(USER_REPORTS_COLLECTION).orderBy("createdAtServer", "desc").limit(200).get()),
    safe(() => firestore.collection(ERROR_EVENTS_COLLECTION).orderBy("lastSeenServer", "desc").limit(200).get()),
  ]);

  const reports =
    reportsSnap?.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        category: String(x.category ?? ""),
        message: String(x.message ?? ""),
        reporterEmail: x.reporterEmail != null ? String(x.reporterEmail) : "",
        isAuthenticated: Boolean(x.isAuthenticated),
        status: String(x.status ?? "new"),
        pageUrl: x.pageUrl != null ? String(x.pageUrl) : "",
        createdAt: iso(x.createdAtServer) || String(x.createdAt ?? ""),
      };
    }) ?? [];

  const errorEvents =
    errorsSnap?.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        kind: String(x.kind ?? "error"),
        message: String(x.message ?? ""),
        source: x.source != null ? String(x.source) : "",
        count: Number(x.count ?? 0),
        resolved: Boolean(x.resolved),
        lastPageUrl: x.lastPageUrl != null ? String(x.lastPageUrl) : "",
        firstSeenAt: iso(x.firstSeenServer) || String(x.firstSeenAt ?? ""),
        lastSeenAt: iso(x.lastSeenServer) || String(x.lastSeenAt ?? ""),
      };
    }) ?? [];

  // El «analizador» se ordena por más recientes; aquí exponemos también los
  // más frecuentes no resueltos para priorizar.
  const topUnresolved = [...errorEvents]
    .filter((e) => !e.resolved)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    success: true,
    reports,
    errorEvents,
    topUnresolved,
    totals: {
      reportsNew: reports.filter((r) => r.status === "new").length,
      errorsUnresolved: errorEvents.filter((e) => !e.resolved).length,
    },
  });
}

const patchSchema = z.object({
  kind: z.enum(["report", "error"]),
  id: z.string().min(1).max(200),
  status: z.enum(REPORT_STATUSES).optional(),
  resolved: z.boolean().optional(),
});

/** Actualiza el estado de un reporte o marca/desmarca un error como resuelto. */
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
  const { kind, id } = parsed.data;

  if (kind === "report") {
    if (!parsed.data.status) {
      return NextResponse.json(
        { success: false, errors: [{ field: "status", message: "Falta el nuevo estado." }] },
        { status: 422 },
      );
    }
    await firestore.collection(USER_REPORTS_COLLECTION).doc(id).set(
      { status: parsed.data.status, updatedAtServer: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return NextResponse.json({ success: true });
  }

  await firestore.collection(ERROR_EVENTS_COLLECTION).doc(id).set(
    { resolved: parsed.data.resolved ?? true, updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return NextResponse.json({ success: true });
}
