import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAdsConfigForPublicPages } from "@/domain/ads/ads-config";

export const runtime = "nodejs";

/** Configuración pública de anuncios (sin autenticación). */
export async function GET() {
  const firestore = getAdminFirestore();
  const cfg = await getAdsConfigForPublicPages(firestore);
  return NextResponse.json({ success: true, ...cfg });
}
