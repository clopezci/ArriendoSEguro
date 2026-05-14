"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BlogArticle, BlogCategoryId } from "@/content/blog/types";
import { BLOG_CATEGORIES } from "@/content/blog/articles";

type Props = {
  featured: BlogArticle;
  articles: BlogArticle[];
};

export function BlogHub({ featured, articles }: Props) {
  const [category, setCategory] = useState<BlogCategoryId | "all">("all");

  const filtered = useMemo(() => {
    if (category === "all") return articles.filter((a) => a.slug !== featured.slug);
    return articles.filter((a) => a.category === category && a.slug !== featured.slug);
  }, [articles, category, featured.slug]);

  const categoryEntries = Object.values(BLOG_CATEGORIES);

  return (
    <div className="space-y-8">
      <article className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-slate-50 shadow-[0_8px_30px_rgba(139,92,246,0.12)]">
        <div className="border-b border-violet-100 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
          Destacado
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium text-violet-600">{featured.categoryLabel}</p>
          <h2 className="mt-1 text-balance text-xl font-bold text-slate-900 sm:text-2xl">{featured.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">{featured.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/blog/${featured.slug}`}
              className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Leer artículo
            </Link>
            <time
              dateTime={featured.datePublished}
              className="self-center text-xs text-slate-500"
            >
              Publicado: {featured.datePublished}
            </time>
          </div>
        </div>
      </article>

      <div>
        <p className="text-sm font-medium text-slate-700">Filtrar por categoría</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Categorías del blog">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition sm:text-sm ${
              category === "all"
                ? "border-violet-600 bg-violet-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-violet-400"
            }`}
          >
            Todas
          </button>
          {categoryEntries.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition sm:text-sm ${
                category === c.id
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-violet-400"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No hay más artículos en esta categoría. Prueba otra o vuelve a «Todas».
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link
              key={a.slug}
              href={`/blog/${a.slug}`}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md"
            >
              <span className="text-xs font-medium text-violet-600">{a.categoryLabel}</span>
              <h3 className="mt-1 text-balance font-semibold text-slate-900 group-hover:text-violet-800">{a.title}</h3>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-600">{a.description}</p>
              <time dateTime={a.datePublished} className="mt-3 text-xs text-slate-500">
                {a.datePublished}
              </time>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
