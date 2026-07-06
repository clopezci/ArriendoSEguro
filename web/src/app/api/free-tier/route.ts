import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getFreeTierForPublicPages } from "@/domain/platform-payments/free-tier";

export const runtime = "nodejs";

/** Configuración pública del tier gratis (sin autenticación). */
export async function GET() {
  const firestore = getAdminFirestore();
  const ft = await getFreeTierForPublicPages(firestore);
  return NextResponse.json({
    success: true,
    enabled: ft.enabled,
    label: ft.label,
    message: ft.message,
  });
}
