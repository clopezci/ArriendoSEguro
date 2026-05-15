import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { LegalFooter } from "@/components/layout/legal-footer";
import { PwaRegister } from "@/components/pwa-register";
import { AppProviders } from "@/components/providers/app-providers";
import { appConfig } from "@/lib/config";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.publicUrl),
  manifest: "/manifest.webmanifest",
  title: {
    default: `${appConfig.name} | Arriendo entre personas en Colombia`,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.seoDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        <GoogleAnalytics />
        <PwaRegister />
        <AppProviders>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <LegalFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
