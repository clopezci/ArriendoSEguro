import Script from "next/script";

/**
 * Script de Google AdSense (adsbygoogle.js). Es lo que Google busca en el sitio
 * para verificar la propiedad y habilitar los anuncios automáticos tras aprobar.
 *
 * El ID NO se pega en el código: se usa `NEXT_PUBLIC_ADSENSE_CLIENT_ID` en Vercel
 * (Producción), con el formato `ca-pub-XXXXXXXXXXXXXXXX`. Si no está configurado,
 * no se carga nada (el sitio funciona igual, sin anuncios).
 */
// El publisher ID es público (aparece en ads.txt y en el propio script). Se deja
// como valor por defecto para que la verificación funcione sin configurar Vercel;
// se puede sobrescribir con NEXT_PUBLIC_ADSENSE_CLIENT_ID si algún día cambia.
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || "ca-pub-7622431410037127";

export function AdSense() {
  if (!ADSENSE_CLIENT || !/^ca-pub-\d{10,}$/i.test(ADSENSE_CLIENT)) return null;

  return (
    <Script
      id="adsbygoogle-init"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
