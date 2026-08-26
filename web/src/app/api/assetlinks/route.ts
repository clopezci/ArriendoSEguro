import { NextResponse } from "next/server";

/**
 * Digital Asset Links para la app Android (TWA). Enlaza el paquete + la(s)
 * huella(s) SHA-256 de la firma con este dominio, para que la app corra a
 * pantalla completa (sin la barra de URL de Chrome).
 *
 * Se sirve en `/.well-known/assetlinks.json` vía un rewrite en next.config.
 *
 * Rellena en Vercel (sin tocar código):
 *  - ANDROID_PACKAGE_NAME  (por defecto: app.arriendoseguro.twa)
 *  - ANDROID_CERT_SHA256_FINGERPRINTS  = huellas SHA-256 separadas por coma.
 *    Debes poner DOS: (1) la de la firma que generó PWABuilder/Bubblewrap y
 *    (2) la de "Play App Signing" que te muestra Google Play Console. Con las
 *    dos, la app abre sin barra de direcciones en todos los casos.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || "app.arriendoseguro.twa";
  const fingerprints = (process.env.ANDROID_CERT_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(body, {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
