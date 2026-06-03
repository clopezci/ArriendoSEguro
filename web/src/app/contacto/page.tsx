import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/forms/contact-form";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "¿Tienes preguntas sobre ArriendoSeguro? Escríbenos por el formulario de contacto y te respondemos a tu correo.",
  alternates: { canonical: "/contacto" },
};

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contacto</h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            ¿Tienes dudas, comentarios o necesitas soporte con tu expediente de arriendo?
            Escríbenos con este formulario. Te responderemos al correo que nos indiques.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Para temas de tratamiento de datos personales (Habeas Data, Ley 1581 de 2012), elige el
            tema correspondiente o revisa nuestro{" "}
            <Link href="/legal/aviso-privacidad" className="text-violet-700 underline">
              aviso de privacidad
            </Link>
            .
          </p>
        </header>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Escríbenos</h2>
          <p className="mt-2 text-sm text-slate-600">
            Todos los campos marcados son necesarios para poder responderte.
          </p>
          <div className="mt-5">
            <ContactForm />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 text-sm text-slate-700 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-lg font-semibold text-slate-900">Otros enlaces útiles</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            <li>
              <Link href="/acerca-de" className="text-violet-700 underline">
                Acerca de ArriendoSeguro
              </Link>
            </li>
            <li>
              <Link href="/entiendelo-facil" className="text-violet-700 underline">
                Entiéndelo fácil (cómo funciona)
              </Link>
            </li>
            <li>
              <Link href="/blog" className="text-violet-700 underline">
                Blog y guías
              </Link>
            </li>
            <li>
              <Link href="/legal/terminos" className="text-violet-700 underline">
                Términos y condiciones
              </Link>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
