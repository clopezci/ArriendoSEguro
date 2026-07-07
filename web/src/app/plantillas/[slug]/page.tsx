import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/blog/json-ld";
import { absoluteUrl } from "@/content/blog/seo";
import { PrintButton } from "@/components/templates/print-button";
import { getAllTemplateSlugs, getTemplateBySlug, type TemplateBlock } from "@/content/templates/templates";

export function generateStaticParams() {
  return getAllTemplateSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = getTemplateBySlug(slug);
  if (!t) return { title: "Plantilla no encontrada | ArriendoSeguro" };
  return {
    title: t.title,
    description: t.description,
    alternates: { canonical: `/plantillas/${t.slug}` },
    keywords: [t.category, "plantilla arriendo", "modelo gratis"],
  };
}

function Block({ block }: { block: TemplateBlock }) {
  switch (block.type) {
    case "h":
      return <h3 className="mt-4 text-sm font-bold text-slate-900">{block.text}</h3>;
    case "p":
      return <p className="mt-3 text-sm leading-relaxed text-slate-800">{block.text}</p>;
    case "ul":
      return (
        <ul className="mt-2 list-disc space-y-1.5 pl-6 text-sm leading-relaxed text-slate-800">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "sign":
      return (
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {block.roles.map((role, i) => (
            <div key={i} className="text-sm text-slate-800">
              <div className="border-t border-slate-500 pt-1">{role}</div>
              <div className="mt-1 text-xs text-slate-500">Nombre, documento y firma</div>
            </div>
          ))}
        </div>
      );
  }
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTemplateBySlug(slug);
  if (!t) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: t.title,
    description: t.description,
    url: absoluteUrl(`/plantillas/${t.slug}`),
    inLanguage: "es-CO",
  };

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <TopBackNav backHref="/plantillas" backLabel="Volver a plantillas" />
        <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
          <nav className="no-print text-sm">
            <Link href="/plantillas" className="text-violet-700 hover:underline">
              ← Plantillas
            </Link>
          </nav>

          <header className="no-print">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">{t.category}</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h1>
            <p className="mt-2 text-sm text-slate-700">{t.intro}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <PrintButton />
              <span className="text-xs text-slate-500">Se abre el diálogo de impresión; elige “Guardar como PDF”.</span>
            </div>
          </header>

          {/* Hoja imprimible */}
          <article className="print-sheet rounded-xl border border-slate-300 bg-white p-8 shadow-sm">
            <h2 className="text-center text-base font-bold uppercase tracking-wide text-slate-900">{t.docTitle}</h2>
            {t.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
            <p className="mt-8 border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-500">
              Modelo orientativo de ArriendoSeguro. No constituye asesoría jurídica; ajústalo a tu caso y valida con un
              profesional cuando aplique.
            </p>
          </article>

          <section className="no-print rounded-2xl border border-slate-300 bg-white/65 p-5 text-sm text-slate-700">
            <h2 className="font-semibold text-slate-900">Fundamento</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {t.sources.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </>
  );
}
