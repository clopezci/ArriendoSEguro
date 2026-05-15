import { LeadMarketForm } from "@/components/forms/lead-market-form";
import {
  CONTRACT_EARLY_BIRD_PRICE_COP,
  CONTRACT_LIST_PRICE_COP,
  formatCopPlain,
  PER_CONTRACT_PAYMENT_NOTICE,
} from "@/lib/product-pricing";
import { LandingPublicHeader } from "@/components/landing/landing-public-header";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Encuesta de validación | ArriendoSeguro",
  description:
    "Responde la encuesta corta de ArriendoSeguro y ayúdanos a priorizar la fase inicial del producto para arriendos entre particulares en Colombia.",
  robots: { index: true, follow: true },
};

export default function EncuestaPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingPublicHeader surveyHref="/encuesta" />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="mb-4 text-center text-sm text-slate-600 sm:text-left">
          <Link href="/" className="font-medium text-violet-700 hover:underline">
            ← Volver a la página principal
          </Link>
        </p>

        <header className="mb-6 space-y-2 text-center sm:text-left">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Validación de interés
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Estamos validando ArriendoSeguro, una plataforma para formalizar arriendos ya acordados entre
            personas particulares. Tus respuestas nos ayudan a construir una solución útil, clara y de bajo
            costo.
          </p>
          <p className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs leading-snug text-violet-800 sm:justify-start">
            <span className="inline-flex items-center rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm shadow-violet-500/40">
              ¡Cupos limitados!
            </span>
            <span>
              Los primeros en inscribirse acceden a{" "}
              <strong className="font-semibold text-slate-900">
                {formatCopPlain(CONTRACT_EARLY_BIRD_PRICE_COP)}
              </strong>{" "}
              por contrato en la plataforma (lista{" "}
              <strong className="font-semibold text-slate-900">
                {formatCopPlain(CONTRACT_LIST_PRICE_COP)}
              </strong>
              ), mientras dure la promoción.
            </span>
          </p>
          <p className="text-xs leading-relaxed text-slate-600">{PER_CONTRACT_PAYMENT_NOTICE}</p>
        </header>

        <LeadMarketForm sourcePage="landing_fase_inicial" />
      </main>
    </div>
  );
}
