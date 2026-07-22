import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { AdSense } from "@/components/analytics/adsense";
import { ConsentMode } from "@/components/consent/consent-mode";
import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import { ClientErrorReporter } from "@/components/observability/client-error-reporter";
import { LegalFooter } from "@/components/layout/legal-footer";
import { PwaInstallSiteBanner } from "@/components/pwa/pwa-install-site-banner";
import { PwaRegister } from "@/components/pwa-register";
import { AppProviders } from "@/components/providers/app-providers";
import { ReadAloudProvider } from "@/components/a11y/read-aloud";
import { ReferralTracker } from "@/components/referrals/referral-tracker";
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
      { url: "/images/arriendoseguro-social-profile.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/images/arriendoseguro-social-profile.png", sizes: "512x512" }],
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
        <ConsentMode />
        <GoogleAnalytics />
        <AdSense />
        <ClientErrorReporter />
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
          </ReadAloudProvider>
        </AppProviders>
        {/* Métricas reales de rendimiento (Core Web Vitals) en Vercel; no-op fuera de Vercel. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
