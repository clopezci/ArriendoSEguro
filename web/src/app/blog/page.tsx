import { BlogHub } from "@/components/blog/blog-hub";
import { JsonLdScript } from "@/components/blog/json-ld";
import { BLOG_ARTICLES, getFeaturedArticle } from "@/content/blog/articles";
import { absoluteUrl } from "@/content/blog/seo";
import { appConfig } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";

const BLOG_PAGE_DESCRIPTION =
  "Artículos orientativos sobre contrato de arriendo, Ley 820, codeudor, inventario y firma electrónica para arrendadores e inquilinos en Colombia.";

export const metadata: Metadata = {
  title: "Blog | Arriendo, contrato y formalización en Colombia",
  description: BLOG_PAGE_DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: `Blog | ${appConfig.name}`,
    description: BLOG_PAGE_DESCRIPTION,
    type: "website",
    locale: "es_CO",
    url: absoluteUrl("/blog"),
  },
};

export default function BlogPage() {
  const featured = getFeaturedArticle();
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `Blog de ${appConfig.name}`,
    description: BLOG_PAGE_DESCRIPTION,
    url: absoluteUrl("/blog"),
    blogPost: BLOG_ARTICLES.map((a) => ({
      "@type": "BlogPosting",
      headline: a.title,
      description: a.description,
      datePublished: a.datePublished,
      dateModified: a.dateModified,
      url: absoluteUrl(`/blog/${a.slug}`),
      keywords: a.keywords.join(", "),
    })),
  };

  return (
    <>
      <JsonLdScript data={blogJsonLd} />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-300 bg-slate-100/90 shadow-[0_6px_20px_rgba(139,92,246,0.12)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="text-sm font-semibold text-violet-700 hover:underline">
              ← Volver al inicio
            </Link>
            <Link
              href="/ingresar"
              className="rounded-md border border-violet-500 bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-600/30 sm:text-sm"
            >
              Acceder al panel
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="space-y-2 border-b border-slate-200 pb-8">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Blog
            </h1>
            <p className="max-w-2xl text-pretty text-slate-700">
              Orientación general para arrendar con más orden en Colombia. No sustituye asesoría legal;
              valida tu caso con un profesional cuando aplique.
            </p>
          </div>

          <div className="mt-10">
            <BlogHub featured={featured} articles={BLOG_ARTICLES} />
          </div>
        </main>
      </div>
    </>
  );
}
