import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { CONTRACT_SURVEYS_COLLECTION } from "@/lib/surveys/contract-surveys";

export const runtime = "nodejs";

/** Resultados de la encuesta de satisfacción post-contrato (#5), para /admin. */
export async function GET(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "Firestore no configurado." }, { status: 503 });
  }

  let snap;
  try {
    snap = await firestore.collection(CONTRACT_SURVEYS_COLLECTION).orderBy("createdAt", "desc").limit(1000).get();
  } catch {
    snap = await firestore.collection(CONTRACT_SURVEYS_COLLECTION).limit(1000).get();
  }

  const rows = snap.docs.map((d) => d.data() as Record<string, unknown>);
  const total = rows.length;
  const count = (k: string) => rows.filter((r) => r[k] === true).length;
  const easyYes = count("easy");
  const likedYes = count("liked");
  const recommendYes = count("recommend");
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const recent = rows.slice(0, 100).map((r) => ({
    createdAt: String(r.createdAt ?? ""),
    easy: r.easy === true,
    liked: r.liked === true,
    recommend: r.recommend === true,
    respondentEmail: (r.respondentEmail as string) ?? null,
    contractId: (r.contractId as string) ?? null,
  }));

  return NextResponse.json({
    success: true,
    total,
    metrics: {
      easy: { yes: easyYes, pct: pct(easyYes) },
      liked: { yes: likedYes, pct: pct(likedYes) },
      recommend: { yes: recommendYes, pct: pct(recommendYes) },
    },
    recent,
  });
}
