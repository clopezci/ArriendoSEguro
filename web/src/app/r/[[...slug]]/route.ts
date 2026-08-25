import { NextResponse, type NextRequest } from "next/server";

/**
 * Enlaces cortos de campaña EN TU PROPIO DOMINIO. En vez de compartir una URL
 * larga con `?utm_source=...&utm_medium=...&utm_campaign=...` (que genera
 * desconfianza), compartes algo corto como:
 *
 *   https://arriendoseguro.app/r/fbp/lanzamiento_agosto
 *
 * y esto redirige (302) al enlace real con los UTMs, para que GA4 clasifique la
 * visita por fuente/medio/campaña. El dominio visible sigue siendo el tuyo.
 *
 * Formato:  /r/<código-de-fuente>/<nombre-campaña?>
 *   fbp = Facebook pago     · igp = Instagram pago
 *   fbo = Facebook orgánico · igo = Instagram orgánico
 *   g   = Google (cpc)      · wa  = WhatsApp/mensaje
 */
const SOURCE_MAP: Record<string, { source: string; medium: string }> = {
  fbp: { source: "facebook", medium: "paid" },
  igp: { source: "instagram", medium: "paid" },
  fbo: { source: "facebook", medium: "social" },
  igo: { source: "instagram", medium: "social" },
  g: { source: "google", medium: "cpc" },
  wa: { source: "whatsapp", medium: "referral" },
};

function sanitize(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60);
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug: slugParam } = await ctx.params;
  const slug = slugParam ?? [];
  const code = (slug[0] ?? "").toLowerCase();
  const campaign = slug[1] ? sanitize(slug[1]) : "";

  const dest = new URL("/", request.nextUrl.origin);
  const map = SOURCE_MAP[code];
  if (map) {
    dest.searchParams.set("utm_source", map.source);
    dest.searchParams.set("utm_medium", map.medium);
    if (campaign) dest.searchParams.set("utm_campaign", campaign);
  }
  // 302 (temporal): no queremos que se cachee como permanente.
  return NextResponse.redirect(dest, 302);
}
