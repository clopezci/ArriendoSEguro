import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { AdSense } from "@/components/analytics/adsense";
import { ConsentMode } from "@/components/consent/consent-mode";
import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import { ClientErrorReporter } from "@/components/observability/client-error-reporter";
import { PageviewBeacon } from "@/components/analytics/pageview-beacon";
import { LegalFooter } from "@/components/layout/legal-footer";
import { PwaInstallSiteBanner } from "@/components/pwa/pwa-install-site-banner";
import { PwaRegister } from "@/components/pwa-register";
import { AppProviders } from "@/components/providers/app-providers";
import { ReadAloudProvider } from "@/components/a11y/read-aloud";
import { ReferralTracker } from "@/components/referrals/referral-tracker";
import { ExitIntentSurvey } from "@/components/analytics/exit-intent-survey";
import { VoiceGuide } from "@/components/voice/voice-guide";
import { NoContextMenu } from "@/components/ui/no-context-menu";
import { appConfig } from "@/lib/config";
import Script from "next/script";
import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Blindaje contra extensiones de traducción (Google Translate y similares): al
 * traducir, envuelven textos en <font> y descolocan los nodos que React maneja,
 * lo que provoca "Failed to execute 'insertBefore'/'removeChild' … not a child".
 * Este parche hace que esos dos métodos NO lancen cuando el nodo ya no es hijo,
 * evitando que la app se caiga para quien traduce la página. No afecta el uso
 * normal (solo cambia el caso que de todos modos iba a fallar).
 */
const TRANSLATE_DOM_GUARD = `(function(){try{var N=typeof Node==='function'&&Node.prototype;if(!N)return;var r=N.removeChild;N.removeChild=function(c){if(c&&c.parentNode!==this){return c;}return r.apply(this,arguments);};var i=N.insertBefore;N.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this){return n;}return i.apply(this,arguments);};}catch(e){}})();`;

/**
 * Recuperación automática de "Loading chunk … failed" (ChunkLoadError). Tras un
 * despliegue, los .js cambian de hash; un navegador con la página vieja abierta
 * pide un chunk que ya no existe (o se demora → "timeout") y la navegación se
 * rompe. Este guard detecta ese error y recarga la página UNA sola vez para
 * traer el HTML nuevo con los hashes correctos. Tope de 2 recargas por sesión y
 * throttle de 20 s para no entrar en bucle si un chunk quedara realmente 404.
 */
const CHUNK_RELOAD_GUARD = `(function(){try{var K='__as_chunk_reload__';function chunkErr(m){return typeof m==='string'&&(/Loading chunk[^]*failed/i.test(m)||/Loading CSS chunk/i.test(m)||/ChunkLoadError/i.test(m)||/error loading dynamically imported module/i.test(m)||/Failed to fetch dynamically imported module/i.test(m));}function reload(){try{var raw=(sessionStorage.getItem(K)||'0:0').split(':');var n=parseInt(raw[0],10)||0;var t=parseInt(raw[1],10)||0;var now=Date.now();if(now-t<20000)return;if(n>=2)return;sessionStorage.setItem(K,(n+1)+':'+now);}catch(e){}try{location.reload();}catch(e){}}window.addEventListener('error',function(e){try{var name=e&&e.error&&e.error.name;var msg=(e&&(e.message||(e.error&&e.error.message)))||'';if(name==='ChunkLoadError'||chunkErr(msg))reload();}catch(_){}} ,true);window.addEventListener('unhandledrejection',function(e){try{var r=e&&e.reason;var name=r&&r.name;var msg=r&&(r.message||String(r))||'';if(name==='ChunkLoadError'||chunkErr(msg))reload();}catch(_){}} );}catch(e){}})();`;

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const viewport: Viewport = {
  themeColor: "#6d28d9",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.publicUrl),
  manifest: "/manifest.webmanifest",
  title: {
    default: `${appConfig.name} | Arriendo entre personas en Colombia`,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.seoDescription,
  applicationName: appConfig.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appConfig.name,
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Verificación de propiedad de Google AdSense (uno de los 3 métodos).
  other: { "google-adsense-account": "ca-pub-7622431410037127" },
  // Verificación de propiedad en Google Search Console (pega el valor del
  // método "etiqueta HTML" en NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION en Vercel).
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        <Script id="translate-dom-guard" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: TRANSLATE_DOM_GUARD }} />
        <Script id="chunk-reload-guard" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: CHUNK_RELOAD_GUARD }} />
        <ConsentMode />
        <GoogleAnalytics />
        <AdSense />
        <ClientErrorReporter />
        <PageviewBeacon />
        <PwaRegister />
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <AppProviders>
          <ReadAloudProvider>
            <ReferralTracker />
            <div className="flex min-h-screen flex-col">
              <div id="contenido" tabIndex={-1} className="flex-1">
                {children}
              </div>
              <LegalFooter />
            </div>
            <PwaInstallSiteBanner />
            <CookieConsentBanner />
            <ExitIntentSurvey />
            <VoiceGuide />
            <NoContextMenu />
          </ReadAloudProvider>
        </AppProviders>
        {/* Métricas reales de rendimiento (Core Web Vitals) en Vercel; no-op fuera de Vercel. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
