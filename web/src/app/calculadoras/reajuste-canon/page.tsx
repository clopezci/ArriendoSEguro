import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "@/components/blog/json-ld";
import { absoluteUrl } from "@/content/blog/seo";
import { RentIpcCalculator } from "@/components/calculators/rent-ipc-calculator";

export const metadata: Metadata = {
  title: "Calculadora de reajuste del canon de arriendo por IPC",
  description:
    "Calcula cuánto puede subir tu arriendo este año según el IPC del año anterior (Ley 820 de 2003, art. 20). Gratis y sin registro.",
  alternates: { canonical: "/calculadoras/reajuste-canon" },
  keywords: ["reajuste canon arrendamiento", "cuánto puede subir el arriendo", "IPC 2025", "Ley 820 artículo 20"],
};

export default function ReajusteCanonPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculadora de reajuste del canon por IPC",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "COP" },
    url: absoluteUrl("/calculadoras/reajuste-canon"),
    inLanguage: "es-CO",
  };

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
          <nav className="text-sm">
            <Link href="/calculadoras" className="text-violet-700 hover:underline">
              ← Calculadoras
            </Link>
          </nav>
          <header>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Calculadora de reajuste del canon por IPC
            </h1>
            <p className="mt-3 text-slate-700">
              ¿Cuánto puede subir tu arriendo este año? El incremento máximo es el IPC del año calendario anterior, al
              cumplir 12 meses de contrato (Ley 820 de 2003, art. 20).
            </p>
          </header>

          <RentIpcCalculator />

          <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 text-sm text-slate-700">
            <h2 className="text-lg font-semibold text-slate-900">Cómo funciona el reajuste</h2>
            <p className="mt-2">
              El arrendador puede aumentar el canon una vez cumplidos 12 meses bajo el mismo precio, hasta el 100 % del
              IPC del año anterior, e informando el monto y la fecha. Más detalle en la{" "}
              <Link href="/blog/reajuste-canon-arrendamiento-ipc-2026" className="text-violet-700 underline">
                guía de reajuste del canon
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
    </>
  );
}
