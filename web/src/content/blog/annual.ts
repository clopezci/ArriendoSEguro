/**
 * Variables anuales en artículos del blog (`{ipc.percent}`, `{ipc.year}`…).
 * PURO: recibe los valores vigentes y devuelve el artículo con las cifras ya
 * puestas. Así el texto no envejece: cuando cambia el IPC (admin o revisión
 * automática del DANE), el artículo se actualiza solo.
 */
import { resolveAnnualTokens, usesAnnualKey, type AnnualValueKey, type AnnualValues } from "@/domain/annual/annualValues";
import type { BlogArticle, ContentBlock } from "./types";

/** ¿Qué valores anuales usa el artículo? (vacío → no hace falta leer Firestore). */
export function annualKeysUsed(article: BlogArticle): AnnualValueKey[] {
  const raw = JSON.stringify(article);
  const keys = new Set<AnnualValueKey>();
  for (const k of ["ipc", "uvt"] as const) {
    if (usesAnnualKey(raw, k)) keys.add(k);
  }
  for (const b of article.blocks) if (b.type === "annualNotice") keys.add(b.key);
  return [...keys];
}

function resolveBlock(b: ContentBlock, r: (s: string) => string): ContentBlock {
  switch (b.type) {
    case "h2":
    case "h3":
    case "p":
    case "note":
      return { ...b, text: r(b.text) };
    case "ul":
    case "ol":
      return { ...b, items: b.items.map(r) };
    case "table":
      return {
        ...b,
        caption: b.caption ? r(b.caption) : b.caption,
        headers: b.headers.map(r),
        rows: b.rows.map((row) => row.map(r)),
      };
    case "cta":
      return { ...b, label: r(b.label), href: r(b.href), description: b.description ? r(b.description) : b.description };
    case "sources":
      return { ...b, items: b.items.map((i) => ({ label: r(i.label), href: r(i.href) })) };
    default:
      return b;
  }
}

/** Artículo con las variables reemplazadas por los valores vigentes. */
export function resolveArticleAnnual(article: BlogArticle, values: AnnualValues): BlogArticle {
  const r = (s: string) => resolveAnnualTokens(s, values);
  const keys = annualKeysUsed(article);
  // "Actualizado" del artículo = la fecha más reciente entre su edición y la del dato.
  let dateModified = article.dateModified;
  for (const k of keys) {
    const d = values[k].updatedAt?.slice(0, 10);
    if (d && d > dateModified) dateModified = d;
  }
  return {
    ...article,
    title: r(article.title),
    description: r(article.description),
    metaTitle: article.metaTitle ? r(article.metaTitle) : undefined,
    metaDescription: article.metaDescription ? r(article.metaDescription) : undefined,
    keywords: article.keywords.map(r),
    dateModified,
    blocks: article.blocks.map((b) => resolveBlock(b, r)),
  };
}
