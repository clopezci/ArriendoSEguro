import type { MetadataRoute } from "next";
import { BLOG_ARTICLES } from "@/content/blog/articles";
import { absoluteUrl } from "@/content/blog/seo";

/** Rutas públicas relevantes para SEO (sin panel ni tokens dinámicos). */
const STATIC_PATHS = [
  "/",
  "/blog",
  "/demo",
  "/ingresar",
  "/crear-cuenta",
  "/entiendelo-facil",
  "/acerca-de",
  "/contacto",
  "/legal/terminos",
  "/legal/privacidad",
  "/legal/aviso-privacidad",
  "/legal/firma-electronica",
  "/legal/demo",
  "/legal/evaluacion",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastBlog = BLOG_ARTICLES.reduce(
    (acc, a) => (a.dateModified > acc ? a.dateModified : acc),
    BLOG_ARTICLES[0]?.dateModified ?? "2026-05-01",
  );

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: absoluteUrl(path),
    lastModified: path === "/blog" ? new Date(lastBlog) : new Date(),
    changeFrequency: path === "/" || path === "/blog" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/blog" ? 0.9 : 0.6,
  }));

  const blogPosts: MetadataRoute.Sitemap = BLOG_ARTICLES.map((a) => ({
    url: absoluteUrl(`/blog/${a.slug}`),
    lastModified: new Date(a.dateModified),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  return [...staticEntries, ...blogPosts];
}
