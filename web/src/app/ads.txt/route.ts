/**
 * ads.txt para Google AdSense. Google exige este archivo en la raíz del dominio
 * (https://arriendoseguro.app/ads.txt) para autorizar la venta de inventario.
 *
 * El ID de editor NO se pega en el código: se lee de la variable de entorno
 * `ADSENSE_PUBLISHER_ID` en Vercel (Producción). Acepta el ID con o sin el
 * prefijo `ca-` (p. ej. `pub-1234567890123456` o `ca-pub-1234567890123456`).
 * Mientras no esté configurada, se sirve un comentario (Google verá que el
 * archivo existe pero pedirá el ID cuando lo configures).
 */
export const dynamic = "force-dynamic";

export function GET() {
  // Publisher ID público, precargado por defecto (sobrescribible con la variable
  // de entorno ADSENSE_PUBLISHER_ID si algún día cambia de cuenta).
  const raw = process.env.ADSENSE_PUBLISHER_ID?.trim() || "pub-7622431410037127";
  const pub = raw.replace(/^ca-/i, ""); // ads.txt usa "pub-...", no "ca-pub-..."
  const body = /^pub-\d{10,}$/i.test(pub)
    ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`
    : "# ads.txt: configura la variable de entorno ADSENSE_PUBLISHER_ID (pub-XXXXXXXXXXXXXXXX) en Vercel para habilitar AdSense.\n";

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
