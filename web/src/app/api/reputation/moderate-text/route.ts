import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { moderateFreeText } from "@/lib/ai/moderateText";

export const runtime = "nodejs";

/**
 * Pre-chequeo de moderación para el cliente: dado un texto, dice si es aceptable.
 * Se usa para BLOQUEAR el botón de "enviar réplica" mientras el texto sea
 * ofensivo. La decisión definitiva la vuelve a validar el endpoint de réplica.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = (body?.text ?? "").slice(0, 2000);
  const mod = await moderateFreeText(text);
  return NextResponse.json({ success: true, allowed: mod.allowed, reason: mod.reason ?? null });
}
