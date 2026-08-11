import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acerca de",
  description:
    "Qué es ArriendoSeguro, por qué existe y quién está detrás: una plataforma colombiana operada por LOTIC para formalizar arriendos entre personas con contrato, firma e inventario.",
  alternates: { canonical: "/acerca-de" },
};

const principios = [
  {
    title: "Claridad antes que letra menuda",
    text: "Explicamos en español sencillo qué hace y qué no hace la plataforma, sin promesas que no podamos cumplir.",
  },
  {
    title: "Privacidad y datos con cuidado",
    text: "Recolectamos lo mínimo necesario y tratamos los datos personales conforme a la Ley 1581 de 2012 (Habeas Data).",
  },
  {
    title: "Trazabilidad",
    text: "Cada contrato queda versionado y con evidencia, para que tengas respaldo escrito si algún día lo necesitas.",
  },
  {
    title: "Bajo costo y sin atar",
    text: "Pago único por contrato; no recaudamos tu canon ni te obligamos a una administración mensual.",
  },
] as const;

export default function AcercaDePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBackNav />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <p className="text-sm font-medium text-violet-700">Un producto de LOTIC · Colombia</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Acerca de ArriendoSeguro
          </h1>
          <p className="mt-3 max-w-3xl text-slate-700">
            ArriendoSeguro es una herramienta digital para que arrendadores y arrendatarios en
            Colombia formalicen su arriendo de forma sencilla, ordenada y de bajo costo: contrato
            guiado, firma electrónica, inventario y registro de pagos, sin necesidad de una agencia
            de por medio.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Por qué existimos</h2>
          <p className="mt-3 text-slate-700">
            Muchas personas arriendan directamente porque ya encontraron a alguien de confianza o
            porque no quieren asumir el costo de una gestión inmobiliaria completa. El problema no
            es arrendar directo: es hacerlo sin contrato claro, sin inventario y sin soportes.
            ArriendoSeguro nace para cerrar esa brecha y ayudar a que el acuerdo quede bien
            documentado desde el principio.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Quién está detrás</h2>
          <p className="mt-3 text-slate-700">
            ArriendoSeguro es un producto de <strong>LOTIC</strong>, la marca tecnológica que agrupa
            nuestros productos de software. Hoy LOTIC opera como <strong>persona natural comerciante</strong>{" "}
            en Colombia (NIT 71.217.228), con domicilio en Medellín, y crecerá hacia una figura societaria
            a medida que avancemos. Construimos el producto de forma incremental y escuchando a quienes
            arriendan. Mantenemos canales de contacto y políticas claras para que sepas siempre con quién
            estás tratando: puedes escribirnos a{" "}
            <a href="mailto:contacto@arriendoseguro.app" className="font-medium text-violet-700 underline">
              contacto@arriendoseguro.app
            </a>
            .
          </p>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Nuestros principios</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {principios.map((p) => (
              <article
                key={p.title}
                className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.18)]"
              >
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-slate-700">{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-violet-500 bg-violet-100/20 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.2)]">
          <h2 className="text-2xl font-semibold">Qué no hacemos</h2>
          <p className="mt-3 text-violet-800">
            No somos una inmobiliaria tradicional, no administramos tu inmueble, no recaudamos el
            canon, no garantizamos el pago y no reemplazamos a un abogado. Tampoco publicamos listas
            negras ni permitimos consultas libres por cédula. Somos una herramienta para formalizar
            y documentar arriendos ya acordados entre particulares.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/75 p-6 text-center shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <h2 className="text-2xl font-bold">¿Quieres hablar con nosotros?</h2>
          <p className="mt-2 text-slate-700">
            Estamos atentos a dudas, ideas y posibles alianzas.
          </p>
          <p className="mt-3 text-sm text-slate-700">
            Escríbenos a{" "}
            <a href="mailto:contacto@arriendoseguro.app" className="font-medium text-violet-700 underline">
              contacto@arriendoseguro.app
            </a>{" "}
            · Proyecto operado desde <strong>Medellín, Colombia</strong>.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Consulta nuestros{" "}
            <Link href="/legal/terminos" className="text-violet-700 underline">
              Términos
            </Link>{" "}
            y el{" "}
            <Link href="/legal/aviso-privacidad" className="text-violet-700 underline">
              Aviso de privacidad
            </Link>
            .
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/contacto"
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] hover:bg-violet-500"
            >
              Ir a Contacto
            </Link>
            <Link
              href="/entiendelo-facil"
              className="rounded-lg border border-violet-500 px-5 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-100/30"
            >
              Cómo funciona
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
