import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/forms/report-form";

export const metadata: Metadata = {
  title: "Reportar un problema",
  description:
    "¿Encontraste un error, algo no funciona o tienes una queja o sugerencia? Repórtalo y nos ayudas a mejorar ArriendoSeguro.",
  alternates: { canonical: "/reportar" },
};

export default function ReportarPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Reportar un problema</h1>
          <p className="mt-3 text-slate-700">
            ¿Algo falló, no funcionó como esperabas, o tienes una queja o una idea? Cuéntanos: cada
            reporte nos ayuda a mejorar ArriendoSeguro. Evita incluir datos sensibles (documentos,
            contraseñas) en el mensaje.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Si es una duda general, escríbenos mejor desde{" "}
            <Link href="/contacto" className="text-violet-700 underline">
              Contacto
            </Link>
            .
          </p>
        </header>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <ReportForm />
        </section>
      </main>
    </div>
  );
}
