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

      {/* Contenido informativo (bajo el acceso): describe el servicio y enlaza a
          las guías/herramientas gratuitas. Da a la home texto original y útil. */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-10 text-left text-slate-700">
          <h2 className="text-xl font-bold text-slate-900">
            Contratos de arriendo entre particulares en Colombia, bien hechos
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            ArriendoSeguro es una herramienta para que <strong>arrendadores e inquilinos</strong> que ya acordaron un
            arriendo lo <strong>formalicen y documenten</strong> sin depender de una inmobiliaria. Te guiamos paso a paso
            para armar el contrato conforme a la <strong>Ley 820 de 2003</strong> (arrendamiento de vivienda urbana),
            firmarlo con <strong>firma electrónica</strong> con validez legal (<strong>Ley 527 de 1999</strong>),
            registrar el <strong>inventario de entrega</strong> con fotos y llevar el control de{" "}
            <strong>pagos, novedades y renovación</strong>.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            No somos inmobiliaria ni asesoría jurídica: te ayudamos a dejar por escrito y con evidencia lo que las partes
            acuerdan, para reducir conflictos. El primer contrato es <strong>gratis</strong>; el acompañamiento durante el
            arriendo es un plan de pago único por contrato, una fracción mínima del valor del canon.
          </p>

          <h3 className="mt-6 text-base font-semibold text-slate-900">¿Qué puedes hacer aquí?</h3>
          <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            <li>• Crear el contrato de arrendamiento paso a paso.</li>
            <li>• Verificar que el canon respete el tope legal (1% del valor comercial).</li>
            <li>• Definir servicios públicos, codeudor y cláusulas especiales.</li>
            <li>• Firmar electrónicamente con trazabilidad (fecha, IP y hash).</li>
            <li>• Hacer el inventario y el acta de entrega del inmueble.</li>
            <li>• Registrar pagos, novedades, renovación y calificación privada.</li>
          </ul>

          <h3 className="mt-6 text-base font-semibold text-slate-900">Aprende y usa nuestras herramientas gratis</h3>
          <p className="mt-2 text-sm leading-relaxed">
            Publicamos guías con fuentes legales reales y herramientas de acceso libre:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              📘{" "}
              <Link href="/blog" className="font-medium text-violet-700 hover:underline">
                Blog de arriendo
              </Link>{" "}
              — artículos sobre canon, incremento anual por IPC, terminación, inventario y más, con las leyes citadas.
            </li>
            <li>
              🧮{" "}
              <Link href="/calculadoras" className="font-medium text-violet-700 hover:underline">
                Calculadoras
              </Link>{" "}
              — incremento por IPC, tope del canon, intereses de mora y días de preaviso.
            </li>
            <li>
              📄{" "}
              <Link href="/plantillas" className="font-medium text-violet-700 hover:underline">
                Plantillas y descargas
              </Link>{" "}
              — carta de preaviso, paz y salvo, acta de entrega y autorización de datos.
            </li>
            <li>
              ❓{" "}
              <Link href="/entiendelo-facil" className="font-medium text-violet-700 hover:underline">
                Cómo funciona
              </Link>{" "}
              — guía clara para formalizar tu primer arriendo.
            </li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Información general orientada a Colombia; no sustituye asesoría legal. Consulta siempre las normas vigentes y,
            ante dudas, a un profesional.
          </p>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-2xl px-5 pb-4 pt-6">
        <p className="text-center text-[10px] leading-relaxed text-slate-400">
          ArriendoSeguro no reemplaza una inmobiliaria ni una asesoría legal. Ayuda a formalizar y documentar arriendos
          entre particulares.
        </p>
      </footer>
    </div>
  );
}
