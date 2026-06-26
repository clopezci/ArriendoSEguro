import type { Metadata } from "next";
import Link from "next/link";
import { LandingPublicHeader } from "@/components/landing/landing-public-header";

export const metadata: Metadata = {
  title: "Herramientas gratis para arrendar en Colombia | ArriendoSeguro",
  description:
    "Todo lo gratuito en un solo lugar: calculadoras de arriendo, guías legales, plantillas descargables, firma digital del Estado y más, para arrendar con respaldo en Colombia.",
  alternates: { canonical: "/herramientas" },
  keywords: [
    "herramientas arriendo gratis",
    "calculadoras arriendo",
    "plantillas contrato arriendo",
    "guías Ley 820",
    "firma digital gratis",
  ],
};

type Tool = {
  href: string;
  title: string;
  desc: string;
  /** Etiqueta corta opcional (ej. "Nuevo", "Sin registro"). */
  tag?: string;
};

type ToolGroup = {
  id: string;
  title: string;
  desc: string;
  tools: Tool[];
};

const GROUPS: ToolGroup[] = [
  {
    id: "calcular",
    title: "Calcular",
    desc: "Cuentas claras según la Ley 820 de 2003, sin registro.",
    tools: [
      {
        href: "/calculadoras/reajuste-canon",
        title: "Reajuste del canon por IPC",
        desc: "Cuánto puede subir tu arriendo este año (art. 20).",
      },
      {
        href: "/calculadoras/canon-maximo",
        title: "Canon máximo legal (1 %)",
        desc: "El canon mensual máximo según el valor del inmueble (art. 18).",
      },
      {
        href: "/calculadoras/garantia-servicios",
        title: "Garantía de servicios públicos",
        desc: "El máximo permitido como garantía de servicios (art. 15).",
      },
      {
        href: "/calculadoras/preaviso",
        title: "Preaviso de 3 meses",
        desc: "Calcula la fecha límite para avisar la terminación.",
        tag: "Nuevo",
      },
    ],
  },
  {
    id: "descargar",
    title: "Descargar plantillas",
    desc: "Modelos listos para imprimir o firmar, con fundamento legal.",
    tools: [
      {
        href: "/plantillas",
        title: "Centro de plantillas",
        desc: "Carta de preaviso, paz y salvo, acta de entrega, autorización de datos y más.",
        tag: "Nuevo",
      },
    ],
  },
  {
    id: "aprender",
    title: "Aprender",
    desc: "Guías reales con fuentes oficiales, en lenguaje claro.",
    tools: [
      {
        href: "/blog",
        title: "Blog de arriendo",
        desc: "Ley 820, codeudor, inventario, firma y más, con fuentes citadas.",
      },
      {
        href: "/blog/firma-digital-gratis-agencia-nacional-digital-arriendo",
        title: "Firma digital gratis del Estado",
        desc: "Cómo firmar con la Agencia Nacional Digital, paso a paso.",
        tag: "Gratis",
      },
      {
        href: "/entiendelo-facil",
        title: "Entiéndelo fácil",
        desc: "El camino del arriendo explicado sin tecnicismos.",
      },
    ],
  },
  {
    id: "formalizar",
    title: "Crear y firmar",
    desc: "Arma tu expediente y conócelo antes de empezar.",
    tools: [
      {
        href: "/crear-cuenta",
        title: "Crear contrato gratis",
        desc: "Genera tu contrato de arriendo guiado, sin mensualidades.",
      },
      {
        href: "/demo",
        title: "Ver demo guiado",
        desc: "Recorre el flujo completo antes de crear tu cuenta.",
      },
    ],
  },
];

export default function HerramientasPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingPublicHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
            100 % GRATIS
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Herramientas gratuitas</h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            Todo lo que puedes usar sin pagar, reunido en un solo lugar: calculadoras, guías, plantillas descargables y la
            firma digital del Estado. Pensado para arrendar con más respaldo en Colombia.
          </p>
        </header>

        {GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`grp-${group.id}`} className="space-y-3">
            <div>
              <h2 id={`grp-${group.id}`} className="text-xl font-bold text-slate-900">
                {group.title}
              </h2>
              <p className="text-sm text-slate-600">{group.desc}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="group relative flex flex-col rounded-2xl border border-slate-300 bg-white/70 p-5 shadow-sm transition hover:border-violet-400 hover:shadow-[0_10px_24px_rgba(139,92,246,0.18)]"
                >
                  {t.tag && (
                    <span className="absolute right-3 top-3 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                      {t.tag}
                    </span>
                  )}
                  <h3 className="pr-12 text-base font-semibold text-violet-800">{t.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-slate-700">{t.desc}</p>
                  <span className="mt-3 inline-block text-sm font-medium text-violet-700 group-hover:underline">
                    Abrir →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="text-sm text-slate-600">
          ¿Listo para formalizar?{" "}
          <Link href="/crear-cuenta" className="text-violet-700 underline">
            Crea tu contrato gratis
          </Link>{" "}
          o{" "}
          <Link href="/ingresar" className="text-violet-700 underline">
            entra al panel
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
