import { ArticleBody, type AnnualNotices } from "@/components/blog/article-body";
import { annualKeysUsed, resolveArticleAnnual } from "@/content/blog/annual";
import type { BlogArticle } from "@/content/blog/types";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAnnualValuesView } from "@/lib/annual/annualValuesServer";
import { AdSlot } from "@/components/ads/ad-slot";
import { JsonLdScript } from "@/components/blog/json-ld";
import { BLOG_ARTICLES, getArticleBySlug, getRelatedArticles } from "@/content/blog/articles";
import { absoluteUrl } from "@/content/blog/seo";
import { appConfig } from "@/lib/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

// Los artículos con valores anuales (IPC…) se regeneran al cambiar el dato
// (revalidatePath desde admin/cron); esto es solo la red de seguridad.
export const revalidate = 3600;

/**
 * Artículo con las variables anuales ya resueltas + sus avisos. Solo lee
 * Firestore si el artículo usa variables (`{ipc.…}`).
 */
async function loadArticle(slug: string): Promise<{ article: BlogArticle; notices: AnnualNotices } | null> {
  const raw = getArticleBySlug(slug);
  if (!raw) return null;
  const keys = annualKeysUsed(raw);
  if (keys.length === 0) return { article: raw, notices: {} };
  const view = await getAnnualValuesView(getAdminFirestore());
  const notices: AnnualNotices = {};
  for (const k of keys) {
    notices[k] = { status: view.status[k], text: view.notice[k], source: view.values[k].source, sourceUrl: view.values[k].sourceUrl };
  }
  return { article: resolveArticleAnnual(raw, view.values), notices };
}

export function generateStaticParams() {
  return BLOG_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadArticle(slug);
  if (!loaded) return { title: "Artículo no encontrado" };
  const { article } = loaded;
  const seoTitle = article.metaTitle ?? article.title;
  const seoDescription = article.metaDescription ?? article.description;

  const title = `${seoTitle} | Blog`;
  return {
    title,
    description: seoDescription,
    keywords: article.keywords,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      title: `${seoTitle} | ${appConfig.name}`,
      description: seoDescription,
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
  const loaded = await loadArticle(slug);
  if (!loaded) notFound();
  const { article, notices } = loaded;

  const related = getRelatedArticles(slug, 3);
  const url = absoluteUrl(`/blog/${article.slug}`);

  const postingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.metaTitle ?? article.title,
    description: article.metaDescription ?? article.description,
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

          <ArticleBody blocks={article.blocks} annualNotices={notices} />

          <AdSlot placement="blog_article" />

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
