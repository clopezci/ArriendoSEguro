import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";

export const runtime = "nodejs";

function iso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return "";
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
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

  let snap;
  try {
    snap = await firestore.collection("lead_forms").orderBy("createdAt", "desc").limit(2000).get();
  } catch {
    try {
      snap = await firestore.collection("lead_forms").limit(2000).get();
    } catch {
      return NextResponse.json(
        { success: false, errors: [{ field: "server", message: "No se pudo leer lead_forms." }] },
        { status: 500 },
      );
    }
  }

  const header = [
    "id",
    "createdAt",
    "email",
    "sourcePage",
    "propertyStatusAnswer",
    "rentalChannelAnswer",
    "mainConcernAnswer",
    "appInterestAnswer",
    "q4NoReason",
    "q4NoReasonOther",
    "willingnessToPayAnswer",
    "mostValuableModuleAnswer",
    "mostValuableModuleOther",
    "contactConsent",
    "userAgent",
  ];

  const lines = [header.join(",")];
  for (const d of snap.docs) {
    const x = d.data() as Record<string, unknown>;
    lines.push(
      [
        csvCell(d.id),
        csvCell(iso(x.createdAt) || iso(x.createdAtServer)),
        csvCell(x.email),
        csvCell(x.sourcePage),
        csvCell(x.propertyStatusAnswer),
        csvCell(x.rentalChannelAnswer),
        csvCell(x.mainConcernAnswer),
        csvCell(x.appInterestAnswer),
        csvCell(x.q4NoReason),
        csvCell(x.q4NoReasonOther),
        csvCell(x.willingnessToPayAnswer),
        csvCell(x.mostValuableModuleAnswer),
        csvCell(x.mostValuableModuleOther),
        csvCell(x.contactConsent),
        csvCell(x.userAgent),
      ].join(","),
    );
  }

  const csv = lines.join("\r\n");
  return new NextResponse("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="arriendoseguro-encuestas.csv"',
      "Cache-Control": "no-store",
    },
  });
}
