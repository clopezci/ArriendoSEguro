import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";
import Link from "next/link";
import { LandingPublicHeader } from "@/components/landing/landing-public-header";
import { TEMPLATES } from "@/content/templates/templates";

export const metadata: Metadata = {
  title: "Plantillas de arriendo gratis para descargar | ArriendoSeguro",
  description:
    "Modelos gratuitos para arriendo en Colombia: carta de preaviso, paz y salvo, acta de entrega y autorización de tratamiento de datos. Con fundamento legal, listos para imprimir.",
  alternates: { canonical: "/plantillas" },
  keywords: [
    "plantillas arriendo gratis",
    "carta preaviso arriendo",
    "paz y salvo arriendo",
    "acta de entrega inmueble",
    "autorización tratamiento de datos",
  ],
};

export default function PlantillasIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBackNav />
      <LandingPublicHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
            GRATIS
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Plantillas y descargas</h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            Modelos orientativos con fundamento legal, listos para imprimir o guardar como PDF. Diligéncialos y fírmalos
            según tu caso. No sustituyen asesoría jurídica.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <Link
              key={t.slug}
              href={`/plantillas/${t.slug}`}
              className="flex flex-col rounded-2xl border border-slate-300 bg-white/70 p-5 shadow-sm transition hover:border-violet-400 hover:shadow-[0_10px_24px_rgba(139,92,246,0.18)]"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">{t.category}</span>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{t.docTitle}</h2>
              <p className="mt-2 flex-1 text-sm text-slate-700">{t.description}</p>
              <span className="mt-3 inline-block text-sm font-medium text-violet-700">Abrir y descargar →</span>
            </Link>
          ))}
        </section>

        <p className="text-sm text-slate-600">
          ¿Prefieres todo formalizado en un solo flujo?{" "}
          <Link href="/nuevo" className="text-violet-700 underline">
            Crea tu contrato gratis
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
