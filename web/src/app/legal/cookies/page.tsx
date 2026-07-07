import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de cookies",
  description:
    "Qué cookies usa ArriendoSeguro, para qué sirven y cómo puedes gestionar tu consentimiento (analítica y publicidad).",
  alternates: { canonical: "/legal/cookies" },
};

const cookieTable = [
  {
    cat: "Necesarias",
    purpose: "Inicio de sesión, seguridad, control anti-bot (Turnstile) y funcionamiento básico.",
    consent: "No requieren consentimiento (imprescindibles).",
  },
  {
    cat: "Analítica",
    purpose: "Google Analytics 4: medición agregada del uso para mejorar el producto.",
    consent: "Solo si las aceptas.",
  },
  {
    cat: "Publicidad",
    purpose:
      "Google AdSense (cuando esté activo): mostrar y medir anuncios. Pueden no estar activas todavía.",
    consent: "Solo si las aceptas.",
  },
] as const;

export default function CookiesPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBackNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Política de cookies</h1>
          <p className="mt-3 text-slate-700">
            Esta página explica qué cookies y tecnologías similares usa ArriendoSeguro y cómo puedes
            controlar tu consentimiento. Complementa nuestro{" "}
            <Link href="/legal/aviso-privacidad" className="text-violet-700 underline">
              aviso de privacidad
            </Link>{" "}
            y el{" "}
            <Link href="/legal/privacidad" className="text-violet-700 underline">
              tratamiento de datos
            </Link>{" "}
            (Ley 1581 de 2012).
          </p>
        </header>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">¿Qué es una cookie?</h2>
          <p className="mt-2 text-sm text-slate-700">
            Una cookie es un pequeño archivo que se guarda en tu dispositivo cuando visitas un sitio.
            Sirve para recordar preferencias, mantener tu sesión o medir el uso. También usamos
            almacenamiento local del navegador para recordar tu decisión sobre cookies.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Categorías que usamos</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-200/80 text-left">
                  <th className="border border-slate-300 px-3 py-2">Categoría</th>
                  <th className="border border-slate-300 px-3 py-2">Para qué</th>
                  <th className="border border-slate-300 px-3 py-2">Consentimiento</th>
                </tr>
              </thead>
              <tbody>
                {cookieTable.map((row) => (
                  <tr key={row.cat}>
                    <td className="border border-slate-300 px-3 py-2 font-medium">{row.cat}</td>
                    <td className="border border-slate-300 px-3 py-2">{row.purpose}</td>
                    <td className="border border-slate-300 px-3 py-2">{row.consent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Cómo gestionamos tu consentimiento</h2>
          <p className="mt-2 text-sm text-slate-700">
            Usamos el <strong>modo de consentimiento de Google (Consent Mode v2)</strong>: por
            defecto, la analítica y la publicidad quedan <strong>denegadas</strong> hasta que tú las
            autorices en el banner. Puedes cambiar tu decisión en cualquier momento desde el enlace{" "}
            <strong>«Preferencias de cookies»</strong> del pie de página, o borrando los datos del
            sitio en tu navegador.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Las cookies necesarias no se pueden desactivar porque sin ellas el sitio no funciona.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Terceros</h2>
          <p className="mt-2 text-sm text-slate-700">
            Cuando los autorizas, pueden instalarse cookies de Google (Analytics y, en el futuro,
            AdSense). Esos proveedores tratan los datos según sus propias políticas. Revisa las
            políticas de privacidad de Google para más detalle.
          </p>
        </section>
      </main>
    </div>
  );
}
