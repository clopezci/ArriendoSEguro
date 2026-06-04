import { BlogTopicLinks } from "@/components/landing/blog-topic-links";
import { freeTierEnabled } from "@/lib/config";
import { formatCopPlain, PER_CONTRACT_PAYMENT_NOTICE } from "@/lib/product-pricing";
import { getPlanPlusPricingForPublicPages } from "@/domain/platform-payments/plan-plus-pricing";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { LandingPublicHeader } from "@/components/landing/landing-public-header";
import { LandingInstallApp } from "@/components/landing/landing-install-app";
import { LandingStepsSection } from "@/components/landing/landing-steps-section";
import { SurveyFloatingCta } from "@/components/landing/survey-floating-cta";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contrato de arrendamiento en Colombia | ArriendoSeguro",
  description:
    "Formaliza tu contrato de arrendamiento en Colombia con firma electrónica, inventario fotográfico, registro de pagos y trazabilidad documental para arriendos entre particulares.",
  keywords: [
    "contrato de arrendamiento",
    "contrato de arriendo",
    "arrendar sin inmobiliaria",
    "arriendo directo",
    "arrendamiento entre particulares",
    "firma electrónica",
    "inventario fotográfico",
    "registro de pagos",
    "Colombia",
  ],
  openGraph: {
    title: "Contrato de arrendamiento en Colombia | ArriendoSeguro - AS",
    description:
      "Formaliza tu contrato de arriendo con firma electrónica, inventario y registro de pagos, sin inmobiliaria y sin dejarlo informal.",
    type: "website",
    locale: "es_CO",
  },
};

