import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * GA4 vía gtag.js: mismo comportamiento que el snippet que muestra Google Analytics
 * (script a googletagmanager.com + dataLayer + gtag('config', ID)), usando `next/script`.
 *
 * No pegues el ID en el código: usa `NEXT_PUBLIC_GA_MEASUREMENT_ID` en Vercel (Producción)
 * o en `.env.local` y vuelve a desplegar para que el build inyecte el valor.
 */
export function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-gtag" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');
`}
      </Script>
    </>
  );
}
