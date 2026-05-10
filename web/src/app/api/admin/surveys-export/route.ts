import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  LEAD_FORM_CSV_HEADERS,
  labelAppInterestAnswer,
  labelContactConsent,
  labelMainConcernAnswer,
  labelMostValuableModuleAnswer,
  labelPropertyStatusAnswer,
  labelQ4NoReason,
  labelRentalChannelAnswer,
  labelSourcePage,
  labelWillingnessToPayAnswer,
} from "@/lib/validations/lead-form-export-labels";

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

  const lines = [[...LEAD_FORM_CSV_HEADERS].map((h) => csvCell(h)).join(",")];
  for (const d of snap.docs) {
    const x = d.data() as Record<string, unknown>;
    const sp = x.sourcePage;
    const ps = x.propertyStatusAnswer;
    const rc = x.rentalChannelAnswer;
    const mc = x.mainConcernAnswer;
    const ai = x.appInterestAnswer;
    const q4r = x.q4NoReason;
    const wt = x.willingnessToPayAnswer;
    const mv = x.mostValuableModuleAnswer;
    lines.push(
      [
        csvCell(d.id),
        csvCell(iso(x.createdAt) || iso(x.createdAtServer)),
        csvCell(x.email),
        csvCell(labelSourcePage(sp)),
        csvCell(sp),
        csvCell(labelPropertyStatusAnswer(ps)),
        csvCell(ps),
        csvCell(labelRentalChannelAnswer(rc)),
        csvCell(rc),
        csvCell(labelMainConcernAnswer(mc)),
        csvCell(mc),
        csvCell(labelAppInterestAnswer(ai)),
        csvCell(ai),
        csvCell(labelQ4NoReason(q4r)),
        csvCell(q4r),
        csvCell(x.q4NoReasonOther),
        csvCell(labelWillingnessToPayAnswer(wt)),
        csvCell(wt),
        csvCell(labelMostValuableModuleAnswer(mv)),
        csvCell(mv),
        csvCell(x.mostValuableModuleOther),
        csvCell(labelContactConsent(x.contactConsent)),
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
