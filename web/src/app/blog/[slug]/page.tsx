import { ArticleBody } from "@/components/blog/article-body";
import { JsonLdScript } from "@/components/blog/json-ld";
import { BLOG_ARTICLES, getArticleBySlug, getRelatedArticles } from "@/content/blog/articles";
import { absoluteUrl } from "@/content/blog/seo";
import { appConfig } from "@/lib/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BLOG_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Artículo no encontrado" };

  const title = `${article.title} | Blog`;
  return {
    title,
    description: article.description,
    keywords: article.keywords,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      title: `${article.title} | ${appConfig.name}`,
      description: article.description,
      type: "article",
      locale: "es_CO",
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      url: absoluteUrl(`/blog/${article.slug}`),
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = getRelatedArticles(slug, 3);
  const url = absoluteUrl(`/blog/${article.slug}`);

  const postingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    url,
    keywords: article.keywords.join(", "),
    inLanguage: "es-CO",
    isPartOf: {
      "@type": "Blog",
      name: `Blog de ${appConfig.name}`,
      url: absoluteUrl("/blog"),
    },
    publisher: {
      "@type": "Organization",
      name: appConfig.name,
      url: absoluteUrl("/"),
    },
  };

  return (
    <>
      <JsonLdScript data={postingJsonLd} />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-300 bg-slate-100/90">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/blog" className="text-sm font-medium text-violet-700 hover:underline">
              ← Blog
            </Link>
            <Link href="/" className="text-sm text-slate-600 hover:text-violet-700">
              Inicio
            </Link>
          </div>
        </header>

        <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          <header className="border-b border-slate-200 pb-8">
            <p className="text-sm font-medium text-violet-600">{article.categoryLabel}</p>
            <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-3 text-pretty text-lg text-slate-700">{article.description}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <time dateTime={article.datePublished}>Publicado: {article.datePublished}</time>
              <span aria-hidden>·</span>
              <time dateTime={article.dateModified}>Actualizado: {article.dateModified}</time>
            </div>
          </header>

          <ArticleBody blocks={article.blocks} />

          {related.length > 0 ? (
            <section className="mt-12 border-t border-slate-200 pt-10" aria-labelledby="related-heading">
              <h2 id="related-heading" className="text-xl font-bold text-slate-900">
                Artículos relacionados
              </h2>
              <ul className="mt-4 space-y-3">
                {related.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/blog/${a.slug}`} className="font-medium text-violet-700 hover:underline">
                      {a.title}
                    </Link>
                    <p className="text-sm text-slate-600">{a.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </div>
    </>
  );
}
