import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { FLAGS_COLLECTION } from "@/lib/reputation/aggregate-store";

export const runtime = "nodejs";

function maskEmail(v: string): string {
  const at = (v ?? "").indexOf("@");
  if (at <= 1) return "***";
  return `${v[0]}***${v.slice(at)}`;
}

/** Señales anti-fraude de reputación para revisión humana. */
export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  const snap = await firestore.collection(FLAGS_COLLECTION).get().catch(() => null);
  const flags = (snap?.docs ?? [])
    .map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        severity: (x.severity as string) ?? "low",
        status: (x.status as string) ?? "open",
        contractId: (x.contractId as string) ?? "",
        raterEmail: maskEmail((x.raterEmail as string) ?? ""),
        subjectEmail: maskEmail((x.subjectEmail as string) ?? ""),
        signals: (x.signals as { code: string; detail: string }[]) ?? [],
        createdAt: (x.createdAt as string) ?? "",
      };
    })
    .sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (b.status === "open" && a.status !== "open") return 1;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });

  return NextResponse.json({ success: true, flags, openCount: flags.filter((f) => f.status === "open").length });
}

const patchSchema = z.object({ id: z.string().min(1), status: z.enum(["open", "reviewed", "dismissed"]) });

export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
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
  await firestore.collection(FLAGS_COLLECTION).doc(parsed.data.id).set(
    { status: parsed.data.status, reviewedByEmail: auth.user.email, reviewedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return NextResponse.json({ success: true, status: parsed.data.status });
}
