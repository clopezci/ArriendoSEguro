import { LandingPublicHeader } from "@/components/landing/landing-public-header";
import { LandingInstallApp } from "@/components/landing/landing-install-app";
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
    "Colombia",
  ],
  openGraph: {
    title: "Contrato de arrendamiento en Colombia | ArriendoSeguro",
    description:
      "Formaliza tu contrato de arriendo con firma electrónica, inventario y registro de pagos, sin inmobiliaria y sin dejarlo informal.",
    type: "website",
    locale: "es_CO",
  },
};

const STEPS: { n: number; label: string }[] = [
  { n: 1, label: "Expediente" },
  { n: 2, label: "Condiciones" },
  { n: 3, label: "Revisión" },
  { n: 4, label: "Firma" },
  { n: 5, label: "Entrega" },
];

export default function Home() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 text-slate-900">
      <LandingPublicHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-5 py-6 text-center">
        <div className="space-y-2">
          <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            ¿Vas a arrendar?
            <span className="mt-1 block">¿Necesitas hacer tu contrato de arrendamiento?</span>
          </h1>
          <p className="text-pretty text-[15px] font-semibold leading-relaxed text-slate-700">
            Crea tu <span className="text-emerald-700">primer contrato gratis</span>.
          </p>
          <p className="text-pretty text-[13px] leading-relaxed text-slate-500">
            Accede a múltiples beneficios con un plan por una <strong className="font-semibold text-slate-700">mínima
            fracción del valor de tu arriendo</strong> — pago único por contrato.
          </p>
        </div>

        {/* Fila de 5 pasos, compacta y en una sola línea en el celular */}
        <ol className="flex items-start justify-between gap-1">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-500 text-sm font-black text-white shadow-[0_3px_10px_rgba(124,58,237,0.4)]">
                {s.n}
              </span>
              <span className="text-[11px] font-medium leading-tight text-slate-700">{s.label}</span>
            </li>
          ))}
        </ol>

        {/* Acceso */}
        <div className="flex flex-col gap-2.5">
          <Link
            href="/crear-cuenta"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-600 px-6 text-base font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition hover:bg-violet-700"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/ingresar"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-violet-400 px-6 text-base font-semibold text-violet-700 transition hover:bg-violet-50"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <Link href="/herramientas" className="hover:text-violet-700 hover:underline">
            Herramientas gratis
          </Link>
          <Link href="/entiendelo-facil" className="hover:text-violet-700 hover:underline">
            Cómo funciona
          </Link>
          <LandingInstallApp
            className="!min-h-0 !border-0 !bg-transparent !px-0 !py-0 !text-xs !font-normal !text-slate-500 !shadow-none hover:!bg-transparent hover:!text-violet-700 hover:!underline"
            label="Instalar app"
          />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-2xl px-5 pb-4">
        <p className="text-center text-[10px] leading-relaxed text-slate-400">
          ArriendoSeguro no reemplaza una inmobiliaria ni una asesoría legal. Ayuda a formalizar y documentar arriendos
          entre particulares.
        </p>
      </footer>
    </div>
  );
}
