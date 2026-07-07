import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Calculadoras de arriendo (gratis) | ArriendoSeguro",
  description:
    "Calculadoras gratuitas para arriendos en Colombia: reajuste del canon por IPC, canon máximo legal (1 % del valor comercial) y garantía de servicios públicos (Ley 820 de 2003).",
  alternates: { canonical: "/calculadoras" },
  keywords: [
    "calculadora arriendo",
    "reajuste canon IPC",
    "canon máximo Colombia",
    "garantía servicios públicos arriendo",
    "Ley 820 de 2003",
  ],
};

const tools = [
  {
    href: "/calculadoras/reajuste-canon",
    title: "Reajuste del canon por IPC",
    desc: "Cuánto puede subir tu arriendo este año según el IPC (Ley 820, art. 20).",
  },
  {
    href: "/calculadoras/canon-maximo",
    title: "Canon máximo legal (1 %)",
    desc: "El canon mensual máximo según el valor comercial del inmueble (art. 18).",
  },
  {
    href: "/calculadoras/garantia-servicios",
    title: "Garantía de servicios públicos",
    desc: "El máximo que se puede pedir como garantía de servicios (art. 15).",
  },
  {
    href: "/calculadoras/preaviso",
    title: "Preaviso de 3 meses",
    desc: "La fecha límite para avisar la terminación y evitar la renovación (art. 22).",
  },
] as const;

export default function CalculadorasIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBackNav />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Calculadoras de arriendo</h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            Herramientas gratuitas para arrendar con claridad en Colombia, basadas en la Ley 820 de 2003. Sin registro y
            sin costo.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {tools.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-2xl border border-slate-300 bg-white/70 p-5 shadow-sm transition hover:border-violet-400 hover:shadow-[0_10px_24px_rgba(139,92,246,0.18)]"
            >
              <h2 className="text-lg font-semibold text-violet-800">{t.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{t.desc}</p>
              <span className="mt-3 inline-block text-sm font-medium text-violet-700">Abrir calculadora →</span>
            </Link>
          ))}
        </section>

        <p className="text-sm text-slate-600">
          ¿Listo para formalizar? <Link href="/entiendelo-facil" className="text-violet-700 underline">Entiéndelo fácil</Link>{" "}
          o <Link href="/crear-cuenta" className="text-violet-700 underline">crea tu contrato gratis</Link>.
        </p>
      </main>
    </div>
  );
}
