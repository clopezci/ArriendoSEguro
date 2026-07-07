import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";
import Link from "next/link";
import { JsonLdScript } from "@/components/blog/json-ld";
import { absoluteUrl } from "@/content/blog/seo";
import { NoticePeriodCalculator } from "@/components/calculators/notice-period-calculator";

export const metadata: Metadata = {
  title: "Calculadora de preaviso de 3 meses en arriendo (Ley 820)",
  description:
    "Calcula la fecha límite para avisar la terminación de tu contrato de arriendo con el preaviso de tres meses que exige la Ley 820 de 2003. Evita la renovación automática.",
  alternates: { canonical: "/calculadoras/preaviso" },
  keywords: [
    "preaviso arriendo 3 meses",
    "terminación contrato arrendamiento",
    "renovación automática arriendo",
    "Ley 820 preaviso",
  ],
};

export default function PreavisoPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculadora de preaviso de 3 meses (Ley 820)",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "COP" },
    url: absoluteUrl("/calculadoras/preaviso"),
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
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Calculadora de preaviso de 3 meses</h1>
            <p className="mt-3 text-slate-700">
              Para terminar el contrato al vencimiento, la Ley 820 de 2003 exige avisar con al menos tres meses de
              anticipación. Calcula tu fecha límite para no quedar atado a una renovación automática.
            </p>
          </header>

          <NoticePeriodCalculator />

          <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 text-sm text-slate-700">
            <h2 className="text-lg font-semibold text-slate-900">Más sobre la terminación</h2>
            <p className="mt-2">
              Causales, indemnización y reglas del preaviso en la{" "}
              <Link
                href="/blog/terminacion-contrato-arriendo-preaviso-causales"
                className="text-violet-700 underline"
              >
                guía de terminación del contrato
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
    </>
  );
}