export default async function Home() {
  const firestore = getAdminFirestore();
  const pricing = await getPlanPlusPricingForPublicPages(firestore);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingPublicHeader />

      <main className="relative mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6 sm:pb-28 sm:pt-6">
        <div className="flex flex-col gap-5 sm:gap-6">
          <section className="space-y-4">
            <h1 className="text-balance text-center text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl lg:text-left">
              <span className="block">¿Vas a arrendar?</span>
              <span className="mt-0.5 block">¿Necesitas hacer tu contrato de arrendamiento?</span>
            </h1>
            <p className="rounded-xl border border-violet-400 bg-violet-100 px-4 py-3 text-center text-base font-semibold leading-snug text-violet-800 shadow-[0_6px_24px_rgba(139,92,246,0.18)] sm:text-lg sm:leading-snug lg:text-left lg:text-[1.05rem]">
              Si prefieres evitar los costos de una agencia y te preocupa hacer un arriendo directo sin
              suficiente respaldo… llegaste al lugar adecuado.
            </p>

            {freeTierEnabled && (
              <p className="rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-3 text-center text-base font-bold leading-snug text-emerald-800 shadow-[0_6px_24px_rgba(16,185,129,0.16)] sm:text-lg lg:text-left">
                Genera tu contrato de arrendamiento <span className="underline">gratis</span>. La firma
                electrónica, el inventario y todo el respaldo se activan con Plan Plus, por una fracción
                de lo que cuesta un mal arriendo.
              </p>
            )}

            <LandingStepsSection />

            <div className="space-y-2 text-center text-sm leading-snug text-slate-700 sm:text-[0.95rem] lg:text-left">
              <p>
                ArriendoSeguro es una plataforma digital para arriendos en Colombia que ayuda a formalizar
                un arrendamiento entre particulares.
              </p>
              <p>
                Crea tu contrato de arriendo con firma electrónica, inventario fotográfico, registro de
                pagos, notificaciones, calificación de la experiencia y trazabilidad documental, sin pago de
                mensualidades. Todo en un solo flujo, pensado para quienes quieren arrendar sin inmobiliaria
                y sin dejarlo informal.
              </p>
            </div>
            <section
              aria-labelledby="instalar-app-heading"
              className="rounded-xl border border-violet-300/90 bg-gradient-to-br from-violet-50 to-white p-4 shadow-[0_8px_28px_rgba(139,92,246,0.14)] sm:p-5"
            >
              <h2
                id="instalar-app-heading"
                className="text-center text-base font-bold text-slate-900 sm:text-lg lg:text-left"
              >
                Instala ArriendoSeguro en tu dispositivo
              </h2>
              <p className="mt-2 text-center text-sm leading-relaxed text-slate-600 lg:text-left">
                Celular, tablet o computador: agrega un acceso directo en tu pantalla de inicio para entrar al
                panel, contratos y expedientes con un solo toque.
              </p>
              <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-start">
                <LandingInstallApp className="w-full sm:w-auto" />
                <Link
                  href="/ingresar"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-violet-400 sm:w-auto"
                >
                  Ya tengo cuenta — ingresar
                </Link>
              </div>
            </section>

            <div className="flex justify-center lg:justify-start">
              <Link
                href="/entiendelo-facil"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 shadow-[0_0_0_1px_rgba(139,92,246,0.2)] transition hover:border-sky-500/60 hover:text-sky-800"
              >
                Entender cómo funciona
              </Link>
            </div>
          </section>

          <BlogTopicLinks />

          <p className="flex flex-wrap items-center justify-center gap-2 text-[11px] leading-snug text-slate-600 lg:justify-start">
            <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-100/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              Próximamente
            </span>
            <span>
              Convenios con <strong className="font-semibold text-slate-800">aseguradoras</strong>,{" "}
              <strong className="font-semibold text-slate-800">asesoría legal</strong>,{" "}
              <strong className="font-semibold text-slate-800">agencias de cobranza</strong> y otros aliados,
              por si en algún momento necesitas ir un paso más allá.
            </span>
          </p>

          <section className="space-y-2 rounded-lg border border-slate-300 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.06)] sm:p-4">
            <h2 className="text-center text-sm font-semibold text-slate-900 sm:text-base lg:text-left">
              Ayúdanos a construir una solución útil para arrendar mejor
            </h2>
            <p className="text-center text-xs leading-relaxed text-slate-600 lg:text-left">
              Estamos validando ArriendoSeguro con propietarios y arrendatarios reales. Tu opinión define
              qué priorizamos en la fase inicial.
            </p>
            <p className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs leading-snug text-violet-800 lg:justify-start">
              <span className="inline-flex items-center rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm shadow-violet-500/40">
                ¡Cupos limitados!
              </span>
              <span>
                {pricing.checkoutCop < pricing.listCompareCop ? (
                  <>
                    Los primeros en inscribirse en la encuesta acceden a{" "}
                    <strong className="font-semibold text-slate-900">
                      {formatCopPlain(pricing.checkoutCop)}
                    </strong>{" "}
                    por contrato gestionado en la plataforma (precio de lista{" "}
                    <strong className="font-semibold text-slate-900">
                      {formatCopPlain(pricing.listCompareCop)}
                    </strong>
                    ), mientras dure la promoción de lanzamiento.
                  </>
                ) : (
                  <>
                    Precio vigente por contrato gestionado en la plataforma:{" "}
                    <strong className="font-semibold text-slate-900">
                      {formatCopPlain(pricing.checkoutCop)}
                    </strong>
                    .
                  </>
                )}
              </span>
            </p>
            <p className="text-center text-[11px] leading-snug text-slate-600 lg:text-left">
              {PER_CONTRACT_PAYMENT_NOTICE}
            </p>
            <div className="flex justify-center pt-1 lg:justify-start">
              <Link
                href="/encuesta"
                className="inline-flex rounded-lg border border-violet-500 bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(124,58,237,0.35)] transition hover:bg-violet-700"
              >
                Responder encuesta y reservar beneficio
              </Link>
            </div>
          </section>
        </div>

        <footer className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-center text-[10px] leading-relaxed text-slate-500 sm:text-[11px] lg:text-left">
            ArriendoSeguro no reemplaza una inmobiliaria ni una asesoría legal. Es una herramienta digital
            para ayudar a formalizar y documentar arriendos ya acordados entre particulares, de modo que
            cuentes con respaldo escrito y trazable si más adelante necesitas acudir por una vía legal o de
            conciliación.
          </p>
        </footer>
      </main>

      <SurveyFloatingCta />
    </div>
  );
}
