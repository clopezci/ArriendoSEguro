/**
 * Contenido del blog en bloques tipados para SEO y render consistente
 * (listas, notas, tablas, CTAs internos).
 */
export type BlogCategoryId =
  | "contrato"
  | "ley820"
  | "codeudor"
  | "inventario"
  | "firma"
  | "guia";

export type ContentBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "note"; text: string }
  | { type: "table"; caption?: string; headers: string[]; rows: string[][] }
  | { type: "cta"; href: string; label: string; description?: string }
  | { type: "sources"; items: { label: string; href: string }[] };

export interface BlogArticle {
  slug: string;
  title: string;
  description: string;
  /** ISO 8601 fecha */
  datePublished: string;
  dateModified: string;
  category: BlogCategoryId;
  categoryLabel: string;
  keywords: string[];
  /** Aparece en el hub como artículo destacado */
  featured?: boolean;
  blocks: ContentBlock[];
}
