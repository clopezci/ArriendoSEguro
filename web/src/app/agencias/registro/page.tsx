import Link from "next/link";
import type { Metadata } from "next";
import { LandingPublicHeader } from "@/components/landing/landing-public-header";
import { AgencySignupForm } from "@/components/agency/agency-signup-form";
import { AGENCY_TRIAL_CREDITS } from "@/domain/agencies/types";

export const metadata: Metadata = {
  title: "Empieza tu prueba — ArriendoSeguro para agencias",
  description:
    "Crea tu agencia en ArriendoSeguro y arranca con contratos gratis: captura por enlace/QR, generación en lote, verificación de identidad, firmas y cartera. Sin tarjeta.",
  robots: { index: true, follow: true },
};

export default function AgenciaRegistroPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <LandingPublicHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
          <div className="text-center">
            <h1 className="text-balance text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              Crea tu agencia y prueba gratis
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-slate-500">
              Se activa al instante con <strong>{AGENCY_TRIAL_CREDITS} contratos gratis</strong>. Llena tus datos y entra a tu panel; sin esperas ni tarjeta.
            </p>
          </div>

          <div className="mt-6">
            <AgencySignupForm trialCredits={AGENCY_TRIAL_CREDITS} />
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            ¿Ya tienes cuenta? <Link href="/agency" className="font-semibold text-[#5646E5] hover:underline">Entrar a mi panel</Link>
          </p>
        </main>
      </div>
    </div>
  );
}
