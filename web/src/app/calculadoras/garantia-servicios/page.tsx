import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";
import Link from "next/link";
import { JsonLdScript } from "@/components/blog/json-ld";
import { absoluteUrl } from "@/content/blog/seo";
import { UtilityGuaranteeCalculator } from "@/components/calculators/utility-guarantee-calculator";

export const metadata: Metadata = {
  title: "Calculadora de garantía de servicios públicos en arriendo (Art. 15)",
  description:
    "Calcula el máximo que se puede pedir como garantía de servicios públicos en un arriendo de vivienda urbana: el valor de los dos últimos períodos (Ley 820 de 2003, art. 15).",
  alternates: { canonical: "/calculadoras/garantia-servicios" },
  keywords: ["garantía servicios públicos arriendo", "depósito arriendo Colombia", "Ley 820 artículo 15"],
};

export default function GarantiaServiciosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculadora de garantía de servicios públicos (Art. 15)",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "COP" },
    url: absoluteUrl("/calculadoras/garantia-servicios"),
    inLanguage: "es-CO",
  };

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <TopBackNav backHref="/calculadoras" backLabel="Volver a calculadoras" />
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
          <nav className="text-sm">
            <Link href="/calculadoras" className="text-violet-700 hover:underline">
              ← Calculadoras
            </Link>
          </nav>
          <header>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Calculadora de garantía de servicios públicos
            </h1>
            <p className="mt-3 text-slate-700">
              Es la única garantía permitida en vivienda urbana, exclusiva para servicios públicos. Su valor no puede
              exceder la suma de los dos últimos períodos de facturación (Ley 820 de 2003, art. 15).
            </p>
          </header>

          <UtilityGuaranteeCalculator />

          <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 text-sm text-slate-700">
            <h2 className="text-lg font-semibold text-slate-900">Garantía sí, depósito general no</h2>
            <p className="mt-2">
              En vivienda urbana está prohibido el depósito en dinero o caución real general (art. 16); la excepción es
              esta garantía exclusiva para servicios públicos. Más en la{" "}
              <Link href="/blog/servicios-publicos-arriendo-evitar-deudas" className="text-violet-700 underline">
                guía de servicios públicos
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
    </>
  );
}
