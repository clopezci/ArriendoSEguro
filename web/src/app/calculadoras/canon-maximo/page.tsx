import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "@/components/blog/json-ld";
import { absoluteUrl } from "@/content/blog/seo";
import { RentCapCalculator } from "@/components/calculators/rent-cap-calculator";

export const metadata: Metadata = {
  title: "Calculadora del canon máximo legal (1 % del valor comercial)",
  description:
    "Calcula el canon mensual máximo permitido para vivienda urbana en Colombia: 1 % del valor comercial del inmueble (Ley 820 de 2003, art. 18). Gratis.",
  alternates: { canonical: "/calculadoras/canon-maximo" },
  keywords: ["canon máximo arriendo", "1 por ciento valor comercial", "Ley 820 artículo 18", "cuánto cobrar de arriendo"],
};

export default function CanonMaximoPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculadora del canon máximo legal (1 %)",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "COP" },
    url: absoluteUrl("/calculadoras/canon-maximo"),
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
              Calculadora del canon máximo legal
            </h1>
            <p className="mt-3 text-slate-700">
              En vivienda urbana, el canon mensual no puede exceder el 1 % del valor comercial del inmueble (Ley 820 de
              2003, art. 18). Calcula el tope con el valor de tu inmueble.
            </p>
          </header>

          <RentCapCalculator />

          <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 text-sm text-slate-700">
            <h2 className="text-lg font-semibold text-slate-900">Sobre el tope del canon</h2>
            <p className="mt-2">
              El valor comercial debe ser real; cuando hay avalúo catastral, no debería superar 2 veces ese avalúo.
              Aprende más en el{" "}
              <Link href="/blog/canon-arriendo-tope-1-porciento-valor-comercial" className="text-violet-700 underline">
                artículo sobre el canon y el tope del 1 %
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
    </>
  );
}
