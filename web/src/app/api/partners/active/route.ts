import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { PARTNERS_COLLECTION } from "@/domain/partners/partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aliados activos para mostrar al usuario. NUNCA expone los correos de contacto
 * (`contactEmails`): esos solo se usan en el servidor al enviar el lead.
 */
export async function GET() {
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: true, partners: [] });

  const snap = await firestore
    .collection(PARTNERS_COLLECTION)
    .where("active", "==", true)
    .get()
    .catch(() => null);

  const partners = (snap?.docs ?? []).map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      name: String(x.name ?? ""),
      category: String(x.category ?? "otro"),
      description: String(x.description ?? ""),
      websiteUrl: String(x.websiteUrl ?? ""),
    };
  });

  return NextResponse.json({ success: true, partners });
}
