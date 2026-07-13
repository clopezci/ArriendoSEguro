"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Script de Google AdSense (adsbygoogle.js). Es lo que Google busca en el sitio
 * para verificar la propiedad y habilitar los anuncios automáticos tras aprobar.
 *
 * El ID NO se pega en el código: se usa `NEXT_PUBLIC_ADSENSE_CLIENT_ID` en Vercel
 * (Producción), con el formato `ca-pub-XXXXXXXXXXXXXXXX`. Si no está configurado,
 * no se carga nada (el sitio funciona igual, sin anuncios).
 *
 * Publicidad SOLO en superficies gratuitas (blog, calculadoras, plantillas,
 * landing, legales). En el flujo de contrato y áreas de pago NO se carga el
 * script, para que no aparezcan anuncios automáticos ahí.
 */
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || "ca-pub-7622431410037127";

// Prefijos de rutas de PAGO / flujo del contrato donde NO debe cargar publicidad.
const NO_ADS_PREFIXES = ["/dashboard", "/panel", "/nuevo", "/invitacion", "/pago", "/firma", "/ingresar", "/registro", "/admin", "/interno"];

export function AdSense() {
  const pathname = usePathname();
  if (!ADSENSE_CLIENT || !/^ca-pub-\d{10,}$/i.test(ADSENSE_CLIENT)) return null;
  if (pathname && NO_ADS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p))) return null;

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
